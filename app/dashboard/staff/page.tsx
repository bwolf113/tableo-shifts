import { getSessionUser } from "@/lib/auth";
import { getRestaurantForSession, getEmployees } from "@/lib/queries";
import { redirect } from "next/navigation";
import { StaffList } from "@/components/staff/StaffList";
import type { Employee } from "@/types";

export default async function StaffPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  const employees = await getEmployees(restaurant.id, false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff</h1>
          <p className="text-neutral-500 mt-1">
            {employees.filter((e) => e.is_active).length} active employees
          </p>
        </div>
      </div>

      <StaffList
        employees={employees}
        restaurantId={restaurant.id}
        currency={restaurant.currency}
      />
    </div>
  );
}
