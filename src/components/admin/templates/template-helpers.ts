import type { TemplateVersion } from "@/store/api/adminApi"

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  in_app: "In-app",
  sms: "SMS",
  push: "Push",
}

export const channelLabel = (channel: string) => CHANNEL_LABEL[channel] ?? channel

/** WhatsApp sends need a BSP-approved template name — the backend requires it on save, but seeded rows have none. */
export function needsWhatsappName(channel: string, template: Pick<TemplateVersion, "whatsappTemplateName">) {
  return channel === "whatsapp" && !template.whatsappTemplateName
}

export const BODY_MAX = 2000
export const SUBJECT_MAX = 150
/** Meta's rule for WhatsApp template names: lowercase letters, digits, underscores. */
export const WHATSAPP_NAME_PATTERN = /^[a-z0-9_]{1,512}$/

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g

/** Every `{{name}}` used in the text, in order of first appearance. */
export function usedVariables(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(VARIABLE_PATTERN), (m) => m[1])))
}

/**
 * `{{…}}` fragments that aren't a valid placeholder — `{{user-name}}`,
 * `{{ }}`, a stray `{{name}` — would go out to users as literal braces, and
 * the unknown-variable check never sees them because they don't parse.
 */
export function malformedPlaceholders(text: string): string[] {
  const found = new Set(text.replace(VARIABLE_PATTERN, "").match(/\{\{[^{}]{0,40}\}?\}?|\}\}/g) ?? [])
  // {{{name}}} renders as "{value}" — the outer braces leak into the message.
  for (const m of text.match(/\{\{\{[^{}]*\}\}\}/g) ?? []) found.add(m)
  return Array.from(found)
}

/**
 * Own-property lookup — variable names come from free text, so a plain
 * `values[name]` would hit Object.prototype for `{{constructor}}` /
 * `{{toString}}` and crash the page (`.trim` of a function).
 */
export function sampleValue(values: Record<string, string>, name: string): string {
  return Object.hasOwn(values, name) && typeof values[name] === "string" ? values[name] : ""
}

/** Renders a draft locally, the way the server preview would — missing values show as <name>. Output is plain text; callers render it as text, never HTML. */
export function renderDraft(text: string, values: Record<string, string>): string {
  return text.replace(VARIABLE_PATTERN, (_, name: string) => sampleValue(values, name).trim() || `<${name}>`)
}
