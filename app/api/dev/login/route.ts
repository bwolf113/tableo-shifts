import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/queries";

/**
 * POST /api/dev/login
 *
 * Creates a session for a connected restaurant using slug.
 * In production, this happens via JWT from Tableo.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const slug = body.slug;

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found. Run setup first." },
        { status: 404 }
      );
    }

    const sessionToken = await createSessionToken({
      userId: 1,
      restaurantId: restaurant.tableo_restaurant_id || 0,
      restaurantSlug: restaurant.slug,
      role: "restaurant_admin",
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({
      success: true,
      redirect: "/dashboard",
      restaurant_name: restaurant.name,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
