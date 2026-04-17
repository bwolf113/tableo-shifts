import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getEmployeeAvailability,
  setEmployeeAvailability,
} from "@/lib/queries";

/**
 * GET /api/employees/[id]/availability
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const availability = await getEmployeeAvailability(id);

    return NextResponse.json({ data: availability });
  } catch (error) {
    console.error("Get availability error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/employees/[id]/availability
 * Body: { availability: [{ employee_id, day_of_week, start_time, end_time, is_available }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { availability } = await request.json();

    if (!Array.isArray(availability)) {
      return NextResponse.json(
        { error: "availability must be an array" },
        { status: 400 }
      );
    }

    // Ensure all entries have the correct employee_id
    const slots = availability.map((a: any) => ({
      employee_id: id,
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      is_available: a.is_available,
    }));

    await setEmployeeAvailability(id, slots);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set availability error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
