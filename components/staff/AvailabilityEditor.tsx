"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface AvailabilityEditorProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

const DAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export function AvailabilityEditor({
  employeeId,
  employeeName,
  onClose,
}: AvailabilityEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // State: one entry per day
  const [days, setDays] = useState<
    Array<{
      day_of_week: number;
      label: string;
      is_available: boolean;
      start_time: string;
      end_time: string;
    }>
  >(
    DAYS.map((d) => ({
      day_of_week: d.day,
      label: d.label,
      is_available: true,
      start_time: "09:00",
      end_time: "23:00",
    }))
  );

  // Fetch existing availability
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/employees/${employeeId}/availability`);
        if (res.ok) {
          const data = await res.json();
          const slots: AvailabilitySlot[] = data.data || [];

          if (slots.length > 0) {
            setDays((prev) =>
              prev.map((d) => {
                const slot = slots.find((s) => s.day_of_week === d.day_of_week);
                if (slot) {
                  return {
                    ...d,
                    is_available: slot.is_available,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                  };
                }
                // If no slot exists for this day, default to unavailable
                return { ...d, is_available: false };
              })
            );
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [employeeId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/employees/${employeeId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: days.map((d) => ({
            employee_id: employeeId,
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
        d.day_of_week === dayOfWeek
          ? { ...d, is_available: !d.is_available }
          : d
      )
    );
  };

  const updateTime = (
    dayOfWeek: number,
    field: "start_time" | "end_time",
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d
      )
    );
  };

  const setAllAvailable = () => {
    setDays((prev) => prev.map((d) => ({ ...d, is_available: true })));
  };

  const setWeekdaysOnly = () => {
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        is_available: d.day_of_week >= 1 && d.day_of_week <= 5,
      }))
    );
  };

  const setWeekendsOnly = () => {
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        is_available: d.day_of_week === 0 || d.day_of_week === 6,
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Availability
              </h2>
              <p className="text-sm text-neutral-500">{employeeName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={setAllAvailable}
              className="px-2.5 py-1 text-xs border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              All days
            </button>
            <button
              onClick={setWeekdaysOnly}
              className="px-2.5 py-1 text-xs border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              Weekdays only
            </button>
            <button
              onClick={setWeekendsOnly}
              className="px-2.5 py-1 text-xs border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              Weekends only
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-neutral-400">Loading...</div>
          ) : (
            <div className="space-y-2">
              {days.map((day) => (
                <div
                  key={day.day_of_week}
                  className={clsx(
                    "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
                    day.is_available
                      ? "bg-green-50/50"
                      : "bg-neutral-50"
                  )}
                >
                  {/* Toggle */}
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

                  {/* Day name */}
                  <span
                    className={clsx(
                      "text-sm font-medium w-24",
                      day.is_available
                        ? "text-neutral-900"
                        : "text-neutral-400"
                    )}
                  >
                    {day.label}
                  </span>

                  {/* Times */}
                  {day.is_available ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="time"
                        value={day.start_time}
                        onChange={(e) =>
                          updateTime(day.day_of_week, "start_time", e.target.value)
                        }
                        className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-neutral-400 text-xs">to</span>
                      <input
                        type="time"
                        value={day.end_time}
                        onChange={(e) =>
                          updateTime(day.day_of_week, "end_time", e.target.value)
                        }
                        className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400 ml-auto">
                      Unavailable
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-6">
            {saved && (
              <span className="text-sm text-green-600 mr-2">Saved</span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Availability"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
