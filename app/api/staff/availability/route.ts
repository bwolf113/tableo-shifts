import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff-auth";
import {
  getEmployeeAvailability,
  setEmployeeAvailability,
} from "@/lib/queries";

/**
 * GET /api/staff/availability — get my availability
 */
export async function GET() {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const availability = await getEmployeeAvailability(session.employeeId);

    return NextResponse.json({ data: availability });
  } catch (error) {
    console.error("Staff availability error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/staff/availability — update my availability
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { availability } = await request.json();

    if (!Array.isArray(availability)) {
      return NextResponse.json(
        { error: "availability must be an array" },
        { status: 400 }
      );
    }

    const slots = availability.map((a: any) => ({
      employee_id: session.employeeId,
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      is_available: a.is_available,
    }));

    await setEmployeeAvailability(session.employeeId, slots);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Staff availability update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
