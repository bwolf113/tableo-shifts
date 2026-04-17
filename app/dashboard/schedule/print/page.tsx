import { getSessionUser } from "@/lib/auth";
import {
  getRestaurantForSession,
  getOrCreateScheduleWeek,
  getShiftsForWeek,
  getTimeOffRequests,
} from "@/lib/queries";
import { redirect } from "next/navigation";
import { PrintSchedule } from "@/components/schedule/PrintSchedule";

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  const params = await searchParams;
  const weekStart = params.week_start;
  if (!weekStart) redirect("/dashboard/schedule");

  const scheduleWeek = await getOrCreateScheduleWeek(restaurant.id, weekStart);
  const [shifts, timeOffRequests] = await Promise.all([
    getShiftsForWeek(scheduleWeek.id),
    getTimeOffRequests(restaurant.id, "approved"),
  ]);

  // Build set of "employeeId|date" for quick lookup
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const onLeaveKeys = new Set<string>();
  for (const req of timeOffRequests) {
    if (req.start_date <= weekEndStr && req.end_date >= weekStart) {
      // Find dates within this week that overlap
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().split("T")[0];
        if (ds >= req.start_date && ds <= req.end_date) {
          onLeaveKeys.add(`${req.employee_id}|${ds}`);
        }
      }
    }
  }

  return (
    <PrintSchedule
      restaurant={restaurant}
      weekStart={weekStart}
      shifts={shifts}
      status={scheduleWeek.status}
      onLeaveKeys={onLeaveKeys}
    />
  );
}
