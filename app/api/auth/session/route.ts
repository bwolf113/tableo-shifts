import { NextRequest, NextResponse } from "next/server";
import {
  verifyTableoToken,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { getRestaurantByTableoId } from "@/lib/queries";

/**
 * POST /api/auth/session
 *
 * Exchange a Tableo JWT for a Shifts app session cookie.
 * Called when the user navigates to Shifts from the Tableo dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verify the Tableo JWT
    const tableoUser = await verifyTableoToken(token);

    // Verify the restaurant exists in our system
    const restaurant = await getRestaurantByTableoId(tableoUser.restaurant_id);
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found. Please activate Shifts from Tableo." },
        { status: 404 }
      );
    }

    // Create session
    const sessionToken = await createSessionToken({
      userId: tableoUser.sub,
      restaurantId: tableoUser.restaurant_id,
      restaurantSlug: restaurant.slug,
      role: tableoUser.role,
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        plan_status: restaurant.plan_status,
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
