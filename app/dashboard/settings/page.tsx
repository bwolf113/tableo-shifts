import { getSessionUser, isAdmin } from "@/lib/auth";
import { getRestaurantForSession, getComplianceProfile } from "@/lib/queries";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const restaurant = await getRestaurantForSession(session);
  if (!restaurant) redirect("/");

  let complianceProfile = null;
  if (restaurant.compliance_profile_id) {
    complianceProfile = await getComplianceProfile(
      restaurant.compliance_profile_id
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-500 mt-1">
          Configure staffing ratios, service periods, and compliance
        </p>
      </div>

      <SettingsForm
        restaurant={restaurant}
        complianceProfile={complianceProfile}
        isAdmin={isAdmin(session.role)}
      />
    </div>
  );
}
