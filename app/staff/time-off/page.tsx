"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { clsx } from "clsx";

const LEAVE_TYPES = [
  { value: "time_off", label: "Time Off", icon: "🏖️", description: "Holiday, personal day, etc." },
  { value: "sick_leave", label: "Sick Leave", icon: "🤒", description: "Illness, medical appointment" },
  { value: "personal", label: "Personal", icon: "👤", description: "Personal matter" },
  { value: "other", label: "Other", icon: "📋", description: "Other reason" },
];

const LEAVE_LABELS: Record<string, string> = {
  time_off: "Time Off",
  sick_leave: "Sick Leave",
  personal: "Personal",
  holiday: "Holiday",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  denied: "bg-red-50 text-red-700",
};

const LEAVE_BADGE_STYLES: Record<string, string> = {
  time_off: "bg-blue-50 text-blue-700",
  sick_leave: "bg-purple-50 text-purple-700",
  personal: "bg-neutral-100 text-neutral-700",
  holiday: "bg-green-50 text-green-700",
  other: "bg-neutral-100 text-neutral-600",
};

function calcHourTiles(shifts: any[], requests: any[]) {
  // Scope to current week only
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const weekShifts = shifts.filter((s) => s.date >= weekStartStr && s.date <= weekEndStr);
  const approved = requests.filter(
    (r) => r.status === "approved" && r.end_date >= weekStartStr && r.start_date <= weekEndStr
  );

  // Build a map: date -> leave_type for approved leave days
  const leaveDayType: Record<string, string> = {};
  for (const req of approved) {
    const start = new Date(req.start_date);
    const end = new Date(req.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      leaveDayType[ds] = req.leave_type;
    }
  }

  let totalScheduled = 0;
  let vacationHours = 0;
  let sickHours = 0;

  for (const shift of weekShifts) {
    const h = shift.scheduled_hours || 0;
    totalScheduled += h;
    const leaveType = leaveDayType[shift.date];
    if (leaveType === "sick_leave") sickHours += h;
    else if (leaveType) vacationHours += h; // time_off, personal, holiday, other
  }

  const workableHours = totalScheduled - vacationHours - sickHours;
  return { totalScheduled, workableHours, vacationHours, sickHours };
}

export default function StaffTimeOffPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leave_type: "time_off",
    start_date: "",
    end_date: "",
    reason: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/staff/time-off").then((r) => r.json()),
      fetch("/api/staff/shifts").then((r) => r.json()),
    ]).then(([toData, shiftsData]) => {
      setRequests(toData.data || []);
      setShifts(shiftsData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/staff/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        setRequests((prev) => [data.data, ...prev]);
        setShowForm(false);
        setForm({ leave_type: "time_off", start_date: "", end_date: "", reason: "" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-neutral-900">Time Off</h1>
            <nav className="flex gap-1">
              <Link href="/staff/shifts" className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Shifts</Link>
              <Link href="/staff/time-off" className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md">Time Off</Link>
              <Link href="/staff/availability" className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Availability</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Hours summary tiles */}
        {!loading && (() => {
          const { totalScheduled, workableHours, vacationHours, sickHours } = calcHourTiles(shifts, requests);
          return (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white rounded-lg border border-neutral-200 p-3 text-center">
                <p className="text-2xl font-bold text-neutral-900">{totalScheduled.toFixed(1)}h</p>
                <p className="text-xs text-neutral-500 mt-0.5">Total scheduled</p>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{workableHours.toFixed(1)}h</p>
                <p className="text-xs text-neutral-500 mt-0.5">Workable hours</p>
              </div>
              <div className="bg-white rounded-lg border border-blue-200 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{vacationHours.toFixed(1)}h</p>
                <p className="text-xs text-neutral-500 mt-0.5">Vacation leave</p>
              </div>
              <div className="bg-white rounded-lg border border-purple-200 p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{sickHours.toFixed(1)}h</p>
                <p className="text-xs text-neutral-500 mt-0.5">Sick leave</p>
              </div>
            </div>
          );
        })()}

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 mb-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Submit a Request
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-neutral-200 p-4 mb-4 space-y-4">
            {/* Leave type selector */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {LEAVE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, leave_type: type.value }))}
                    className={clsx(
                      "px-3 py-2.5 rounded-lg border text-left transition-colors",
                      form.leave_type === type.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-neutral-200 hover:bg-neutral-50"
                    )}
                  >
                    <span className="text-base">{type.icon}</span>
                    <p className={clsx(
                      "text-sm font-medium mt-0.5",
                      form.leave_type === type.value ? "text-blue-700" : "text-neutral-900"
                    )}>
                      {type.label}
                    </p>
                    <p className="text-xs text-neutral-400">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">From</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: f.end_date || e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">To</label>
                <input
                  type="date"
                  required
                  value={form.end_date}
                  min={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {form.leave_type === "sick_leave" ? "Details (optional)" : "Reason (optional)"}
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={
                  form.leave_type === "sick_leave"
                    ? "e.g., Flu, doctor appointment"
                    : "e.g., Family event"
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        )}

        {/* Requests list */}
        {loading ? (
          <p className="text-neutral-400 text-center py-8">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-neutral-400 text-center py-8">No requests yet</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req: any) => (
              <div key={req.id} className="bg-white rounded-lg border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        "px-2 py-0.5 text-xs font-medium rounded-full",
                        LEAVE_BADGE_STYLES[req.leave_type] || LEAVE_BADGE_STYLES.other
                      )}>
                        {LEAVE_LABELS[req.leave_type] || "Time Off"}
                      </span>
                      <span className={clsx(
                        "px-2 py-0.5 text-xs font-medium rounded-full capitalize",
                        STATUS_STYLES[req.status] || ""
                      )}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-neutral-900">
                      {new Date(req.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {req.start_date !== req.end_date && (
                        <> - {new Date(req.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                      )}
                    </p>
                    {req.reason && <p className="text-xs text-neutral-500 mt-0.5">{req.reason}</p>}
                  </div>
                </div>
                {req.review_note && (
                  <p className="text-xs text-neutral-400 mt-2 border-t border-neutral-100 pt-2">
                    Manager: {req.review_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
