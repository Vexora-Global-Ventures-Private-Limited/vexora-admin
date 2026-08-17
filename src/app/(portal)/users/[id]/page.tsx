"use client"

import { use } from "react"
import { Mail, Building2, TrendingUp, Wallet, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { NotFoundCard } from "@/components/admin/not-found-card"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import { ROUTES } from "@/lib/routes"

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const initial = useAdminDataStore((s) => s.users.find((u) => u.id === id))
  const toggleUserStatus = useAdminDataStore((s) => s.toggleUserStatus)
  const stepUp = useStepUp()

  if (!initial) {
    return <NotFoundCard label="User" id={id} />
  }

  const suspending = initial.status !== "Suspended"
  const confirmToggle = () =>
    stepUp.run(() => {
      toggleUserStatus(id)
      toast[suspending ? "warning" : "success"](suspending ? "User suspended" : "User reinstated", {
        description: "Mirrors the production session-revocation path (audit-logged).",
      })
    })

  const stats = [
    { label: "Listings", value: initial.listings, icon: Building2 },
    { label: "Leads", value: initial.leads, icon: TrendingUp },
    { label: "Payments", value: initial.payments, icon: Wallet },
    { label: "Reports", value: initial.reports, icon: ShieldAlert },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.users} label="All users" />

      <DetailCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-ink-black to-brand-secondary text-sm font-bold text-brand-primary">
              {initial.name.split(" ").map((n) => n.charAt(0)).join("").slice(0, 2)}
            </div>
            <div>
              <div className="font-serif text-xl font-bold text-brand-secondary">{initial.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-brand-secondary/55">
                <Mail className="h-3 w-3" /> {initial.email}
              </div>
            </div>
          </div>
          <StatusPill tone={initial.status === "Active" ? "success" : initial.status === "Pending" ? "warning" : "danger"}>{initial.status}</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-brand-tertiary/40 p-3 text-center">
              <s.icon className="mx-auto h-4 w-4 text-brand-primary-dark" />
              <div className="mt-1 font-serif text-lg font-bold text-brand-secondary">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border border-brand-border p-4 text-sm">
          <div>
            <div className="font-bold text-brand-secondary">Tier</div>
            <div className="text-brand-secondary/55">{initial.tier} · joined {initial.joinedAt}</div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={initial.status === "Suspended" ? "default" : "destructive"}>
                {initial.status === "Suspended" ? "Reinstate user" : "Suspend user"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{initial.status === "Suspended" ? "Reinstate this user?" : "Suspend this user?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {initial.status === "Suspended"
                    ? "Their sessions and listing visibility are restored."
                    : "Their sessions are revoked and listings hidden where applicable."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmToggle}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DetailCard>
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
