type NotFoundCardProps = {
  label: string
  id: string
}

export function NotFoundCard({ label, id }: NotFoundCardProps) {
  return (
    <div className="border border-brand-border bg-card p-8 text-center text-sm text-brand-muted-foreground">
      {label} <span className="font-mono">{id}</span> not found — it may have been deleted, or the link is wrong.
    </div>
  )
}
