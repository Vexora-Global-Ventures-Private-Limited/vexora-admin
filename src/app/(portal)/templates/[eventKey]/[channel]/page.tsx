"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ROUTES } from "@/lib/routes"

// Templates feature disabled for now — see ../page.tsx. Uncomment the block
// below to re-enable.
export default function TemplateEditorPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(ROUTES.dashboard)
  }, [router])
  return null
}

/*
import { use, useState } from "react"
import { Eye, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { NotFoundCard } from "@/components/admin/not-found-card"
import { useAdminDataStore } from "@/lib/admin-data-store"

export default function TemplateEditorPage({ params }: { params: Promise<{ eventKey: string; channel: string }> }) {
  const { eventKey, channel } = use(params)
  const initial = useAdminDataStore((s) => s.templates.find((t) => t.eventKey === eventKey && t.channel === channel))
  const saveTemplateVersion = useAdminDataStore((s) => s.saveTemplateVersion)
  const [body, setBody] = useState(initial?.bodyPreview ?? "")

  if (!initial) {
    return <NotFoundCard label="Template" id={`${eventKey}/${channel}`} />
  }

  const save = () => {
    saveTemplateVersion(eventKey, initial.channel, body)
    toast.success(`Saved as v${initial.version + 1}`, { description: "Audit-logged." })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.templates} label="All templates" />

      <DetailCard>
        <div className="font-serif text-xl font-bold text-brand-secondary">{initial.eventLabel}</div>
        <div className="mt-1 text-xs text-brand-secondary/55">
          {initial.eventKey} · {initial.channel} · currently v{initial.version}
        </div>

        <label className="mt-5 block text-[11px] font-semibold uppercase tracking-wide text-brand-secondary/50">
          Body {initial.channel === "whatsapp" && "— must map to a BSP-approved template name"}
        </label>
        <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1.5" aria-label="Template body" />

        <div className="mt-4 border border-brand-border bg-brand-tertiary/40 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-secondary/55">
            <Eye className="h-3.5 w-3.5" /> Live preview
          </div>
          <p className="text-sm text-brand-secondary/80">{body}</p>
        </div>

        <Button onClick={save} className="btn-gold mt-5 gap-1.5">
          <Save className="h-4 w-4" /> Save as new version
        </Button>
      </DetailCard>
    </div>
  )
}
*/
