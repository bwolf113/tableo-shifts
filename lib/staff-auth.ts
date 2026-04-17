import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const STAFF_COOKIE = "tableo_shifts_staff";

export interface StaffSession {
  employeeId: string;
  restaurantId: string;
  name: string;
  role: string;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    const cookieStore = await cookies();
    const token = cookieStore.get(STAFF_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { issuer: "shifts.tableo.com" }
    );

    if (payload.type !== "staff") return null;

    return {
      employeeId: payload.employeeId as string,
      restaurantId: payload.restaurantId as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}
