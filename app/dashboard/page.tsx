export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import {
  getRestaurantForSession,
  getEmployees,
  getShiftsForDate,
  getDailyStaffingData,
} from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  server: "Server", bartender: "Bartender", host: "Host", runner: "Runner",
  busser: "Busser", line_cook: "Line Cook", prep_cook: "Prep Cook",
  sous_chef: "Sous Chef", head_chef: "Head Chef", dishwasher: "Dishwasher",
  manager: "Manager", assistant_manager: "Asst. Manager", barista: "Barista",
  sommelier: "Sommelier", other: "Other",
};

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  const employees = await getEmployees(restaurant.id);

  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().getDay();
  const todayHours = restaurant.opening_hours.find(
    (h) => h.day === dayOfWeek
  );
  const isClosedToday = todayHours?.closed ?? false;

  // Fetch today's shifts and staffing data
  const todayShifts = !isClosedToday
    ? await getShiftsForDate(restaurant.id, today)
    : [];
  const staffingData = await getDailyStaffingData(restaurant.id, today, today);
  const todayStaffing = staffingData.length > 0 ? staffingData[0] : null;

  // Group shifts by department
  const fohShifts = todayShifts.filter((s) => s.department === "foh");
  const bohShifts = todayShifts.filter((s) => s.department === "boh");
  const openShifts = todayShifts.filter((s) => s.is_open || !s.employee_id);
  const assignedShifts = todayShifts.filter((s) => !s.is_open && s.employee_id);

  // Today's labour cost
  const todayLabourCost = todayShifts.reduce(
    (sum, s) => sum + s.estimated_cost,
    0
  );
  const todayHoursTotal = todayShifts.reduce(
    (sum, s) => sum + s.scheduled_hours,
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500 mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Today"
          value={
            isClosedToday
              ? "Closed"
              : todayHours
                ? `${todayHours.open} - ${todayHours.close}`
                : "Not set"
          }
          detail={
            isClosedToday
              ? "Restaurant is closed"
              : `${assignedShifts.length} staff on shift`
          }
        />
        <StatCard
          label="Expected Covers"
          value={
            isClosedToday
              ? "—"
              : todayStaffing
                ? todayStaffing.booked_covers.toString()
                : "No data"
          }
          detail={
            todayStaffing
              ? `${todayStaffing.booking_count} bookings`
              : "Connect Tableo to see covers"
          }
        />
        <StatCard
          label="Today's Labour"
          value={
            isClosedToday
              ? "—"
              : todayShifts.length > 0
                ? `${restaurant.currency} ${todayLabourCost.toFixed(0)}`
                : "—"
          }
          detail={
            todayShifts.length > 0
              ? `${todayHoursTotal.toFixed(1)}h scheduled`
              : "No shifts today"
          }
        />
        <StatCard
          label="Active Staff"
          value={employees.length.toString()}
          detail={`${employees.filter((e) => e.department === "foh").length} FOH / ${employees.filter((e) => e.department === "boh").length} BOH`}
        />
      </div>

      {/* Getting Started */}
      {employees.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Welcome to Tableo Shifts
          </h2>
          <p className="text-blue-700 mb-4">
            Get started by adding your team members. Once you have employees,
            you can create your first schedule.
          </p>
          <ol className="list-decimal list-inside text-blue-700 space-y-2">
            <li>
              <strong>Add employees</strong> — Go to Staff to add your team
              with their roles, availability, and hourly rates.
            </li>
            <li>
              <strong>Review opening hours</strong> — Your restaurant hours are
              synced from Tableo. Check Settings to adjust service periods.
            </li>
            <li>
              <strong>Create your first schedule</strong> — Go to Schedule to
              build your weekly shifts. We will suggest optimal staffing based
              on your bookings.
            </li>
          </ol>
        </div>
      )}

      {/* Open shifts alert */}
      {openShifts.length > 0 && (() => {
        // Group open shifts by role
        const byRole = openShifts.reduce<Record<string, number>>((acc, s) => {
          const label = ROLE_LABELS[s.role] || s.role;
          acc[label] = (acc[label] || 0) + 1;
          return acc;
        }, {});
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-900 mb-1.5">
                  {openShifts.length} open shift{openShifts.length !== 1 ? "s" : ""} today — needs staff assigned
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(byRole).map(([label, count]) => (
                    <span
                      key={label}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                    >
                      x{count} {label}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href="/dashboard/schedule"
                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg"
              >
                View schedule
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Today's Schedule */}
      {!isClosedToday && employees.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* FOH */}
          <div className="bg-white rounded-lg border border-neutral-200">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Front of House
              </h2>
              <span className="text-xs text-neutral-400">
                {fohShifts.filter((s) => s.employee_id).length} staff
              </span>
            </div>
            <div className="divide-y divide-neutral-100">
              {fohShifts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-neutral-400 text-center">
                  No FOH shifts today
                </p>
              ) : (
                fohShifts.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} />
                ))
              )}
            </div>
          </div>

          {/* BOH */}
          <div className="bg-white rounded-lg border border-neutral-200">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Back of House
              </h2>
              <span className="text-xs text-neutral-400">
                {bohShifts.filter((s) => s.employee_id).length} staff
              </span>
            </div>
            <div className="divide-y divide-neutral-100">
              {bohShifts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-neutral-400 text-center">
                  No BOH shifts today
                </p>
              ) : (
                bohShifts.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Closed today message */}
      {isClosedToday && employees.length > 0 && (
        <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500">Restaurant is closed today.</p>
          <Link
            href="/dashboard/schedule"
            className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
          >
            View this week&apos;s schedule
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
      <p className="text-xs text-neutral-400 mt-1">{detail}</p>
    </div>
  );
}

function ShiftRow({ shift }: { shift: any }) {
  const employee = shift.employee;
  const isOpen = shift.is_open || !shift.employee_id;

  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      {isOpen ? (
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-500 text-xs font-bold">?</span>
        </div>
      ) : employee ? (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: employee.color || "#3B82F6" }}
        >
          {employee.first_name[0]}
          {employee.last_name[0]}
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-neutral-200" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isOpen ? "text-red-600" : "text-neutral-900"}`}>
          {isOpen
            ? "Open — needs staff"
            : employee
              ? `${employee.first_name} ${employee.last_name}`
              : "Unassigned"}
        </p>
        <p className="text-xs text-neutral-500">
          {ROLE_LABELS[shift.role] || shift.role}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-neutral-700">
          {shift.start_time} - {shift.end_time}
        </p>
        <p className="text-xs text-neutral-400">
          {shift.scheduled_hours}h
        </p>
      </div>
    </div>
  );
}
