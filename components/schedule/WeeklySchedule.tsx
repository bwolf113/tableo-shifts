"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import type { Restaurant, Employee, Shift, ScheduleWeek } from "@/types";
import { AddShiftModal } from "./AddShiftModal";
import { EditShiftModal } from "./EditShiftModal";
import { clsx } from "clsx";

interface WeeklyScheduleProps {
  restaurant: Restaurant;
  employees: Employee[];
  canEdit: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  server: "Server", bartender: "Bartender", host: "Host", runner: "Runner",
  busser: "Busser", line_cook: "Line Cook", prep_cook: "Prep Cook",
  sous_chef: "Sous Chef", head_chef: "Head Chef", dishwasher: "Dishwasher",
  manager: "Manager", assistant_manager: "Asst. Mgr", barista: "Barista",
  sommelier: "Sommelier", other: "Other",
};

export function WeeklySchedule({
  restaurant,
  employees,
  canEdit,
}: WeeklyScheduleProps) {
  const searchParams = useSearchParams();
  const highlightEmployeeParam = searchParams.get("highlight_employee");

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [scheduleWeek, setScheduleWeek] = useState<ScheduleWeek | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [coversByDate, setCoversByDate] = useState<Record<string, number>>({});
  const [approvedLeaveIds, setApprovedLeaveIds] = useState<Set<string>>(new Set());
  const [pendingLeaveIds, setPendingLeaveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissingAlert, setDismissingAlert] = useState(false);
  const [showAddModal, setShowAddModal] = useState<{ date: string } | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ warnings: string[]; summary: any } | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(new Date(currentWeekStart), i)
  );

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, approvedRes, pendingRes] = await Promise.all([
        fetch(`/api/shifts?week_start=${currentWeekStart}`),
        fetch(`/api/time-off?week_start=${currentWeekStart}&status=approved`),
        fetch(`/api/time-off?week_start=${currentWeekStart}&status=pending`),
      ]);
      if (schedRes.ok) {
        const data = await schedRes.json();
        setScheduleWeek(data.data.schedule_week);
        setShifts(data.data.shifts);
        setCoversByDate(data.data.covers_by_date || {});
      }
      // Store "employeeId|date" keys so we only flag the specific days on leave
      const approvedKeys = new Set<string>();
      const pendingKeys = new Set<string>();

      const expandLeaveRequest = (r: { employee_id: string; start_date: string; end_date: string }, target: Set<string>) => {
        const start = new Date(r.start_date + "T00:00:00");
        const end = new Date(r.end_date + "T00:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          target.add(`${r.employee_id}|${d.toISOString().split("T")[0]}`);
        }
      };

      if (approvedRes.ok) {
        const d = await approvedRes.json();
        (d.data || []).forEach((r: { employee_id: string; start_date: string; end_date: string }) => expandLeaveRequest(r, approvedKeys));
      }
      if (pendingRes.ok) {
        const d = await pendingRes.json();
        (d.data || []).forEach((r: { employee_id: string; start_date: string; end_date: string }) => expandLeaveRequest(r, pendingKeys));
      }
      if (highlightEmployeeParam) {
        // Highlight all days of the week for this employee
        for (let i = 0; i < 7; i++) {
          const d = addDays(new Date(currentWeekStart), i);
          approvedKeys.add(`${highlightEmployeeParam}|${format(d, "yyyy-MM-dd")}`);
        }
      }
      setApprovedLeaveIds(approvedKeys);
      setPendingLeaveIds(pendingKeys);
    } catch (err) {
      console.error("Failed to fetch schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart, highlightEmployeeParam]);

  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Auto-sync booking data then fetch schedule
  const syncAndFetch = useCallback(async () => {
    // Trigger background sync (non-blocking — will auto-generate draft if needed)
    setSyncing(true);
    try {
      const syncRes = await fetch("/api/schedules/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: currentWeekStart }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.data?.synced) {
          setLastSynced(new Date().toLocaleTimeString());
          if (syncData.data.auto_generated) {
            // A draft was just auto-generated — reload to show it
          }
        }
      }
    } catch {
      // Sync failure is non-blocking
    } finally {
      setSyncing(false);
    }

    // Always fetch the schedule (whether sync succeeded or not)
    await fetchSchedule();
  }, [currentWeekStart, fetchSchedule]);

  useEffect(() => {
    syncAndFetch();
    // Poll every 30 minutes to pick up new bookings / cancellations
    const interval = setInterval(syncAndFetch, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncAndFetch]);

  const handleUnpublish = async () => {
    if (!scheduleWeek || unpublishing) return;
    setUnpublishing(true);
    try {
      const res = await fetch("/api/schedules/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: currentWeekStart }),
      });
      if (res.ok) {
        const data = await res.json();
        setScheduleWeek(data.data.schedule_week);
      }
    } catch (err) {
      console.error("Unpublish failed:", err);
    } finally {
      setUnpublishing(false);
    }
  };

  const handleDismissAlert = async () => {
    if (!scheduleWeek || dismissingAlert) return;
    setDismissingAlert(true);
    try {
      await fetch("/api/schedules/dismiss-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: currentWeekStart }),
      });
      setScheduleWeek((prev) => prev ? { ...prev, booking_alert: null } : prev);
    } catch {
      // non-blocking
    } finally {
      setDismissingAlert(false);
    }
  };

  const goToPrevWeek = () => {
    const prev = subWeeks(new Date(currentWeekStart), 1);
    setCurrentWeekStart(format(prev, "yyyy-MM-dd"));
  };

  const goToNextWeek = () => {
    const next = addWeeks(new Date(currentWeekStart), 1);
    setCurrentWeekStart(format(next, "yyyy-MM-dd"));
  };

  const goToThisWeek = () => {
    const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    setCurrentWeekStart(format(thisWeek, "yyyy-MM-dd"));
  };

  const handlePublish = async () => {
    if (!scheduleWeek || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/schedules/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: currentWeekStart }),
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleWeek(data.data.schedule_week);
      } else if (res.status === 422 && data.violations) {
        const forcePublish = window.confirm(
          `${data.violations.length} compliance issue(s) found:\n\n` +
          data.violations.map((v: { message: string }) => `- ${v.message}`).join("\n") +
          "\n\nPublish anyway?"
        );
        if (forcePublish) {
          const forceRes = await fetch("/api/schedules/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ week_start: currentWeekStart, force: true }),
          });
          if (forceRes.ok) {
            const forceData = await forceRes.json();
            setScheduleWeek(forceData.data.schedule_week);
          }
        }
      } else {
        alert(data.error || "Failed to publish");
      }
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerate = async () => {
    const hasShifts = shifts.length > 0;
    if (hasShifts) {
      const confirm = window.confirm(
        `This will replace the ${shifts.length} existing shift(s) with an optimised schedule based on your bookings and staff.\n\nContinue?`
      );
      if (!confirm) return;
    }

    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: currentWeekStart,
          clear_existing: hasShifts,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setGenResult({ warnings: data.data.warnings, summary: data.data.summary });
        await fetchSchedule(); // Reload shifts
      } else {
        alert(data.error || data.message || "Generation failed");
      }
    } catch (err) {
      console.error("Generate failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const [copying, setCopying] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ sent: number; skipped: number } | null>(null);

  const handleCopyPreviousWeek = async () => {
    const hasShifts = shifts.length > 0;
    if (hasShifts) {
      const confirm = window.confirm(
        `This will replace the ${shifts.length} existing shift(s) with a copy of last week's schedule.\n\nContinue?`
      );
      if (!confirm) return;
    }

    setCopying(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/schedules/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_week_start: currentWeekStart,
          clear_existing: hasShifts,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setGenResult({
          warnings: data.data.skipped_closed_days > 0
            ? [`${data.data.skipped_closed_days} shift(s) skipped (restaurant closed on those days)`]
            : [],
          summary: {
            total_shifts: data.data.shifts_copied,
            total_hours: 0,
            total_cost: 0,
            employees_scheduled: 0,
            unfilled_roles: [],
            copied_from: data.data.source_week,
          },
        });
        await fetchSchedule();
      } else {
        alert(data.error || data.message || "Copy failed");
      }
    } catch (err) {
      console.error("Copy failed:", err);
    } finally {
      setCopying(false);
    }
  };

  const handleNotifyStaff = async () => {
    if (notifying) return;
    setNotifying(true);
    setNotifyResult(null);
    try {
      const res = await fetch("/api/schedules/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: currentWeekStart }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotifyResult(data.data);
      } else {
        alert(data.error || "Failed to send notifications");
      }
    } catch {
      alert("Failed to send notifications");
    } finally {
      setNotifying(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
      if (res.ok) {
        setShifts((prev) => prev.filter((s) => s.id !== shiftId));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getShiftsForDate = (dateStr: string) =>
    shifts.filter((s) => s.date === dateStr);

  const isClosedDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dayHours = restaurant.opening_hours.find((h) => h.day === dayOfWeek);
    return dayHours?.closed ?? false;
  };

  // Calculate week totals
  const totalHours = shifts.reduce((sum, s) => sum + s.scheduled_hours, 0);
  const totalCost = shifts.reduce((sum, s) => sum + s.estimated_cost, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Schedule</h1>
          <p className="text-neutral-500 mt-1">
            Week of {format(new Date(currentWeekStart), "MMM d, yyyy")}
            {scheduleWeek?.status === "published" && (
              <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
                Published
              </span>
            )}
            {scheduleWeek?.status === "draft" && (
              <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                Draft
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week totals + sync status */}
          <div className="text-right mr-4 text-sm text-neutral-500">
            <p>{totalHours.toFixed(1)}h total &middot; {restaurant.currency} {totalCost.toFixed(2)} labour</p>
            <p className="text-xs text-neutral-400">
              {syncing ? (
                "Syncing bookings..."
              ) : lastSynced ? (
                `Bookings synced ${lastSynced}`
              ) : null}
            </p>
          </div>

          {/* Navigation */}
          <button
            onClick={goToPrevWeek}
            className="p-2 hover:bg-neutral-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={goToThisWeek}
            className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50"
          >
            Today
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-neutral-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Copy Previous Week */}
          {canEdit && scheduleWeek?.status === "draft" && (
            <button
              onClick={handleCopyPreviousWeek}
              disabled={copying}
              className="ml-2 px-3 py-2 text-sm font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
            >
              {copying ? "Copying..." : "Copy Last Week"}
            </button>
          )}

          {/* Generate */}
          {canEdit && scheduleWeek?.status === "draft" && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : shifts.length > 0 ? "Regenerate" : "Auto-Generate"}
            </button>
          )}

          {/* Revert to draft (published schedule) */}
          {canEdit && scheduleWeek?.status === "published" && (
            <button
              onClick={handleUnpublish}
              disabled={unpublishing}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {unpublishing ? "Reverting..." : "Edit Schedule"}
            </button>
          )}

          {/* Publish */}
          {canEdit && scheduleWeek?.status === "draft" && shifts.length > 0 && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          )}

          {/* Notify staff + Print */}
          {shifts.length > 0 && scheduleWeek?.status === "published" && (
            <button
              onClick={handleNotifyStaff}
              disabled={notifying}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              title="Email schedule to all staff"
            >
              <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              {notifying ? "Sending..." : "Notify Staff"}
            </button>
          )}
          {shifts.length > 0 && (
            <a
              href={`/dashboard/schedule/print?week_start=${currentWeekStart}`}
              className="p-2 hover:bg-neutral-100 rounded-lg"
              title="Print schedule"
            >
              <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Generation result banner */}
      {genResult && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {genResult.summary.copied_from ? (
                  <>Copied {genResult.summary.total_shifts} shifts from week of {genResult.summary.copied_from}</>
                ) : (
                  <>Schedule generated: {genResult.summary.total_shifts} shifts,{" "}
                  {genResult.summary.total_hours}h total,{" "}
                  {restaurant.currency} {genResult.summary.total_cost} labour cost,{" "}
                  {genResult.summary.employees_scheduled} employees scheduled</>
                )}
              </p>
              {genResult.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {genResult.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                      <span className="mt-0.5">&#9888;</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
              {genResult.summary.unfilled_roles.length > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {genResult.summary.unfilled_roles.length} open shift(s) created
                  where no matching staff was available
                </p>
              )}
            </div>
            <button
              onClick={() => setGenResult(null)}
              className="text-blue-400 hover:text-blue-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Notify staff result */}
      {notifyResult && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center justify-between">
          <p className="text-sm text-green-800">
            Schedule sent to <strong>{notifyResult.sent}</strong> staff member{notifyResult.sent !== 1 ? "s" : ""}
            {notifyResult.skipped > 0 && ` (${notifyResult.skipped} skipped — no email address)`}
          </p>
          <button onClick={() => setNotifyResult(null)} className="text-green-400 hover:text-green-600 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Booking change alert banner */}
      {scheduleWeek?.status === "published" && scheduleWeek.booking_alert && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-amber-500 text-lg">⚠</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Bookings have changed since this schedule was published
                </p>
                <ul className="mt-2 space-y-1">
                  {Object.entries(scheduleWeek.booking_alert)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, change]) => (
                      <li key={date} className="text-xs text-amber-800">
                        <span className="font-medium">
                          {format(new Date(date), "EEE d MMM")}:
                        </span>{" "}
                        {change.at_publish} covers at publish →{" "}
                        <span className={change.diff > 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                          {change.current} covers now
                        </span>{" "}
                        ({change.diff > 0 ? "+" : ""}{change.diff})
                      </li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-amber-700">
                  Click <strong>Edit Schedule</strong> above to revert to draft, then regenerate or adjust shifts and republish.
                </p>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={handleDismissAlert}
                disabled={dismissingAlert}
                className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
              >
                {dismissingAlert ? "Dismissing..." : "Dismiss"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Week Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-400">Loading schedule...</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const closed = isClosedDay(day);
            const dayShifts = getShiftsForDate(dateStr);
            const isToday =
              format(new Date(), "yyyy-MM-dd") === dateStr;

            return (
              <div
                key={dateStr}
                className={clsx(
                  "rounded-lg border min-h-[200px]",
                  closed
                    ? "bg-neutral-50 border-neutral-200"
                    : isToday
                      ? "bg-blue-50/50 border-blue-200"
                      : "bg-white border-neutral-200"
                )}
              >
                {/* Day header */}
                <div
                  className={clsx(
                    "px-3 py-2 border-b text-sm font-medium",
                    closed
                      ? "text-neutral-400 border-neutral-200"
                      : isToday
                        ? "text-blue-700 border-blue-200"
                        : "text-neutral-700 border-neutral-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {format(day, "EEE")}
                      <span className="ml-1 text-xs font-normal">
                        {format(day, "d MMM")}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!closed && coversByDate[dateStr] != null && coversByDate[dateStr] > 0 && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {coversByDate[dateStr]} covers
                        </span>
                      )}
                      {closed && (
                        <span className="text-xs text-neutral-400">Closed</span>
                      )}
                      {!closed && dayShifts.length > 0 && (
                        <span className="text-xs text-neutral-400">
                          {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shifts */}
                <div className="p-2 space-y-1">
                  {!closed &&
                    dayShifts.map((shift) => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        canEdit={canEdit}
                        leaveStatus={
                          shift.employee_id && approvedLeaveIds.has(`${shift.employee_id}|${dateStr}`)
                            ? "approved"
                            : shift.employee_id && pendingLeaveIds.has(`${shift.employee_id}|${dateStr}`)
                              ? "pending"
                              : undefined
                        }
                        onClick={() => canEdit && setEditingShift(shift)}
                        onDelete={() => handleDeleteShift(shift.id)}
                      />
                    ))}

                  {/* Add shift button */}
                  {!closed && canEdit && (
                    <button
                      onClick={() => setShowAddModal({ date: dateStr })}
                      className="w-full py-1.5 text-xs text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors border border-dashed border-neutral-200 hover:border-blue-300"
                    >
                      + Add shift
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Shift Modal */}
      {showAddModal && (
        <AddShiftModal
          date={showAddModal.date}
          employees={employees}
          restaurant={restaurant}
          onClose={() => setShowAddModal(null)}
          onCreated={(shift) => {
            setShifts((prev) => [...prev, shift]);
            setShowAddModal(null);
          }}
        />
      )}

      {/* Edit Shift Modal */}
      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          employees={employees}
          restaurant={restaurant}
          onClose={() => setEditingShift(null)}
          onUpdated={(updated) => {
            const emp = employees.find((e) => e.id === updated.employee_id);
            setShifts((prev) =>
              prev.map((s) => (s.id === updated.id ? ({ ...updated, employee: emp } as Shift) : s))
            );
            setEditingShift(null);
          }}
          onDeleted={(shiftId) => {
            setShifts((prev) => prev.filter((s) => s.id !== shiftId));
            setEditingShift(null);
          }}
        />
      )}
    </div>
  );
}

function LeaveWarningIcon({ status }: { status: "approved" | "pending" }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative shrink-0"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={clsx("cursor-default text-xs", status === "approved" ? "text-amber-500" : "text-pink-500")}>⚠</span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-normal text-white bg-neutral-800 rounded whitespace-nowrap pointer-events-none z-50">
          {status === "approved" ? "On approved leave" : "Leave request pending"}
        </span>
      )}
    </span>
  );
}

function ShiftCard({
  shift,
  canEdit,
  leaveStatus,
  onClick,
  onDelete,
}: {
  shift: Shift;
  canEdit: boolean;
  leaveStatus?: "approved" | "pending";
  onClick: () => void;
  onDelete: () => void;
}) {
  const employee = shift.employee;
  const isOpen = shift.is_open || !shift.employee_id;
  const name = employee
    ? `${employee.first_name} ${employee.last_name[0]}.`
    : null;

  if (isOpen) {
    // Open shift — visually distinct
    return (
      <div
        onClick={onClick}
        className={clsx(
          "px-2 py-1.5 rounded text-xs group relative border border-dashed cursor-pointer",
          "bg-red-50/60 border-red-300 hover:bg-red-50"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-red-600 truncate">
            Open — needs staff
          </span>
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-red-400">
          {shift.start_time} - {shift.end_time}
        </p>
        <p className="text-red-400">
          {ROLE_LABELS[shift.role] || shift.role}
        </p>
      </div>
    );
  }

  // Assigned shift
  return (
    <div
      onClick={onClick}
      className={clsx(
        "px-2 py-1.5 rounded text-xs group relative cursor-pointer",
        leaveStatus === "approved"
          ? "bg-amber-50 border-l-2 border-amber-400 hover:bg-amber-100/70 ring-1 ring-amber-300"
          : leaveStatus === "pending"
            ? "bg-pink-50 border-l-2 border-pink-400 hover:bg-pink-100/70 ring-1 ring-pink-300"
            : shift.department === "foh"
              ? "bg-blue-50 border-l-2 border-blue-400 hover:bg-blue-100/70"
              : "bg-orange-50 border-l-2 border-orange-400 hover:bg-orange-100/70"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <span className={clsx(
            "font-medium truncate",
            leaveStatus === "approved" ? "text-amber-800" : leaveStatus === "pending" ? "text-pink-800" : "text-neutral-800"
          )}>
            {name}
          </span>
          {leaveStatus && <LeaveWarningIcon status={leaveStatus} />}
        </div>
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-neutral-500">
        {shift.start_time} - {shift.end_time}
      </p>
      <p className="text-neutral-400">
        {ROLE_LABELS[shift.role] || shift.role}
        {shift.is_training && " (Training)"}
      </p>
    </div>
  );
}
