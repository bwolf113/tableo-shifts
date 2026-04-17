import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getEmployees,
  createEmployee,
  getRestaurantForSession,
} from "@/lib/queries";

/**
 * GET /api/employees
 * List all employees for the current restaurant.
 */
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const employees = await getEmployees(restaurant.id);

    return NextResponse.json({ data: employees });
  } catch (error) {
    console.error("Get employees error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees
 * Create a new employee.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    const {
      first_name,
      last_name,
      role,
      department,
      employment_type,
      hourly_rate,
    } = body;

    if (!first_name || !last_name || !role || !department || !employment_type || hourly_rate === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const employee = await createEmployee({
      restaurant_id: restaurant.id,
      first_name,
      last_name,
      email: body.email || null,
      phone: body.phone || null,
      role,
      department,
      employment_type,
      contracted_hours_per_week: body.contracted_hours_per_week || null,
      hourly_rate,
      currency: restaurant.currency,
      skills: body.skills || [],
      dining_area_ids: body.dining_area_ids || [],
      start_date: body.start_date || new Date().toISOString().split("T")[0],
      end_date: null,
      is_active: true,
      is_minor: body.is_minor || false,
      color: body.color || "#3B82F6",
      invite_token: null,
      invite_sent_at: null,
      last_login_at: null,
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (error) {
    console.error("Create employee error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
