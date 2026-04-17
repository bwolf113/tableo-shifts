"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { clsx } from "clsx";

const DAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export default function StaffAvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [days, setDays] = useState(
    DAYS.map((d) => ({
      day_of_week: d.day,
      label: d.label,
      is_available: true,
      start_time: "09:00",
      end_time: "23:00",
    }))
  );

  useEffect(() => {
    fetch("/api/staff/availability")
      .then((r) => r.json())
      .then((data) => {
        const slots = data.data || [];
        if (slots.length > 0) {
          setDays((prev) =>
            prev.map((d) => {
              const slot = slots.find((s: any) => s.day_of_week === d.day_of_week);
              if (slot) {
                return { ...d, is_available: slot.is_available, start_time: slot.start_time, end_time: slot.end_time };
              }
              return { ...d, is_available: false };
            })
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/staff/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: days.map((d) => ({
            day_of_week: d.day_of_week,
            start_time: d.is_available ? d.start_time : "00:00",
            end_time: d.is_available ? d.end_time : "00:00",
            is_available: d.is_available,
          })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayOfWeek: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === dayOfWeek ? { ...d, is_available: !d.is_available } : d
      )
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-neutral-900">Availability</h1>
            <nav className="flex gap-1">
              <Link href="/staff/shifts" className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Shifts</Link>
              <Link href="/staff/time-off" className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Time Off</Link>
              <Link href="/staff/availability" className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md">Availability</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        <p className="text-sm text-neutral-500 mb-4">
          Set which days and times you can work. Your manager will see this when creating the schedule.
        </p>

        {loading ? (
          <p className="text-neutral-400 text-center py-8">Loading...</p>
        ) : (
          <div className="space-y-2">
            {days.map((day) => (
              <div
                key={day.day_of_week}
                className={clsx(
                  "flex items-center gap-3 py-3 px-4 rounded-lg bg-white border transition-colors",
                  day.is_available ? "border-green-200" : "border-neutral-200"
                )}
              >
                <button
                  onClick={() => toggleDay(day.day_of_week)}
                  className={clsx(
                    "w-10 h-5 rounded-full relative transition-colors flex-shrink-0",
                    day.is_available ? "bg-green-500" : "bg-neutral-300"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      day.is_available ? "left-5" : "left-0.5"
                    )}
                  />
                </button>

                <span
                  className={clsx(
                    "text-sm font-medium w-24",
                    day.is_available ? "text-neutral-900" : "text-neutral-400"
                  )}
                >
                  {day.label}
                </span>

                {day.is_available ? (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="time"
                      value={day.start_time}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d) =>
                            d.day_of_week === day.day_of_week
                              ? { ...d, start_time: e.target.value }
                              : d
                          )
                        )
                      }
                      className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-neutral-400 text-xs">to</span>
                    <input
                      type="time"
                      value={day.end_time}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d) =>
                            d.day_of_week === day.day_of_week
                              ? { ...d, end_time: e.target.value }
                              : d
                          )
                        )
                      }
                      className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-400 ml-auto">Unavailable</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-4">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
