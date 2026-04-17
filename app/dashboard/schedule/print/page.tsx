import { getSessionUser } from "@/lib/auth";
import {
  getRestaurantForSession,
  getOrCreateScheduleWeek,
  getShiftsForWeek,
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
  const shifts = await getShiftsForWeek(scheduleWeek.id);

  return (
    <PrintSchedule
      restaurant={restaurant}
      weekStart={weekStart}
      shifts={shifts}
      status={scheduleWeek.status}
    />
  );
}
