"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlatformConfigSection } from "@/components/admin/config/platform-config-section"
import { MembershipPlansSection } from "@/components/admin/config/membership-plans-section"
import { AmenitiesSection } from "@/components/admin/config/amenities-section"
import { LocationsSection } from "@/components/admin/config/locations-section"

const TABS = [
  { value: "platform", label: "Platform values" },
  { value: "plans", label: "Membership plans" },
  { value: "locations", label: "Locations" },
  { value: "amenities", label: "Amenities" },
] as const
type TabValue = (typeof TABS)[number]["value"]

export default function ConfigPage() {
  return (
    <Suspense fallback={null}>
      <ConfigTabs />
    </Suspense>
  )
}

/** G8 — every admin-editable live setting, one tab per resource. Active tab lives in ?tab= so it survives reloads and links. */
function ConfigTabs() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const requested = searchParams.get("tab")
  const tab: TabValue = TABS.some((t) => t.value === requested) ? (requested as TabValue) : "platform"

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      className="space-y-6"
    >
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="platform">
        <PlatformConfigSection />
      </TabsContent>
      <TabsContent value="plans">
        <MembershipPlansSection />
      </TabsContent>
      <TabsContent value="locations">
        <LocationsSection />
      </TabsContent>
      <TabsContent value="amenities">
        <AmenitiesSection />
      </TabsContent>
    </Tabs>
  )
}
