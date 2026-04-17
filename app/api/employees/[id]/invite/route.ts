import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import { updateEmployee, getEmployeeById } from "@/lib/queries";
import { randomBytes } from "crypto";

/**
 * POST /api/employees/[id]/invite
 *
 * Generate an invite token + PIN for the staff portal.
 * Returns the portal URL the manager can share with the employee.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const employee = await getEmployeeById(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Generate a unique token and a 4-digit PIN
    const token = randomBytes(16).toString("hex");
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    // Store token. Use portal_password_hash to store the PIN (simple for now)
    await updateEmployee(id, {
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
      portal_password_hash: pin,
    } as any);

    // Build the portal URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
    const portalUrl = `${baseUrl}/staff/login?token=${token}`;

    return NextResponse.json({
      data: {
        portal_url: portalUrl,
        pin,
        employee_name: `${employee.first_name} ${employee.last_name}`,
      },
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
