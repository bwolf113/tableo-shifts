import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import { updateShift, deleteShift, getEmployeeById } from "@/lib/queries";
import {
  calculateShiftHours,
  calculateShiftCost,
} from "@/lib/scheduler/staffing-calculator";

/**
 * PATCH /api/shifts/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Recalculate hours and cost if times or employee changed
    if (body.start_time && body.end_time) {
      const breakMins = body.break_minutes ?? 0;
      const hours = calculateShiftHours(body.start_time, body.end_time, breakMins);
      body.scheduled_hours = Math.round(hours * 100) / 100;

      // Recalculate cost if we have an employee
      const empId = body.employee_id;
      if (empId) {
        const employee = await getEmployeeById(empId);
        if (employee) {
          body.estimated_cost = calculateShiftCost(hours, employee.hourly_rate);
        }
      } else {
        body.estimated_cost = 0;
      }
    }

    const shift = await updateShift(id, body);

    return NextResponse.json({ data: shift });
  } catch (error) {
    console.error("Update shift error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/shifts/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteShift(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete shift error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
