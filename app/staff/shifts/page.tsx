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
import { format, startOfWeek, addDays, subWeeks, addWeeks } from "date-fns";

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

export default async function StaffShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const employee = await getEmployeeById(session.employeeId);
  if (!employee) redirect("/staff/login");

  const restaurant = await getRestaurantById(session.restaurantId);

  const params = await searchParams;
  const today = new Date();
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = params.week_start
    ? new Date(params.week_start + "T00:00:00")
    : thisWeekStart;
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");
  const isCurrentWeek = weekStartStr === format(thisWeekStart, "yyyy-MM-dd");

  const prevWeekStr = format(subWeeks(weekStart, 1), "yyyy-MM-dd");
  const nextWeekStr = format(addWeeks(weekStart, 1), "yyyy-MM-dd");
  const weekLabel = `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;

  const [shifts, leaveData, staffingData] = await Promise.all([
    getShiftsForEmployee(session.employeeId, weekStartStr, weekEndStr),
    getDb()
      .from("time_off_requests")
      .select("*")
      .eq("employee_id", session.employeeId)
      .in("status", ["approved", "pending"])
      .lte("start_date", weekEndStr)
      .gte("end_date", weekStartStr),
    getDailyStaffingData(session.restaurantId, weekStartStr, weekEndStr),
  ]);

  const allLeave = leaveData.data || [];
  const approvedLeave = allLeave.filter((r) => r.status === "approved");

  const getLeaveForDate = (dateStr: string) =>
    allLeave.find((r) => r.start_date <= dateStr && r.end_date >= dateStr) || null;

  const staffingByDate = new Map(staffingData.map((d) => [d.date, d]));

  // Build leave day map for tiles calculation
  const leaveDayType: Record<string, string> = {};
  for (const req of approvedLeave) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const ds = format(d, "yyyy-MM-dd");
      if (ds >= req.start_date && ds <= req.end_date) {
        leaveDayType[ds] = req.leave_type;
      }
    }
  }

  let totalScheduled = 0;
  let vacationHours = 0;
  let sickHours = 0;
  for (const shift of shifts) {
    const h = shift.scheduled_hours || 0;
    totalScheduled += h;
    const leaveType = leaveDayType[shift.date];
    if (leaveType === "sick_leave") sickHours += h;
    else if (leaveType) vacationHours += h;
  }
  const workableHours = totalScheduled - vacationHours - sickHours;

  // Group shifts by date
  const shiftsByDate = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const existing = shiftsByDate.get(shift.date) || [];
    existing.push(shift);
    shiftsByDate.set(shift.date, existing);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const isToday = format(today, "yyyy-MM-dd") === dateStr;
    const isPast = date < today && !isToday;
    return {
      date, dateStr, isToday, isPast,
      shifts: shiftsByDate.get(dateStr) || [],
      staffing: staffingByDate.get(dateStr),
      leave: getLeaveForDate(dateStr),
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50">
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
              <Link href="/staff/shifts" className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md">Shifts</Link>
              <Link href="/staff/time-off" className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Time Off</Link>
              <Link href="/staff/availability" className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Availability</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/staff/shifts?week_start=${prevWeekStr}`}
            className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600"
          >
            ‹
          </Link>
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-900">{weekLabel}</p>
          </div>
          <div className="flex items-center gap-1">
            {!isCurrentWeek && (
              <Link
                href="/staff/shifts"
                className="px-2 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-500"
              >
                Today
              </Link>
            )}
            <Link
              href={`/staff/shifts?week_start=${nextWeekStr}`}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600"
            >
              ›
            </Link>
          </div>
        </div>

        {/* Hours tiles */}
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

        {/* Day-by-day */}
        <div className="space-y-2">
          {days.map(({ dateStr, date, isToday, isPast, shifts: dayShifts, staffing, leave }) => {
            if (dayShifts.length === 0 && isPast && !leave) return null;

            const dayLabel = isToday ? "Today" : format(date, "EEEE");
            const dateLabel = format(date, "d MMM");

            return (
              <div
                key={dateStr}
                className={`bg-white rounded-lg border overflow-hidden ${
                  leave
                    ? leave.status === "approved" ? "border-green-300" : "border-amber-300"
                    : isToday
                      ? "border-blue-300 ring-1 ring-blue-100"
                      : isPast
                        ? "border-neutral-200 opacity-60"
                        : "border-neutral-200"
                }`}
              >
                <div className={`px-4 py-2.5 flex items-center justify-between border-b ${
                  leave
                    ? leave.status === "approved" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                    : "border-neutral-100"
                }`}>
                  <div>
                    <span className={`text-sm font-semibold ${
                      leave
                        ? leave.status === "approved" ? "text-green-800" : "text-amber-800"
                        : isToday ? "text-blue-700" : "text-neutral-900"
                    }`}>
                      {dayLabel}
                    </span>
                    <span className="text-sm text-neutral-400 ml-2">{dateLabel}</span>
                  </div>
                  {leave ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      leave.status === "approved"
                        ? "text-green-700 bg-green-100"
                        : "text-amber-700 bg-amber-100"
                    }`}>
                      {LEAVE_LABELS[leave.leave_type] || "Leave"} {leave.status === "approved" ? "approved" : "pending"}
                    </span>
                  ) : staffing && staffing.booked_covers > 0 ? (
                    <span className="text-xs text-neutral-400">{staffing.booked_covers} covers expected</span>
                  ) : null}
                </div>

                {leave && (
                  <div className={`px-4 py-2 border-b flex items-start gap-2 ${
                    leave.status === "approved" ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"
                  }`}>
                    <span className={`mt-0.5 ${leave.status === "approved" ? "text-green-500" : "text-amber-500"}`}>
                      {leave.status === "approved" ? "✓" : "⏳"}
                    </span>
                    <p className={`text-xs ${leave.status === "approved" ? "text-green-700" : "text-amber-700"}`}>
                      {leave.status === "approved"
                        ? `Your ${LEAVE_LABELS[leave.leave_type] || "leave"} has been approved.`
                        : `Your ${LEAVE_LABELS[leave.leave_type] || "leave"} request is pending approval.`}
                      {dayShifts.length > 0 && " You have shifts scheduled below — contact your manager if anything needs adjusting."}
                    </p>
                  </div>
                )}

                {dayShifts.length > 0 ? (
                  <div className="divide-y divide-neutral-50">
                    {dayShifts.map((shift) => (
                      <div key={shift.id} className={`px-4 py-3 ${leave?.status === "approved" ? "opacity-50" : ""}`}>
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
                          <span className="text-xs text-neutral-400">{shift.scheduled_hours}h</span>
                        </div>
                        {shift.notes && <p className="text-xs text-neutral-400 mt-1">{shift.notes}</p>}
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
