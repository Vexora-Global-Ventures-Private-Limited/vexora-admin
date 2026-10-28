"use client"

import { use, useEffect, useRef, useState } from "react"
import { Eye, RotateCcw, Save, ServerCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { NotFoundCard } from "@/components/admin/not-found-card"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import {
  useGetTemplatesQuery,
  usePreviewTemplateMutation,
  useSaveTemplateMutation,
  type TemplateEvent,
  type TemplateVersion,
} from "@/store/api/adminApi"
import { useStepUp } from "@/lib/use-step-up"
import { ROUTES } from "@/lib/routes"
import { describeAdminError, formatDateTime, useIsSuperAdmin } from "@/components/admin/config/config-helpers"
import {
  BODY_MAX, SUBJECT_MAX, WHATSAPP_NAME_PATTERN, channelLabel, malformedPlaceholders, renderDraft, sampleValue, usedVariables,
} from "@/components/admin/templates/template-helpers"

export default function TemplateEditorPage({ params }: { params: Promise<{ eventKey: string; channel: string }> }) {
  const raw = use(params)
  // A malformed %-sequence in a hand-edited URL would make
  // decodeURIComponent throw and crash the page — fall back to the raw value
  // (which then just shows "not found").
  const eventKey = safeDecode(raw.eventKey)
  const channel = safeDecode(raw.channel)
  const { data: events, isLoading, isError, refetch, isFetching } = useGetTemplatesQuery()

  const event = events?.find((e) => e.eventKey === eventKey)
  const template = event?.channels[channel]

  return (
    <div className="max-w-3xl space-y-6">
      <DetailBackLink href={ROUTES.templates} label="All templates" />
      {isLoading && <Skeleton className="h-96 w-full" aria-label="Loading template" />}
      {isError && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load templates.{" "}
          <button onClick={() => refetch()} disabled={isFetching} className="font-semibold underline">Retry</button>
        </div>
      )}
      {events && (!event || !template) && <NotFoundCard label="Template" id={`${eventKey} / ${channel}`} />}
      {event && template && (
        // Keyed by event+channel only — a new version from the server is
        // handled inside the editor so it never silently wipes a draft.
        <TemplateEditor key={`${event.eventKey}-${channel}`} event={event} channel={channel} template={template} />
      )}
    </div>
  )
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function TemplateEditor({ event, channel, template }: { event: TemplateEvent; channel: string; template: TemplateVersion }) {
  const canEdit = useIsSuperAdmin()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  // The version this draft started from. When the server's live version
  // moves on (our own save, or another admin's), adopt it straight away if
  // there's nothing unsaved — otherwise keep the draft and show a banner.
  const [base, setBase] = useState(template)
  const [adoptNext, setAdoptNext] = useState(false)
  const [subject, setSubject] = useState(base.subject ?? "")
  const [body, setBody] = useState(base.body ?? "")
  const [waName, setWaName] = useState(base.whatsappTemplateName ?? "")
  const [samples, setSamples] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [serverPreview, setServerPreview] = useState<{ title?: string; body: string } | null>(null)
  const [saveTemplate, { isLoading: isSaving }] = useSaveTemplateMutation()
  const [previewTemplate, { isLoading: isPreviewing }] = usePreviewTemplateMutation()
  const stepUp = useStepUp()

  const isEmail = channel === "email"
  const isWhatsapp = channel === "whatsapp"
  const allowed = event.variables
  const used = usedVariables(`${subject} ${body}`)
  const unknown = allowed ? used.filter((v) => !allowed.includes(v)) : []
  const malformed = malformedPlaceholders(`${subject} ${body}`)
  const previewVars = Array.from(new Set([...(allowed ?? []), ...used]))

  const errors = [
    !body.trim() && "Body can't be empty.",
    body.length > BODY_MAX && `Body is over ${BODY_MAX} characters.`,
    subject.length > SUBJECT_MAX && `Subject is over ${SUBJECT_MAX} characters.`,
    // Saving omits an empty subject, which the backend reads as "keep the
    // current one" — so an existing subject can't actually be cleared.
    isEmail && !!base.subject && !subject.trim() && "An existing subject can't be removed — enter a subject.",
    isWhatsapp && !WHATSAPP_NAME_PATTERN.test(waName) && "WhatsApp needs its approved template name (lowercase letters, digits, underscores).",
    malformed.length > 0 &&
      `Not a valid placeholder: ${malformed.join(", ")} — use {{name}} with letters, digits, _ or . only; it would be sent as literal text.`,
    unknown.length > 0 && `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.map((v) => `{{${v}}}`).join(", ")} — this event only provides the ones listed.`,
  ].filter(Boolean) as string[]

  const dirty =
    body !== (base.body ?? "") ||
    (isEmail && subject !== (base.subject ?? "")) ||
    (isWhatsapp && waName !== (base.whatsappTemplateName ?? ""))

  const adopt = (next: TemplateVersion) => {
    setBase(next)
    setSubject(next.subject ?? "")
    setBody(next.body ?? "")
    setWaName(next.whatsappTemplateName ?? "")
    setServerPreview(null)
    setAdoptNext(false)
  }
  const newerOnServer = template.id !== base.id || template.version !== base.version
  if (newerOnServer && (adoptNext || !dirty)) adopt(template)

  // Leaving with unsaved copy (closing the tab, reloading) asks first.
  useEffect(() => {
    if (!dirty || adoptNext) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, adoptNext])

  const insertVariable = (name: string) => {
    const el = bodyRef.current
    const token = `{{${name}}}`
    if (!el) return setBody((b) => b + token)
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const reset = () => adopt(template)

  const loadServerPreview = async () => {
    try {
      const vars = Object.fromEntries(Object.entries(samples).filter(([, v]) => v.trim()))
      const res = await previewTemplate({ id: base.id, variables: vars }).unwrap()
      // Rendered as text either way — coerce in case the server ever returns a non-string.
      setServerPreview({ title: res.title == null ? undefined : String(res.title), body: String(res.body ?? "") })
    } catch (err) {
      toast.error("Couldn't load the live preview", { description: describeAdminError(err, "Please try again.") })
    }
  }

  const save = () => {
    setConfirming(false)
    if (newerOnServer) {
      toast.error("A newer version was saved meanwhile", { description: "Load it first so you don't overwrite someone else's change." })
      return
    }
    stepUp.run(
      () =>
        saveTemplate({
          eventKey: event.eventKey,
          channel,
          body,
          ...(isEmail && subject.trim() ? { subject: subject.trim() } : {}),
          ...(isWhatsapp ? { whatsappTemplateName: waName } : {}),
        }).unwrap(),
      {
        onSuccess: () => {
          // Our own save — take the next server version without the banner.
          setAdoptNext(true)
          toast.success(`Saved as v${base.version + 1}`, { description: "Live for new notifications · audit-logged." })
        },
        onError: (err) => toast.error("Couldn't save template", { description: describeAdminError(err, "Please try again.") }),
      },
    )
  }

  return (
    <>
      <DetailCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="break-all font-mono text-lg font-bold text-brand-secondary">{event.eventKey}</h2>
            <div className="mt-1 text-xs text-brand-secondary/55">
              {channelLabel(channel)} · {event.domain} · editing v{base.version} · updated {formatDateTime(base.updatedAt)}
            </div>
          </div>
          <StatusPill tone={event.isSuppressible ? "info" : "neutral"}>
            {event.isSuppressible ? "users can turn off" : "transactional — always sent"}
          </StatusPill>
        </div>

        {!canEdit && <p className="mt-4 text-xs text-brand-secondary/60">Read-only — only a super admin can change templates.</p>}

        {newerOnServer && !adoptNext && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <span>v{template.version} was saved by someone else while you were editing. Your unsaved changes are still here.</span>
            <Button size="sm" variant="outline" onClick={() => adopt(template)} className="h-7 text-xs">
              Load v{template.version} (discard mine)
            </Button>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {isWhatsapp && (
            <div>
              <Label htmlFor="tpl-wa">WhatsApp template name</Label>
              <Input id="tpl-wa" value={waName} onChange={(e) => setWaName(e.target.value.trim())} readOnly={!canEdit} className="mt-1 font-mono" placeholder="e.g. lead_received_v1" />
              <p className="mt-1 text-[11px] text-brand-secondary/55">Must match a template already approved in the WhatsApp Business account — the body here is for reference.</p>
            </div>
          )}
          {isEmail && (
            <div>
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={!canEdit} maxLength={SUBJECT_MAX + 50} className="mt-1" />
              {!subject.trim() && !base.subject && (
                <p className="mt-1 text-[11px] text-brand-secondary/55">No subject — the server falls back to a title generated from the event name.</p>
              )}
            </div>
          )}
          <div>
            <div className="flex items-end justify-between">
              <Label htmlFor="tpl-body">Body</Label>
              <span className={body.length > BODY_MAX ? "text-[11px] font-semibold text-red-600" : "text-[11px] text-brand-secondary/45"}>
                {body.length}/{BODY_MAX}
              </span>
            </div>
            <Textarea id="tpl-body" ref={bodyRef} rows={7} value={body} onChange={(e) => setBody(e.target.value)} readOnly={!canEdit} className="mt-1" />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary/55">Variables</div>
            {allowed === null ? (
              <p className="mt-1 text-xs text-amber-700">This event isn&apos;t wired with variables yet — anything typed in {"{{ }}"} won&apos;t be checked or filled in.</p>
            ) : allowed.length === 0 ? (
              <p className="mt-1 text-xs text-brand-secondary/60">This event provides no variables.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {allowed.map((v) => (
                  <Button key={v} type="button" size="sm" variant="outline" disabled={!canEdit} onClick={() => insertVariable(v)} className="h-7 font-mono text-[11px]">
                    + {`{{${v}}}`}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {errors.length > 0 && dirty && (
          <ul role="alert" className="mt-4 list-disc space-y-0.5 pl-5 text-xs text-red-600">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-5 flex flex-wrap gap-2">
            {/* adoptNext: our save succeeded but the new version hasn't been
                refetched yet — the draft still looks dirty, so a second click
                would save the same text again as yet another version. */}
            <Button
              onClick={() => setConfirming(true)}
              disabled={!dirty || errors.length > 0 || isSaving || stepUp.open || newerOnServer || adoptNext}
              className="btn-gold gap-1.5"
            >
              <Save className="h-4 w-4" /> {isSaving ? "Saving…" : adoptNext ? "Saved — refreshing…" : `Save as v${base.version + 1}`}
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={reset} disabled={isSaving} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Discard changes
              </Button>
            )}
          </div>
        )}
      </DetailCard>

      <DetailCard>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-secondary/55">
          <Eye className="h-3.5 w-3.5" /> Preview
        </div>
        {previewVars.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {previewVars.map((v) => (
              <div key={v}>
                <Label htmlFor={`tpl-sample-${v}`} className="font-mono text-[11px]">{v}</Label>
                <Input
                  id={`tpl-sample-${v}`}
                  value={sampleValue(samples, v)}
                  onChange={(e) => setSamples((s) => ({ ...s, [v]: e.target.value }))}
                  placeholder="sample value"
                  className="mt-0.5 h-8 text-xs"
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 border border-brand-border bg-brand-tertiary/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-secondary/45">Your draft</div>
          {isEmail && subject && <p className="mt-1 text-sm font-semibold text-brand-secondary">{renderDraft(subject, samples)}</p>}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-secondary/80">{renderDraft(body, samples) || "—"}</p>
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={loadServerPreview} disabled={isPreviewing} className="gap-1.5">
            <ServerCog className="h-3.5 w-3.5" /> {isPreviewing ? "Rendering…" : `Render live v${base.version} on the server`}
          </Button>
          {serverPreview && (
            <div className="mt-3 border border-brand-border p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-secondary/45">
                Server render of the saved version (not your unsaved draft)
              </div>
              {serverPreview.title && <p className="mt-1 text-sm font-semibold">{serverPreview.title}</p>}
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-secondary/80">{serverPreview.body}</p>
            </div>
          )}
        </div>
      </DetailCard>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this the live template?</AlertDialogTitle>
            <AlertDialogDescription>
              Saves v{base.version + 1} of {event.eventKey} ({channelLabel(channel)}) and uses it for every new notification straight away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Save &amp; publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TotpStepUpDialog {...stepUp} />
    </>
  )
}
