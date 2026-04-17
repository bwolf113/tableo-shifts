"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import type { Restaurant, DailyStaffingData, Shift, TimeOffRequest } from "@/types";
import { clsx } from "clsx";

interface StaffingViewProps {
  restaurant: Restaurant;
  initialStaffingData: DailyStaffingData[];
  initialWeekStart: string;
}

const ROLE_LABELS: Record<string, string> = {
  server: "Servers", bartender: "Bartenders", host: "Hosts", runner: "Runners",
  line_cook: "Line Cooks", prep_cook: "Prep Cooks", dishwasher: "Dishwashers",
  sous_chef: "Sous Chefs", head_chef: "Head Chefs",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  understaffed: { bg: "bg-red-50", text: "text-red-700", label: "Understaffed" },
  optimal: { bg: "bg-green-50", text: "text-green-700", label: "Optimal" },
  overstaffed: { bg: "bg-amber-50", text: "text-amber-700", label: "Overstaffed" },
  unknown: { bg: "bg-neutral-50", text: "text-neutral-500", label: "No data" },
};

export function StaffingView({ restaurant, initialStaffingData, initialWeekStart }: StaffingViewProps) {
  const [weekStart, setWeekStart] = useState(() => new Date(initialWeekStart + "T00:00:00"));
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const isCurrentWeek = weekStartStr === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [staffingData, setStaffingData] = useState<DailyStaffingData[]>(initialStaffingData);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [liveShifts, setLiveShifts] = useState<Shift[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);

  const fetchWeekData = useCallback(async (weekStr: string) => {
    setLoading(true);
    try {
      const [staffRes, shiftsRes, toRes] = await Promise.all([
        fetch(`/api/staffing?date=${weekStr}&days=7`),
        fetch(`/api/shifts?week_start=${weekStr}`),
        fetch(`/api/time-off?week_start=${weekStr}&status=approved`),
      ]);
      const [staffJson, shiftsJson, toJson] = await Promise.all([
        staffRes.json(), shiftsRes.json(), toRes.json(),
      ]);
      setStaffingData(staffJson.data || []);
      setLiveShifts(shiftsJson.data?.shifts || []);
      setTimeOffRequests(toJson.data || []);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  const syncAndRefresh = useCallback(async (weekStr: string) => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/schedules/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStr }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.synced && data.data?.days_synced > 0) {
          setSyncMsg("Booking data refreshed from Tableo");
          await fetchWeekData(weekStr);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setSyncing(false);
    }
  }, [fetchWeekData]);

  const mounted = useRef(false);

  // Skip on first render (initial data already loaded server-side).
  // On any subsequent week change — including navigating back to the initial week — re-fetch from DB.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      // Still need live shifts/time-off for the initial week
      fetch(`/api/shifts?week_start=${weekStartStr}`).then(r => r.json()).then(d => setLiveShifts(d.data?.shifts || []));
      fetch(`/api/time-off?week_start=${weekStartStr}&status=approved`).then(r => r.json()).then(d => setTimeOffRequests(d.data || []));
      return;
    }
    fetchWeekData(weekStartStr).then(() => syncAndRefresh(weekStartStr));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartStr]);

  const goToPrev = () => setWeekStart(w => subWeeks(w, 1));
  const goToNext = () => setWeekStart(w => addWeeks(w, 1));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getLeaveEmployeeIds = (dateStr: string): Set<string> => {
    const ids = new Set<string>();
    for (const req of timeOffRequests) {
      if (req.start_date <= dateStr && req.end_date >= dateStr) ids.add(req.employee_id);
    }
    return ids;
  };

  const getEffectiveScheduled = (dateStr: string): Record<string, number> | null => {
    if (liveShifts.length === 0) return null;
    const onLeave = getLeaveEmployeeIds(dateStr);
    const counts: Record<string, number> = {};
    for (const shift of liveShifts) {
      if (shift.date === dateStr && shift.employee_id && !shift.is_open && !shift.is_training) {
        if (!onLeave.has(shift.employee_id)) {
          counts[shift.role] = (counts[shift.role] || 0) + 1;
        }
      }
    }
    return counts;
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE d MMM"),
      isClosed: restaurant.opening_hours.find((h) => h.day === date.getDay())?.closed ?? false,
    };
  });

  const dataByDate = new Map(staffingData.map((d) => [d.date, d]));
  const weekLabel = `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM yyyy")}`;

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="px-2.5 py-1 rounded-md border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-base leading-none"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-neutral-900 min-w-[160px] text-center">
            {weekLabel}
          </span>
          <button
            onClick={goToNext}
            className="px-2.5 py-1 rounded-md border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-base leading-none"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button
              onClick={goToToday}
              className="text-xs px-3 py-1.5 rounded-md border border-neutral-200 hover:bg-neutral-50 text-neutral-600"
            >
              Today
            </button>
          )}
          <button
            onClick={() => syncAndRefresh(weekStartStr)}
            disabled={syncing || loading}
            className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
          {syncMsg}
        </div>
      )}

      {loading && (
        <div className="text-sm text-neutral-400 text-center py-4">Loading…</div>
      )}

      {/* Summary bar */}
      {!loading && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {staffingData.reduce((sum, d) => sum + d.booked_covers, 0)}
              </p>
              <p className="text-xs text-neutral-500">Booked covers</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {staffingData.reduce((sum, d) => sum + d.booking_count, 0)}
              </p>
              <p className="text-xs text-neutral-500">Bookings</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {staffingData.length > 0
                  ? Math.round(
                      staffingData.reduce((sum, d) => sum + d.booked_covers, 0) /
                      (staffingData.filter((d) => d.booked_covers > 0).length || 1)
                    )
                  : 0}
              </p>
              <p className="text-xs text-neutral-500">Avg covers/day</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {restaurant.covers_per_staff.server || 15}:1
              </p>
              <p className="text-xs text-neutral-500">Covers per server</p>
            </div>
          </div>
        </div>
      )}

      {/* Info banner */}
      {!loading && staffingData.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-1">
            Connect your Tableo bookings
          </h3>
          <p className="text-sm text-blue-700">
            Staffing recommendations are powered by your Tableo booking data.
            Once connected, you will see recommended staffing levels for each day
            based on your covers, walk-in patterns, and covers-per-staff ratios.
          </p>
          <p className="text-sm text-blue-600 mt-2">
            Go to Settings to enter your Tableo API token and sync booking data.
          </p>
        </div>
      )}

      {/* Daily breakdown */}
      {!loading && (
        <div className="space-y-3">
          {weekDays.map(({ dateStr, label, isClosed }) => {
            const data = dataByDate.get(dateStr);
            const effectiveForStatus = getEffectiveScheduled(dateStr);
            const liveStatus = (() => {
              if (!data || Object.keys(data.recommended_staff).length === 0) return data?.staffing_status || "unknown";
              if (!effectiveForStatus) return data.staffing_status;
              const rec = data.recommended_staff as Record<string, number>;
              const totalRec = Object.values(rec).reduce((s, v) => s + v, 0);
              const totalSched = Object.keys(rec).reduce((s, role) => s + (effectiveForStatus[role] || 0), 0);
              if (totalRec === 0) return "unknown";
              const ratio = totalSched / totalRec;
              if (ratio < 0.85) return "understaffed";
              if (ratio > 1.15) return "overstaffed";
              return "optimal";
            })();
            const style = STATUS_STYLES[liveStatus];

            if (isClosed) {
              return (
                <div key={dateStr} className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-500">{label}</span>
                    <span className="text-xs text-neutral-400">Closed</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={dateStr}
                className={clsx(
                  "rounded-lg border p-4",
                  data ? style.bg : "bg-white",
                  data ? `border-${liveStatus === "understaffed" ? "red" : liveStatus === "optimal" ? "green" : liveStatus === "overstaffed" ? "amber" : "neutral"}-200` : "border-neutral-200"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-900">{label}</span>
                    {data && (
                      <span className={clsx("inline-flex px-2 py-0.5 text-xs font-medium rounded-full", style.bg, style.text)}>
                        {style.label}
                      </span>
                    )}
                  </div>
                  {data && (
                    <div className="text-right text-sm">
                      <span className="font-medium text-neutral-900">{data.booked_covers} covers</span>
                      <span className="text-neutral-400 ml-1">({data.booking_count} bookings)</span>
                    </div>
                  )}
                </div>

                {data && Object.keys(data.recommended_staff).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Object.entries(data.recommended_staff).map(([role, recommended]) => {
                      const effectiveScheduled = getEffectiveScheduled(dateStr);
                      const scheduled = effectiveScheduled !== null
                        ? (effectiveScheduled[role] || 0)
                        : (data.scheduled_staff as Record<string, number>)[role] || 0;
                      const diff = scheduled - (recommended as number);
                      return (
                        <div key={role} className="bg-white/80 rounded px-2 py-1.5 text-center">
                          <p className="text-xs text-neutral-500">{ROLE_LABELS[role] || role}</p>
                          <p className="text-sm font-medium">
                            <span className={clsx(diff < 0 ? "text-red-600" : diff > 0 ? "text-amber-600" : "text-green-600")}>
                              {scheduled}
                            </span>
                            <span className="text-neutral-400"> / </span>
                            <span className="text-neutral-600">{recommended as number}</span>
                          </p>
                          <p className="text-xs text-neutral-400">sched / need</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!data && (
                  <p className="text-xs text-neutral-400">No booking data synced yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
