"use client";

import { format, addDays } from "date-fns";
import type { Restaurant, Shift } from "@/types";

interface PrintScheduleProps {
  restaurant: Restaurant;
  weekStart: string;
  shifts: Shift[];
  status: string;
}

const ROLE_LABELS: Record<string, string> = {
  server: "Server", bartender: "Bartender", host: "Host", runner: "Runner",
  busser: "Busser", line_cook: "Line Cook", prep_cook: "Prep Cook",
  sous_chef: "Sous Chef", head_chef: "Head Chef", dishwasher: "Dishwasher",
  manager: "Manager", assistant_manager: "Asst. Mgr", barista: "Barista",
  sommelier: "Sommelier", other: "Other",
};

export function PrintSchedule({
  restaurant,
  weekStart,
  shifts,
  status,
}: PrintScheduleProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(weekStart), i);
    return {
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE d MMM"),
      isClosed:
        restaurant.opening_hours.find((h) => h.day === date.getDay())
          ?.closed ?? false,
    };
  });

  // Get unique employees from shifts, sorted by department then name
  const employeeMap = new Map<
    string,
    { id: string; name: string; role: string; department: string }
  >();

  for (const shift of shifts) {
    if (!shift.employee_id || !shift.employee) continue;
    if (!employeeMap.has(shift.employee_id)) {
      employeeMap.set(shift.employee_id, {
        id: shift.employee_id,
        name: `${shift.employee.first_name} ${shift.employee.last_name}`,
        role: shift.role,
        department: shift.department,
      });
    }
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) => {
    if (a.department !== b.department) return a.department === "foh" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Also collect open shifts
  const openShifts = shifts.filter((s) => s.is_open || !s.employee_id);

  const getShiftsForEmployeeDay = (empId: string, dateStr: string) =>
    shifts.filter(
      (s) => s.employee_id === empId && s.date === dateStr
    );

  const getOpenShiftsForDay = (dateStr: string) =>
    openShifts.filter((s) => s.date === dateStr);

  const totalHours = shifts.reduce((sum, s) => sum + s.scheduled_hours, 0);
  const totalCost = shifts.reduce((sum, s) => sum + s.estimated_cost, 0);

  return (
    <div className="print-schedule">
      {/* Print-only styles */}
      <style>{`
        @media print {
          nav, aside, .no-print { display: none !important; }
          body { background: white !important; }
          .print-schedule { padding: 0 !important; }
          .print-table { font-size: 9pt; }
          .print-table td, .print-table th { padding: 4px 6px; }
          @page { margin: 1cm; size: landscape; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Print Schedule
          </h1>
          <p className="text-neutral-500 mt-1">
            {restaurant.name} — Week of{" "}
            {format(new Date(weekStart), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50"
          >
            Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print header (visible only when printing) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">{restaurant.name}</h1>
        <p className="text-sm">
          Week of {format(new Date(weekStart), "MMMM d, yyyy")} &middot;{" "}
          {status === "published" ? "Published" : "Draft"} &middot;{" "}
          {totalHours.toFixed(1)}h total &middot;{" "}
          {restaurant.currency} {totalCost.toFixed(0)} labour
        </p>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto">
        <table className="print-table w-full border-collapse border border-neutral-300 text-sm">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-300 px-3 py-2 text-left font-semibold text-neutral-700 w-40">
                Employee
              </th>
              <th className="border border-neutral-300 px-3 py-2 text-left font-semibold text-neutral-700 w-20">
                Role
              </th>
              {weekDays.map(({ dateStr, label, isClosed }) => (
                <th
                  key={dateStr}
                  className={`border border-neutral-300 px-3 py-2 text-center font-semibold ${
                    isClosed ? "text-neutral-400 bg-neutral-50" : "text-neutral-700"
                  }`}
                >
                  {label}
                  {isClosed && (
                    <span className="block text-xs font-normal">Closed</span>
                  )}
                </th>
              ))}
              <th className="border border-neutral-300 px-3 py-2 text-center font-semibold text-neutral-700 w-16">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {/* FOH header */}
            {employees.some((e) => e.department === "foh") && (
              <tr>
                <td
                  colSpan={weekDays.length + 3}
                  className="border border-neutral-300 px-3 py-1.5 bg-blue-50 text-xs font-bold text-blue-800 uppercase tracking-wide"
                >
                  Front of House
                </td>
              </tr>
            )}

            {employees
              .filter((e) => e.department === "foh")
              .map((emp) => {
                const weekHours = shifts
                  .filter((s) => s.employee_id === emp.id)
                  .reduce((sum, s) => sum + s.scheduled_hours, 0);

                return (
                  <tr key={emp.id} className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 px-3 py-1.5 font-medium text-neutral-900">
                      {emp.name}
                    </td>
                    <td className="border border-neutral-300 px-3 py-1.5 text-neutral-600 text-xs">
                      {ROLE_LABELS[emp.role] || emp.role}
                    </td>
                    {weekDays.map(({ dateStr, isClosed }) => {
                      const dayShifts = getShiftsForEmployeeDay(
                        emp.id,
                        dateStr
                      );
                      return (
                        <td
                          key={dateStr}
                          className={`border border-neutral-300 px-2 py-1.5 text-center text-xs ${
                            isClosed ? "bg-neutral-50" : ""
                          }`}
                        >
                          {dayShifts.map((s, i) => (
                            <div key={i}>
                              {s.start_time}-{s.end_time}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                    <td className="border border-neutral-300 px-3 py-1.5 text-center font-medium text-neutral-700">
                      {weekHours.toFixed(1)}
                    </td>
                  </tr>
                );
              })}

            {/* BOH header */}
            {employees.some((e) => e.department === "boh") && (
              <tr>
                <td
                  colSpan={weekDays.length + 3}
                  className="border border-neutral-300 px-3 py-1.5 bg-orange-50 text-xs font-bold text-orange-800 uppercase tracking-wide"
                >
                  Back of House
                </td>
              </tr>
            )}

            {employees
              .filter((e) => e.department === "boh")
              .map((emp) => {
                const weekHours = shifts
                  .filter((s) => s.employee_id === emp.id)
                  .reduce((sum, s) => sum + s.scheduled_hours, 0);

                return (
                  <tr key={emp.id} className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 px-3 py-1.5 font-medium text-neutral-900">
                      {emp.name}
                    </td>
                    <td className="border border-neutral-300 px-3 py-1.5 text-neutral-600 text-xs">
                      {ROLE_LABELS[emp.role] || emp.role}
                    </td>
                    {weekDays.map(({ dateStr, isClosed }) => {
                      const dayShifts = getShiftsForEmployeeDay(
                        emp.id,
                        dateStr
                      );
                      return (
                        <td
                          key={dateStr}
                          className={`border border-neutral-300 px-2 py-1.5 text-center text-xs ${
                            isClosed ? "bg-neutral-50" : ""
                          }`}
                        >
                          {dayShifts.map((s, i) => (
                            <div key={i}>
                              {s.start_time}-{s.end_time}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                    <td className="border border-neutral-300 px-3 py-1.5 text-center font-medium text-neutral-700">
                      {weekHours.toFixed(1)}
                    </td>
                  </tr>
                );
              })}

            {/* Open shifts */}
            {openShifts.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={weekDays.length + 3}
                    className="border border-neutral-300 px-3 py-1.5 bg-red-50 text-xs font-bold text-red-800 uppercase tracking-wide"
                  >
                    Open Shifts (needs staff)
                  </td>
                </tr>
                {/* Group open shifts by role */}
                {Array.from(
                  new Set(openShifts.map((s) => s.role))
                ).map((role) => (
                  <tr key={`open-${role}`}>
                    <td className="border border-neutral-300 px-3 py-1.5 text-red-600 font-medium">
                      OPEN
                    </td>
                    <td className="border border-neutral-300 px-3 py-1.5 text-red-600 text-xs">
                      {ROLE_LABELS[role] || role}
                    </td>
                    {weekDays.map(({ dateStr, isClosed }) => {
                      const dayOpen = getOpenShiftsForDay(dateStr).filter(
                        (s) => s.role === role
                      );
                      return (
                        <td
                          key={dateStr}
                          className={`border border-neutral-300 px-2 py-1.5 text-center text-xs text-red-500 ${
                            isClosed ? "bg-neutral-50" : ""
                          }`}
                        >
                          {dayOpen.map((s, i) => (
                            <div key={i}>
                              {s.start_time}-{s.end_time}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                    <td className="border border-neutral-300 px-3 py-1.5 text-center text-red-500">
                      —
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Totals row */}
            <tr className="bg-neutral-100 font-semibold">
              <td
                colSpan={2}
                className="border border-neutral-300 px-3 py-2 text-neutral-700"
              >
                Totals
              </td>
              {weekDays.map(({ dateStr, isClosed }) => {
                const dayShifts = shifts.filter(
                  (s) => s.date === dateStr && s.employee_id
                );
                const dayHours = dayShifts.reduce(
                  (sum, s) => sum + s.scheduled_hours,
                  0
                );
                return (
                  <td
                    key={dateStr}
                    className={`border border-neutral-300 px-2 py-2 text-center text-xs ${
                      isClosed ? "bg-neutral-50" : ""
                    }`}
                  >
                    {!isClosed && dayShifts.length > 0 && (
                      <>
                        <div>{dayShifts.length} staff</div>
                        <div>{dayHours.toFixed(1)}h</div>
                      </>
                    )}
                  </td>
                );
              })}
              <td className="border border-neutral-300 px-3 py-2 text-center">
                {totalHours.toFixed(1)}h
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="mt-4 text-xs text-neutral-400 flex justify-between">
        <span>
          {restaurant.currency} {totalCost.toFixed(2)} estimated labour cost
        </span>
        <span>
          Generated by Tableo Shifts &middot;{" "}
          {format(new Date(), "d MMM yyyy HH:mm")}
        </span>
      </div>
    </div>
  );
}
