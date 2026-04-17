"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Restaurant, ComplianceProfile, CoversPerStaff, ServicePeriod } from "@/types";

interface SettingsFormProps {
  restaurant: Restaurant;
  complianceProfile: ComplianceProfile | null;
  isAdmin: boolean;
}

const RATIO_ROLES = [
  { key: "server", label: "Server", desc: "Covers per server" },
  { key: "bartender", label: "Bartender", desc: "Covers per bartender" },
  { key: "host", label: "Host", desc: "Covers per host" },
  { key: "runner", label: "Runner", desc: "Covers per runner" },
  { key: "line_cook", label: "Line Cook", desc: "Covers per line cook" },
  { key: "dishwasher", label: "Dishwasher", desc: "Covers per dishwasher" },
];

export function SettingsForm({
  restaurant,
  complianceProfile,
  isAdmin,
}: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [ratios, setRatios] = useState<CoversPerStaff>(
    restaurant.covers_per_staff
  );
  const [avgSpend, setAvgSpend] = useState(
    restaurant.avg_spend_per_cover.toString()
  );
  const [targetLabor, setTargetLabor] = useState(
    restaurant.target_labor_cost_pct.toString()
  );
  const [walkinFactor, setWalkinFactor] = useState(
    restaurant.walkin_factor_pct.toString()
  );
  const [apiToken, setApiToken] = useState(restaurant.api_token || "");
  const [noshowFactor, setNoshowFactor] = useState(
    restaurant.noshow_factor_pct.toString()
  );
  const [servicePeriods, setServicePeriods] = useState<ServicePeriod[]>(
    restaurant.service_periods.length > 0
      ? restaurant.service_periods
      : [
          { name: "Lunch", start: "12:00", end: "15:00" },
          { name: "Dinner", start: "18:00", end: "23:00" },
        ]
  );

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: apiToken || null,
          covers_per_staff: ratios,
          avg_spend_per_cover: parseFloat(avgSpend),
          target_labor_cost_pct: parseFloat(targetLabor),
          walkin_factor_pct: parseFloat(walkinFactor),
          noshow_factor_pct: parseFloat(noshowFactor),
          service_periods: servicePeriods,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const addServicePeriod = () => {
    setServicePeriods((prev) => [
      ...prev,
      { name: "", start: "12:00", end: "15:00" },
    ]);
  };

  const removeServicePeriod = (index: number) => {
    setServicePeriods((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Tableo Connection */}
      <section className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          Tableo Connection
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          API token for syncing booking data. Booking data syncs automatically
          when you open the Schedule or Staffing pages.
        </p>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            API Token
          </label>
          <input
            type="text"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value.trim())}
            placeholder="Paste from Tableo → Settings → API Integration"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-neutral-400 mt-1">
            {apiToken
              ? "Connected — bookings sync automatically"
              : "No token set — add one to enable automatic booking sync"}
          </p>
        </div>
      </section>

      {/* Opening Hours (read-only, synced from Tableo) */}
      <section className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          Opening Hours
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Synced from your Tableo account. Days marked as closed will have no shifts.
        </p>
        <div className="space-y-1">
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
            (dayName, index) => {
              const hours = restaurant.opening_hours.find(
                (h) => h.day === index
              );
              return (
                <div
                  key={dayName}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-neutral-700 w-24">{dayName}</span>
                  {hours?.closed ? (
                    <span className="text-neutral-400">Closed</span>
                  ) : hours ? (
                    <span className="text-neutral-900">
                      {hours.open} - {hours.close}
                    </span>
                  ) : (
                    <span className="text-neutral-400">Not set</span>
                  )}
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* Service Periods */}
      <section className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          Service Periods
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Define your service periods (e.g., Lunch, Dinner). Used for
          staffing breakdowns per period.
        </p>
        <div className="space-y-2">
          {servicePeriods.map((period, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Name"
                value={period.name}
                onChange={(e) => {
                  const updated = [...servicePeriods];
                  updated[index] = { ...period, name: e.target.value };
                  setServicePeriods(updated);
                }}
                className="w-32 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="time"
                value={period.start}
                onChange={(e) => {
                  const updated = [...servicePeriods];
                  updated[index] = { ...period, start: e.target.value };
                  setServicePeriods(updated);
                }}
                className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-neutral-400">to</span>
              <input
                type="time"
                value={period.end}
                onChange={(e) => {
                  const updated = [...servicePeriods];
                  updated[index] = { ...period, end: e.target.value };
                  setServicePeriods(updated);
                }}
                className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => removeServicePeriod(index)}
                className="text-neutral-400 hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={addServicePeriod}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add service period
          </button>
        </div>
      </section>

      {/* Covers per Staff Ratios */}
      <section className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          Staffing Ratios
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          How many covers can each role handle? Used to calculate recommended
          staff levels from your Tableo bookings.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {RATIO_ROLES.map(({ key, label, desc }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={ratios[key] || ""}
                  onChange={(e) =>
                    setRatios((r) => ({
                      ...r,
                      [key]: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-20 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-neutral-400">covers / person</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Financial Targets */}
      <section className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          Financial Settings
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Used to project labour costs against expected revenue.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Avg. spend per cover ({restaurant.currency})
            </label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={avgSpend}
              onChange={(e) => setAvgSpend(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Target labour cost (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={targetLabor}
              onChange={(e) => setTargetLabor(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Walk-in factor (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={walkinFactor}
              onChange={(e) => setWalkinFactor(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-neutral-400 mt-1">
              Estimated walk-ins as % of booked covers
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              No-show factor (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={noshowFactor}
              onChange={(e) => setNoshowFactor(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-neutral-400 mt-1">
              Estimated no-shows as % of booked covers
            </p>
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          Compliance
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Labour law rules applied when publishing schedules.
        </p>
        {complianceProfile ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Jurisdiction</span>
              <span className="font-medium">{complianceProfile.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Max weekly hours</span>
              <span>{complianceProfile.max_weekly_hours}h</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Min rest between shifts</span>
              <span>{complianceProfile.min_rest_between_shifts_hours}h</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Overtime after</span>
              <span>{complianceProfile.overtime_weekly_threshold}h/week</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Break required after</span>
              <span>
                {complianceProfile.break_required_after_hours}h
                ({complianceProfile.break_duration_minutes}min)
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">Max consecutive days</span>
              <span>{complianceProfile.max_consecutive_days}</span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-700">
            No compliance profile set. Go to your Tableo admin to assign a
            jurisdiction for this restaurant.
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Settings saved</span>
        )}
      </div>
    </div>
  );
}
