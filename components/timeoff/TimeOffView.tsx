"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TimeOffRequest, Employee } from "@/types";
import { clsx } from "clsx";

interface TimeOffViewProps {
  requests: TimeOffRequest[];
  employeeMap: Record<string, Employee>;
  canManage: boolean;
  restaurantId: string;
}

const STATUS_STYLES = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  approved: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  denied: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const LEAVE_LABELS: Record<string, string> = {
  time_off: "Time Off",
  sick_leave: "Sick Leave",
  personal: "Personal",
  holiday: "Holiday",
  other: "Other",
};

const LEAVE_BADGE: Record<string, string> = {
  time_off: "bg-blue-50 text-blue-700",
  sick_leave: "bg-purple-50 text-purple-700",
  personal: "bg-neutral-100 text-neutral-700",
  holiday: "bg-green-50 text-green-700",
  other: "bg-neutral-100 text-neutral-600",
};

export function TimeOffView({
  requests,
  employeeMap,
  canManage,
  restaurantId,
}: TimeOffViewProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "denied">("all");

  const filtered = requests.filter(
    (r) => filter === "all" || r.status === filter
  );

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex bg-neutral-100 rounded-lg p-0.5 w-fit">
        {(["all", "pending", "approved", "denied"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "px-3 py-1.5 text-sm rounded-md transition-colors capitalize",
              filter === f
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            {f}
            {f === "pending" && pending.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500">No time-off requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              employee={employeeMap[request.employee_id]}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  employee,
  canManage,
}: {
  request: TimeOffRequest;
  employee: Employee | undefined;
  canManage: boolean;
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [conflict, setConflict] = useState<{
    shifts: Array<{ id: string; date: string; start_time: string; end_time: string; role: string }>;
    employee_name: string;
  } | null>(null);
  const [openingShifts, setOpeningShifts] = useState(false);
  const style = STATUS_STYLES[request.status];

  const ROLE_LABELS: Record<string, string> = {
    server: "Server", bartender: "Bartender", host: "Host", runner: "Runner",
    line_cook: "Line Cook", prep_cook: "Prep Cook", sous_chef: "Sous Chef",
    head_chef: "Head Chef", dishwasher: "Dishwasher", manager: "Manager",
    assistant_manager: "Asst. Mgr", barista: "Barista", sommelier: "Sommelier",
  };

  const handleReview = async (status: "approved" | "denied", autoOpen?: boolean) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/time-off/${request.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, auto_open_shifts: autoOpen }),
      });
      if (res.ok) {
        const data = await res.json();

        // Check for shift conflicts on approval
        if (
          status === "approved" &&
          data.conflicts?.has_conflicts &&
          !autoOpen
        ) {
          setConflict({
            shifts: data.conflicts.shifts,
            employee_name: data.conflicts.employee_name,
          });
          return; // Don't refresh yet — show the conflict dialog
        }

        router.refresh();
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenConflictingShifts = async () => {
    setOpeningShifts(true);
    // Re-call review with auto_open_shifts — the request is already approved,
    // but this endpoint is idempotent on the review and will open the shifts
    try {
      await fetch(`/api/time-off/${request.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", auto_open_shifts: true }),
      });
      setConflict(null);
      router.refresh();
    } finally {
      setOpeningShifts(false);
    }
  };

  const name = employee
    ? `${employee.first_name} ${employee.last_name}`
    : "Unknown";

  const startDate = new Date(request.start_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endDate = new Date(request.end_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isSingleDay = request.start_date === request.end_date;

  return (
    <div
      className={clsx(
        "bg-white rounded-lg border p-4",
        style.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {employee && (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium mt-0.5"
              style={{ backgroundColor: employee.color }}
            >
              {employee.first_name[0]}
              {employee.last_name[0]}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-neutral-900">{name}</p>
              {request.leave_type && request.leave_type !== "time_off" && (
                <span className={clsx(
                  "px-1.5 py-0.5 text-xs font-medium rounded-full",
                  LEAVE_BADGE[request.leave_type] || LEAVE_BADGE.other
                )}>
                  {LEAVE_LABELS[request.leave_type] || request.leave_type}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-600">
              {isSingleDay ? startDate : `${startDate} - ${endDate}`}
            </p>
            {request.reason && (
              <p className="text-sm text-neutral-500 mt-1">{request.reason}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize",
              style.bg,
              style.text
            )}
          >
            {request.status}
          </span>

          {canManage && request.status === "pending" && (
            <div className="flex gap-1 ml-2">
              <button
                onClick={() => handleReview("approved")}
                disabled={processing}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {processing ? "..." : "Approve"}
              </button>
              <button
                onClick={() => handleReview("denied")}
                disabled={processing}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shift conflict alert */}
      {conflict && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-2">
            {conflict.employee_name} has {conflict.shifts.length} shift{conflict.shifts.length !== 1 ? "s" : ""} during this leave:
          </p>
          <ul className="space-y-1 mb-3">
            {conflict.shifts.map((s) => (
              <li key={s.id} className="text-xs text-amber-800 flex items-center gap-2">
                <span className="font-medium">
                  {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span>{s.start_time} - {s.end_time}</span>
                <span className="text-amber-600">({ROLE_LABELS[s.role] || s.role})</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={handleOpenConflictingShifts}
              disabled={openingShifts}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {openingShifts ? "Opening..." : "Mark as Open Shifts"}
            </button>
            <a
              href={`/dashboard/schedule?highlight_employee=${request.employee_id}`}
              className="px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-800 rounded hover:bg-amber-100"
            >
              Go to Schedule
            </a>
            <button
              onClick={() => { setConflict(null); router.refresh(); }}
              className="px-3 py-1.5 text-xs text-amber-600 hover:text-amber-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
