import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "tableo_shifts_session";
const SESSION_DURATION = 24 * 60 * 60; // 24 hours

export interface TableoUser {
  sub: number;           // User ID in Tableo
  restaurant_id: number; // Restaurant ID in Tableo
  role: string;          // restaurant_admin, restaurant_manager, etc.
  exp: number;
}

export interface SessionUser {
  userId: number;
  restaurantId: number;
  restaurantSlug: string;
  role: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(secret);
}

/**
 * Verify an incoming JWT token from the Tableo main app.
 */
export async function verifyTableoToken(token: string): Promise<TableoUser> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: "app.tableo.com",
  });

  return {
    sub: payload.sub as unknown as number,
    restaurant_id: payload.restaurant_id as number,
    role: payload.role as string,
    exp: payload.exp as number,
  };
}

/**
 * Create a session JWT for the Shifts app.
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    userId: user.userId,
    restaurantId: user.restaurantId,
    restaurantSlug: user.restaurantSlug,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .setIssuer("shifts.tableo.com")
    .sign(getJwtSecret());
}

/**
 * Set session cookie after token exchange.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Get the current session user from cookies.
 * Returns null if no valid session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: "shifts.tableo.com",
    });

    return {
      userId: payload.userId as number,
      restaurantId: payload.restaurantId as number,
      restaurantSlug: payload.restaurantSlug as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the user has permission to manage shifts.
 */
export function canManageShifts(role: string): boolean {
  return ["restaurant_admin", "restaurant_manager"].includes(role);
}

/**
 * Check if the user has admin-level access.
 */
export function isAdmin(role: string): boolean {
  return role === "restaurant_admin";
}

/**
 * Verify webhook signature from Tableo.
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing WEBHOOK_SECRET");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}
