import { getSessionUser } from "@/lib/auth";
import { getRestaurantForSession, getDailyStaffingData } from "@/lib/queries";
import { redirect } from "next/navigation";
import { StaffingView } from "@/components/staffing/StaffingView";
import { format, startOfWeek, addDays } from "date-fns";

export default async function StaffingPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const staffingData = await getDailyStaffingData(
    restaurant.id,
    weekStartStr,
    format(weekEnd, "yyyy-MM-dd")
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Staffing Insights</h1>
        <p className="text-neutral-500 mt-1">
          Booking-powered staffing recommendations from Tableo
        </p>
      </div>

      <StaffingView
        restaurant={restaurant}
        initialStaffingData={staffingData}
        initialWeekStart={weekStartStr}
      />
    </div>
  );
}
