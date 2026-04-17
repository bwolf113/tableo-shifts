import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff-auth";
import { getShiftsForEmployee } from "@/lib/queries";

/**
 * GET /api/staff/shifts
 * Returns all shifts for the authenticated staff member (past year + next year).
 */
export async function GET() {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const shifts = await getShiftsForEmployee(
      session.employeeId,
      startDate.toISOString().split("T")[0],
      endDate.toISOString().split("T")[0]
    );

    return NextResponse.json({ data: shifts });
  } catch (error) {
    console.error("Staff shifts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
