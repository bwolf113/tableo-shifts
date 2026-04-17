import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRestaurantForSession } from "@/lib/queries";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/");
  }

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) {
    redirect("/");
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        restaurantName={restaurant.name}
        userRole={session.role}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
