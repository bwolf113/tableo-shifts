"use client";

import { useState, useEffect } from "react";
import type { Restaurant, Employee, Shift, EmployeeRole, Department, EmployeeAvailability } from "@/types";

interface AddShiftModalProps {
  date: string;
  employees: Employee[];
  restaurant: Restaurant;
  onClose: () => void;
  onCreated: (shift: Shift) => void;
}

const ROLES: { value: EmployeeRole; label: string; dept: Department }[] = [
  { value: "manager", label: "Manager", dept: "foh" },
  { value: "assistant_manager", label: "Assistant Manager", dept: "foh" },
  { value: "host", label: "Host / Hostess", dept: "foh" },
  { value: "server", label: "Server", dept: "foh" },
  { value: "bartender", label: "Bartender", dept: "foh" },
  { value: "barista", label: "Barista", dept: "foh" },
  { value: "sommelier", label: "Sommelier", dept: "foh" },
  { value: "runner", label: "Runner", dept: "foh" },
  { value: "busser", label: "Busser", dept: "foh" },
  { value: "head_chef", label: "Head Chef", dept: "boh" },
  { value: "sous_chef", label: "Sous Chef", dept: "boh" },
  { value: "line_cook", label: "Line Cook", dept: "boh" },
  { value: "prep_cook", label: "Prep Cook", dept: "boh" },
  { value: "dishwasher", label: "Dishwasher", dept: "boh" },
  { value: "other", label: "Other", dept: "foh" },
];

export function AddShiftModal({
  date,
  employees,
  restaurant,
  onClose,
  onCreated,
}: AddShiftModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default times from restaurant's opening hours
  const dayOfWeek = new Date(date).getDay();
  const dayHours = restaurant.opening_hours.find((h) => h.day === dayOfWeek);
  const defaultStart = dayHours?.open || "09:00";
  const defaultEnd = dayHours?.close || "17:00";

  const [form, setForm] = useState({
    employee_id: "",
    role: "server" as EmployeeRole,
    department: "foh" as Department,
    start_time: defaultStart,
    end_time: defaultEnd,
    break_minutes: "30",
    is_training: false,
    notes: "",
  });

  // Fetch availability for all employees on this day
  const [availMap, setAvailMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    async function loadAvailability() {
      const dayOfWeek = new Date(date).getDay();
      const map = new Map<string, boolean>();

      for (const emp of employees.filter((e) => e.is_active)) {
        try {
          const res = await fetch(`/api/employees/${emp.id}/availability`);
          if (res.ok) {
            const data = await res.json();
            const slots: EmployeeAvailability[] = data.data || [];
            if (slots.length === 0) {
              map.set(emp.id, true);
            } else {
              const daySlot = slots.find((s) => s.day_of_week === dayOfWeek);
              map.set(emp.id, daySlot?.is_available ?? false);
            }
          }
        } catch {
          map.set(emp.id, true);
        }
      }
      setAvailMap(map);
    }
    loadAvailability();
  }, [date, employees]);

  const isAvailable = (empId: string) => availMap.get(empId) ?? true;

  // Filter employees that match the selected role
  const matchingEmployees = employees.filter(
    (e) => e.role === form.role && e.is_active
  );
  const allActiveEmployees = employees.filter((e) => e.is_active);

  const handleRoleChange = (role: EmployeeRole) => {
    const roleDef = ROLES.find((r) => r.value === role);
    setForm((f) => ({
      ...f,
      role,
      department: roleDef?.dept || f.department,
      employee_id: "", // Reset employee when role changes
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          start_time: form.start_time,
          end_time: form.end_time,
          role: form.role,
          department: form.department,
          employee_id: form.employee_id || null,
          break_minutes: parseInt(form.break_minutes) || 0,
          is_training: form.is_training,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create shift");
      }

      const data = await res.json();
      onCreated(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Add Shift</h2>
              <p className="text-sm text-neutral-500">{dateLabel}</p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Role *
              </label>
              <select
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value as EmployeeRole)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <optgroup label="Front of House">
                  {ROLES.filter((r) => r.dept === "foh").map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Back of House">
                  {ROLES.filter((r) => r.dept === "boh").map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Assign to
              </label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Open shift (unassigned)</option>
                {matchingEmployees.length > 0 && (
                  <optgroup label={`${ROLES.find((r) => r.value === form.role)?.label || form.role}s`}>
                    {matchingEmployees
                      .sort((a, b) => (isAvailable(a.id) === isAvailable(b.id) ? 0 : isAvailable(a.id) ? -1 : 1))
                      .map((e) => (
                        <option key={e.id} value={e.id} disabled={!isAvailable(e.id)}>
                          {e.first_name} {e.last_name}{!isAvailable(e.id) ? " (unavailable)" : ""}
                        </option>
                      ))}
                  </optgroup>
                )}
                {matchingEmployees.length < allActiveEmployees.length && (
                  <optgroup label="Other staff">
                    {allActiveEmployees
                      .filter((e) => e.role !== form.role)
                      .sort((a, b) => (isAvailable(a.id) === isAvailable(b.id) ? 0 : isAvailable(a.id) ? -1 : 1))
                      .map((e) => (
                        <option key={e.id} value={e.id} disabled={!isAvailable(e.id)}>
                          {e.first_name} {e.last_name} ({e.role}){!isAvailable(e.id) ? " (unavailable)" : ""}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Times */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Start *
                </label>
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  End *
                </label>
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Break (min)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  value={form.break_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, break_minutes: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Training shift */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_training}
                onChange={(e) => setForm((f) => ({ ...f, is_training: e.target.checked }))}
                className="rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">
                Training / trailing shift (does not count toward coverage)
              </span>
            </label>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g., Close bar, train on POS"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Shift"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
