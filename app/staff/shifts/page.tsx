import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff-auth";
import {
  getShiftsForEmployee,
  getEmployeeById,
  getRestaurantById,
  getDailyStaffingData,
} from "@/lib/queries";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { format, startOfWeek, addDays } from "date-fns";

const LEAVE_LABELS: Record<string, string> = {
  time_off: "Time Off",
  sick_leave: "Sick Leave",
  personal: "Personal Leave",
  holiday: "Holiday",
  other: "Leave",
};

const ROLE_LABELS: Record<string, string> = {
  server: "Server", bartender: "Bartender", host: "Host", runner: "Runner",
  busser: "Busser", line_cook: "Line Cook", prep_cook: "Prep Cook",
  sous_chef: "Sous Chef", head_chef: "Head Chef", dishwasher: "Dishwasher",
  manager: "Manager", assistant_manager: "Asst. Manager", barista: "Barista",
  sommelier: "Sommelier", other: "Other",
};

export default async function StaffShiftsPage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const employee = await getEmployeeById(session.employeeId);
  if (!employee) redirect("/staff/login");

  const restaurant = await getRestaurantById(session.restaurantId);

  // Get shifts for next 2 weeks
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const twoWeeksEnd = addDays(weekStart, 13);

  const shifts = await getShiftsForEmployee(
    session.employeeId,
    format(weekStart, "yyyy-MM-dd"),
    format(twoWeeksEnd, "yyyy-MM-dd")
  );

  // Get approved time-off for this employee in the 14-day window
  const { data: timeOffData } = await getDb()
    .from("time_off_requests")
    .select("*")
    .eq("employee_id", session.employeeId)
    .eq("status", "approved")
    .lte("start_date", format(twoWeeksEnd, "yyyy-MM-dd"))
    .gte("end_date", format(weekStart, "yyyy-MM-dd"));

  const approvedLeave = timeOffData || [];

  // Returns the leave request covering a given date, if any
  const getLeaveForDate = (dateStr: string) =>
    approvedLeave.find((r) => r.start_date <= dateStr && r.end_date >= dateStr) || null;

  // Get staffing data for context
  const staffingData = await getDailyStaffingData(
    session.restaurantId,
    format(weekStart, "yyyy-MM-dd"),
    format(twoWeeksEnd, "yyyy-MM-dd")
  );
  const staffingByDate = new Map(staffingData.map((d) => [d.date, d]));

  // Group shifts by date
  const shiftsByDate = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const existing = shiftsByDate.get(shift.date) || [];
    existing.push(shift);
    shiftsByDate.set(shift.date, existing);
  }

  // Build 14-day view
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const isToday = format(today, "yyyy-MM-dd") === dateStr;
    const isPast = date < today && !isToday;

    return {
      date,
      dateStr,
      isToday,
      isPast,
      shifts: shiftsByDate.get(dateStr) || [],
      staffing: staffingByDate.get(dateStr),
      leave: getLeaveForDate(dateStr),
    };
  });

  const upcomingShifts = shifts.filter(
    (s) => s.date >= format(today, "yyyy-MM-dd")
  );

  const totalHoursThisWeek = shifts
    .filter((s) => {
      const d = new Date(s.date);
      return d >= weekStart && d < addDays(weekStart, 7);
    })
    .reduce((sum, s) => sum + s.scheduled_hours, 0);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-neutral-900">My Shifts</h1>
              <p className="text-xs text-neutral-500">
                {restaurant?.name} &middot; {session.name}
              </p>
            </div>
            <nav className="flex gap-1">
              <Link
                href="/staff/shifts"
                className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md"
              >
                Shifts
              </Link>
              <Link
                href="/staff/time-off"
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md"
              >
                Time Off
              </Link>
              <Link
                href="/staff/availability"
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md"
              >
                Availability
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Upcoming shifts</p>
            <p className="text-xl font-bold text-neutral-900">
              {upcomingShifts.length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">This week</p>
            <p className="text-xl font-bold text-neutral-900">
              {totalHoursThisWeek.toFixed(1)}h
            </p>
          </div>
        </div>

        {/* Day-by-day */}
        <div className="space-y-2">
          {days.map(({ dateStr, date, isToday, isPast, shifts: dayShifts, staffing, leave }) => {
            if (dayShifts.length === 0 && isPast && !leave) return null; // Hide past empty days

            const dayLabel = isToday
              ? "Today"
              : format(date, "EEEE");
            const dateLabel = format(date, "d MMM");

            return (
              <div
                key={dateStr}
                className={`bg-white rounded-lg border overflow-hidden ${
                  leave
                    ? "border-green-300"
                    : isToday
                      ? "border-blue-300 ring-1 ring-blue-100"
                      : isPast
                        ? "border-neutral-200 opacity-60"
                        : "border-neutral-200"
                }`}
              >
                <div className={`px-4 py-2.5 flex items-center justify-between border-b ${leave ? "bg-green-50 border-green-200" : "border-neutral-100"}`}>
                  <div>
                    <span className={`text-sm font-semibold ${leave ? "text-green-800" : isToday ? "text-blue-700" : "text-neutral-900"}`}>
                      {dayLabel}
                    </span>
                    <span className="text-sm text-neutral-400 ml-2">
                      {dateLabel}
                    </span>
                  </div>
                  {leave ? (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      {LEAVE_LABELS[leave.leave_type] || "Leave"} approved
                    </span>
                  ) : staffing && staffing.booked_covers > 0 ? (
                    <span className="text-xs text-neutral-400">
                      {staffing.booked_covers} covers expected
                    </span>
                  ) : null}
                </div>

                {/* Leave notice */}
                {leave && (
                  <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <p className="text-xs text-green-700">
                      Your {LEAVE_LABELS[leave.leave_type] || "leave"} has been approved.
                      {dayShifts.length > 0 && " You have shifts scheduled below — contact your manager if anything needs adjusting."}
                    </p>
                  </div>
                )}

                {dayShifts.length > 0 ? (
                  <div className="divide-y divide-neutral-50">
                    {dayShifts.map((shift) => (
                      <div key={shift.id} className={`px-4 py-3 ${leave ? "opacity-50" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {shift.start_time} - {shift.end_time}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {ROLE_LABELS[shift.role] || shift.role}
                              {shift.section_label && ` — ${shift.section_label}`}
                              {shift.is_training && " (Training)"}
                            </p>
                          </div>
                          <span className="text-xs text-neutral-400">
                            {shift.scheduled_hours}h
                          </span>
                        </div>
                        {shift.notes && (
                          <p className="text-xs text-neutral-400 mt-1">
                            {shift.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-sm text-neutral-400">{leave ? "No shifts scheduled" : "Day off"}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
