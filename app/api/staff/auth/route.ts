import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { getDb } from "@/lib/db";

const STAFF_COOKIE = "tableo_shifts_staff";
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days

/**
 * POST /api/staff/auth
 *
 * Staff portal login. Verify invite token + PIN.
 * Body: { token: string, pin: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { token, pin } = await request.json();

    if (!token || !pin) {
      return NextResponse.json(
        { error: "Missing token or PIN" },
        { status: 400 }
      );
    }

    // Find employee by invite token
    const { data: employee, error } = await getDb()
      .from("employees")
      .select("*, restaurant:restaurants(*)")
      .eq("invite_token", token)
      .single();

    if (error || !employee) {
      return NextResponse.json(
        { error: "Invalid link. Ask your manager for a new one." },
        { status: 401 }
      );
    }

    // Verify PIN
    if (employee.portal_password_hash !== pin) {
      return NextResponse.json(
        { error: "Incorrect PIN" },
        { status: 401 }
      );
    }

    // Create a staff session JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Missing JWT_SECRET");

    const sessionToken = await new SignJWT({
      employeeId: employee.id,
      restaurantId: employee.restaurant_id,
      name: `${employee.first_name} ${employee.last_name}`,
      role: employee.role,
      type: "staff",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION}s`)
      .setIssuer("shifts.tableo.com")
      .sign(new TextEncoder().encode(secret));

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(STAFF_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_DURATION,
      path: "/",
    });

    // Update last login
    await getDb()
      .from("employees")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", employee.id);

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        role: employee.role,
        restaurant_name: employee.restaurant?.name,
      },
    });
  } catch (error) {
    console.error("Staff auth error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
