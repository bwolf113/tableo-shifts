import { getSessionUser } from "@/lib/auth";
import { getRestaurantForSession, getEmployees } from "@/lib/queries";
import { redirect } from "next/navigation";
import { WeeklySchedule } from "@/components/schedule/WeeklySchedule";

export default async function SchedulePage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  const employees = await getEmployees(restaurant.id);

  return (
    <div>
      <WeeklySchedule
        restaurant={restaurant}
        employees={employees}
        canEdit={session.role === "restaurant_admin" || session.role === "restaurant_manager"}
      />
    </div>
  );
}
