"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeRole, Department, EmploymentType } from "@/types";

interface AddEmployeeModalProps {
  restaurantId: string;
  currency: string;
  onClose: () => void;
}

const ROLES: { value: EmployeeRole; label: string; dept: Department }[] = [
  // FOH
  { value: "manager", label: "Manager", dept: "foh" },
  { value: "assistant_manager", label: "Assistant Manager", dept: "foh" },
  { value: "host", label: "Host / Hostess", dept: "foh" },
  { value: "server", label: "Server", dept: "foh" },
  { value: "bartender", label: "Bartender", dept: "foh" },
  { value: "barista", label: "Barista", dept: "foh" },
  { value: "sommelier", label: "Sommelier", dept: "foh" },
  { value: "runner", label: "Runner", dept: "foh" },
  { value: "busser", label: "Busser", dept: "foh" },
  // BOH
  { value: "head_chef", label: "Head Chef", dept: "boh" },
  { value: "sous_chef", label: "Sous Chef", dept: "boh" },
  { value: "line_cook", label: "Line Cook", dept: "boh" },
  { value: "prep_cook", label: "Prep Cook", dept: "boh" },
  { value: "dishwasher", label: "Dishwasher", dept: "boh" },
  // Other
  { value: "other", label: "Other", dept: "foh" },
];

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
  "#E11D48", "#84CC16",
];

export function AddEmployeeModal({
  restaurantId,
  currency,
  onClose,
}: AddEmployeeModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "server" as EmployeeRole,
    department: "foh" as Department,
    employment_type: "full_time" as EmploymentType,
    contracted_hours_per_week: "40",
    hourly_rate: "",
    is_minor: false,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  });

  const handleRoleChange = (role: EmployeeRole) => {
    const roleDef = ROLES.find((r) => r.value === role);
    setForm((f) => ({
      ...f,
      role,
      department: roleDef?.dept || f.department,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          department: form.department,
          employment_type: form.employment_type,
          contracted_hours_per_week:
            form.employment_type === "casual"
              ? null
              : parseFloat(form.contracted_hours_per_week) || null,
          hourly_rate: parseFloat(form.hourly_rate),
          is_minor: form.is_minor,
          color: form.color,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create employee");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-neutral-900">
              Add Employee
            </h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600"
            >
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
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  First name *
                </label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Last name *
                </label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Role *
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  handleRoleChange(e.target.value as EmployeeRole)
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <optgroup label="Front of House">
                  {ROLES.filter((r) => r.dept === "foh").map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Back of House">
                  {ROLES.filter((r) => r.dept === "boh").map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Employment Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Employment type *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "full_time", label: "Full-time" },
                    { value: "part_time", label: "Part-time" },
                    { value: "casual", label: "Casual" },
                  ] as const
                ).map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        employment_type: type.value,
                        contracted_hours_per_week:
                          type.value === "casual"
                            ? ""
                            : type.value === "full_time"
                              ? "40"
                              : "20",
                      }))
                    }
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      form.employment_type === type.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hours & Rate */}
            <div className="grid grid-cols-2 gap-3">
              {form.employment_type !== "casual" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Hours/week
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="60"
                    value={form.contracted_hours_per_week}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        contracted_hours_per_week: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className={form.employment_type === "casual" ? "col-span-2" : ""}>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Hourly rate ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.hourly_rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hourly_rate: e.target.value }))
                  }
                  placeholder="12.50"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Color & Minor */}
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Colour
                </label>
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        form.color === c
                          ? "ring-2 ring-offset-1 ring-neutral-900 scale-110"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 ml-auto cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_minor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_minor: e.target.checked }))
                  }
                  className="rounded border-neutral-300"
                />
                <span className="text-sm text-neutral-700">Minor (under 18)</span>
              </label>
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
                {saving ? "Adding..." : "Add Employee"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
