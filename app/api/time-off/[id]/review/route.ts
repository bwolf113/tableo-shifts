import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  reviewTimeOffRequest,
  getShiftsForEmployee,
  getEmployeeById,
} from "@/lib/queries";
import { getDb } from "@/lib/db";

/**
 * POST /api/time-off/[id]/review
 * Body: { status: "approved" | "denied", note?: string, auto_open_shifts?: boolean }
 *
 * When approving, checks for conflicting shifts and optionally marks them as open.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status, note, auto_open_shifts } = await request.json();

    if (!status || !["approved", "denied"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved' or 'denied'" },
        { status: 400 }
      );
    }

    // Get the request first to check for conflicts
    const { data: timeOffReq, error: fetchErr } = await getDb()
      .from("time_off_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !timeOffReq) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Only pass reviewed_by if it's a valid UUID
    const reviewedBy = session.userId.toString();
    const updated = await reviewTimeOffRequest(
      id,
      status,
      reviewedBy.includes("-") ? reviewedBy : undefined,
      note
    );

    // If approving, check for conflicting shifts
    let conflictingShifts: any[] = [];
    let shiftsOpened = 0;

    if (status === "approved") {
      const shifts = await getShiftsForEmployee(
        timeOffReq.employee_id,
        timeOffReq.start_date,
        timeOffReq.end_date
      );

      conflictingShifts = shifts.map((s) => ({
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        role: s.role,
      }));

      // If auto_open_shifts is true, unassign the employee from conflicting shifts
      if (auto_open_shifts && conflictingShifts.length > 0) {
        for (const shift of shifts) {
          await getDb()
            .from("shifts")
            .update({
              employee_id: null,
              is_open: true,
              notes: `Opened: ${timeOffReq.leave_type || "time_off"} approved for original employee`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", shift.id);
        }
        shiftsOpened = shifts.length;
      }
    }

    const employee = await getEmployeeById(timeOffReq.employee_id);

    return NextResponse.json({
      data: updated,
      conflicts: {
        has_conflicts: conflictingShifts.length > 0,
        shifts: conflictingShifts,
        shifts_opened: shiftsOpened,
        employee_name: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Employee",
      },
    });
  } catch (error) {
    console.error("Review time-off error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
