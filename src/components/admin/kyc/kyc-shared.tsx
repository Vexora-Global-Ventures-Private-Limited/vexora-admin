"use client"

import { FileText } from "lucide-react"
import { isSafeHttpsUrl } from "@/components/admin/moderation/shared"
import { useAdminSession } from "@/lib/admin-session"
import { DOCUMENT_LABEL, type KycDocument } from "./kyc-api"

/** Approve/reject KYC: backend `requireRole("super_admin", "moderator")`. */
export function useCanReviewKyc() {
  return useAdminSession((s) => s.adminUser?.role === "super_admin" || s.adminUser?.role === "moderator")
}

export const documentLabel = (type: string) => DOCUMENT_LABEL[type] ?? type.toUpperCase()

const looksLikeImage = (url: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) || /\/image\/upload\//.test(url)

/**
 * One submitted document. The web uploads to Cloudinary and sends the https
 * URL as `cloudinaryPublicId`, so it's usually directly viewable; a bare
 * public id (no URL) is shown as text.
 */
export function KycDocumentTile({ doc }: { doc: KycDocument }) {
  const url = isSafeHttpsUrl(doc.ref) ? doc.ref : null
  return (
    <div className="min-w-0 bg-brand-tertiary/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{documentLabel(doc.type)}</div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block" title="Open full size in a new tab">
          {looksLikeImage(url) ? (
            <img src={url} alt={documentLabel(doc.type)} referrerPolicy="no-referrer" className="h-40 w-full bg-card object-contain ring-1 ring-brand-border" />
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark underline">
              <FileText className="h-3.5 w-3.5" /> Open document
            </span>
          )}
        </a>
      ) : (
        <p className="mt-1 break-all font-mono text-[11px] text-brand-secondary/70">{doc.ref || "No file reference"}</p>
      )}
    </div>
  )
}
