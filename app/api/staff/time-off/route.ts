import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff-auth";
import { getDb } from "@/lib/db";
import { getEmployeeById } from "@/lib/queries";

/**
 * GET /api/staff/time-off — get my time-off requests
 */
export async function GET() {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await getDb()
      .from("time_off_requests")
      .select("*")
      .eq("employee_id", session.employeeId)
      .order("start_date", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Staff time-off error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/staff/time-off — submit a time-off request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { start_date, end_date, reason, leave_type } = await request.json();

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing start_date or end_date" },
        { status: 400 }
      );
    }

    const { data, error } = await getDb()
      .from("time_off_requests")
      .insert({
        employee_id: session.employeeId,
        restaurant_id: session.restaurantId,
        leave_type: leave_type || "time_off",
        start_date,
        end_date,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Staff time-off submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
