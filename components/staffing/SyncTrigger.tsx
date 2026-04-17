"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible component that triggers a booking data sync on mount.
 * After sync completes, refreshes the page to show updated data.
 */
export function SyncTrigger({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    async function sync() {
      try {
        const res = await fetch("/api/schedules/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ week_start: weekStart }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data?.synced && data.data?.days_synced > 0) {
            setSynced(true);
            router.refresh(); // Refresh server component data
          }
        }
      } catch {
        // Non-blocking
      }
    }
    sync();
  }, [weekStart, router]);

  if (!synced) return null;

  return (
    <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
      Booking data refreshed from Tableo
    </div>
  );
}
