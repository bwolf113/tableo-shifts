"use client";

import { useState } from "react";
import type { Employee, EmployeeRole, Department, EmploymentType } from "@/types";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { clsx } from "clsx";

interface StaffListProps {
  employees: Employee[];
  restaurantId: string;
  currency: string;
}

const ROLE_LABELS: Record<string, string> = {
  server: "Server",
  bartender: "Bartender",
  host: "Host",
  runner: "Runner",
  busser: "Busser",
  line_cook: "Line Cook",
  prep_cook: "Prep Cook",
  sous_chef: "Sous Chef",
  head_chef: "Head Chef",
  dishwasher: "Dishwasher",
  manager: "Manager",
  assistant_manager: "Asst. Manager",
  barista: "Barista",
  sommelier: "Sommelier",
  other: "Other",
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
};

const DEPT_LABELS: Record<string, string> = {
  foh: "FOH",
  boh: "BOH",
};

export function StaffList({ employees, restaurantId, currency }: StaffListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<Employee | null>(null);
  const [inviteResult, setInviteResult] = useState<{ name: string; url: string; pin: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "foh" | "boh">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleInvite = async (employee: Employee) => {
    try {
      const res = await fetch(`/api/employees/${employee.id}/invite`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setInviteResult({
          name: data.data.employee_name,
          url: data.data.portal_url,
          pin: data.data.pin,
        });
      }
    } catch (err) {
      console.error("Invite failed:", err);
    }
  };

  const filtered = employees.filter((e) => {
    if (filter !== "all" && e.department !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
      return fullName.includes(q) || e.role.includes(q);
    }
    return true;
  });

  const active = filtered.filter((e) => e.is_active);
  const inactive = filtered.filter((e) => !e.is_active);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search staff..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex bg-neutral-100 rounded-lg p-0.5">
          {(["all", "foh", "boh"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                filter === f
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {f === "all" ? "All" : f.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Employee
        </button>
      </div>

      {/* Employee Table */}
      {active.length === 0 && inactive.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
          <p className="text-neutral-500 text-lg mb-2">No staff members yet</p>
          <p className="text-neutral-400 text-sm mb-4">
            Add your first employee to start building schedules.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Add Employee
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Dept
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Hours/wk
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Rate
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase">
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {active.map((employee) => (
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  currency={currency}
                  onEditAvailability={() => setEditingAvailability(employee)}
                  onInvite={() => handleInvite(employee)}
                />
              ))}
              {inactive.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-2 text-xs text-neutral-400 bg-neutral-50"
                    >
                      Inactive ({inactive.length})
                    </td>
                  </tr>
                  {inactive.map((employee) => (
                    <EmployeeRow
                      key={employee.id}
                      employee={employee}
                      currency={currency}
                      inactive
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeModal
          restaurantId={restaurantId}
          currency={currency}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Availability Editor Modal */}
      {editingAvailability && (
        <AvailabilityEditor
          employeeId={editingAvailability.id}
          employeeName={`${editingAvailability.first_name} ${editingAvailability.last_name}`}
          onClose={() => setEditingAvailability(null)}
        />
      )}

      {/* Invite Result Modal */}
      {inviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setInviteResult(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-1">
              Portal Invite for {inviteResult.name}
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              Share these details with the employee so they can view their shifts.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Portal Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteResult.url}
                    className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteResult.url)}
                    className="px-3 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">PIN Code</label>
                <p className="text-3xl font-mono font-bold tracking-[0.3em] text-neutral-900">
                  {inviteResult.pin}
                </p>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              The employee opens the link and enters the PIN to see their shifts,
              request time off, and update their availability.
            </div>

            <button
              onClick={() => setInviteResult(null)}
              className="mt-4 w-full py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeRow({
  employee,
  currency,
  inactive,
  onEditAvailability,
  onInvite,
}: {
  employee: Employee;
  currency: string;
  inactive?: boolean;
  onEditAvailability?: () => void;
  onInvite?: () => void;
}) {
  return (
    <tr className={clsx("hover:bg-neutral-50", inactive && "opacity-50")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: employee.color }}
          >
            {employee.first_name[0]}
            {employee.last_name[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {employee.first_name} {employee.last_name}
            </p>
            {employee.is_minor && (
              <span className="text-xs text-amber-600">Minor</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700">
        {ROLE_LABELS[employee.role] || employee.role}
      </td>
      <td className="px-4 py-3">
        <span
          className={clsx(
            "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
            employee.department === "foh"
              ? "bg-blue-50 text-blue-700"
              : "bg-orange-50 text-orange-700"
          )}
        >
          {DEPT_LABELS[employee.department]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700">
        {TYPE_LABELS[employee.employment_type]}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700">
        {employee.contracted_hours_per_week
          ? `${employee.contracted_hours_per_week}h`
          : "Flex"}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700">
        {currency} {employee.hourly_rate.toFixed(2)}/hr
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">
        {employee.email || employee.phone || "-"}
      </td>
      <td className="px-4 py-3">
        {!inactive && (
          <div className="flex gap-1">
            {onEditAvailability && (
              <button
                onClick={onEditAvailability}
                className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                Availability
              </button>
            )}
            {onInvite && (
              <button
                onClick={onInvite}
                className="px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
              >
                Invite
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
