export const dynamic = "force-dynamic";

import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getEmployees,
  getTimeOffRequests,
} from "@/lib/queries";
import { redirect } from "next/navigation";
import { TimeOffView } from "@/components/timeoff/TimeOffView";

export default async function TimeOffPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  const [employees, requests] = await Promise.all([
    getEmployees(restaurant.id),
    getTimeOffRequests(restaurant.id),
  ]);

  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Time Off</h1>
        <p className="text-neutral-500 mt-1">
          {requests.filter((r) => r.status === "pending").length} pending
          request{requests.filter((r) => r.status === "pending").length !== 1 ? "s" : ""}
        </p>
      </div>

      <TimeOffView
        requests={requests}
        employeeMap={Object.fromEntries(employeeMap)}
        canManage={canManageShifts(session.role)}
        restaurantId={restaurant.id}
      />
    </div>
  );
}
