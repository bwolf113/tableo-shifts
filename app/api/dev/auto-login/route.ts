import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * POST /api/dev/auto-login
 * - No body: returns list of restaurants if multiple exist, or auto-logs in if only one.
 * - Body { slug }: logs in to that specific restaurant.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const { data: restaurants } = await getDb()
      .from("restaurants")
      .select("id, slug, name, tableo_restaurant_id")
      .order("created_at", { ascending: false });

    if (!restaurants || restaurants.length === 0) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
    }

    // If a specific slug was requested, use it; otherwise use the only one or return the list
    let restaurant;
    if (body.slug) {
      restaurant = restaurants.find((r) => r.slug === body.slug);
      if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else if (restaurants.length === 1) {
      restaurant = restaurants[0];
    } else {
      // Multiple — return the list for the picker
      return NextResponse.json({ restaurants: restaurants.map((r) => ({ slug: r.slug, name: r.name })) });
    }

    const sessionToken = await createSessionToken({
      userId: 1,
      restaurantId: restaurant.tableo_restaurant_id || 0,
      restaurantSlug: restaurant.slug,
      role: "restaurant_admin",
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ success: true, restaurant_name: restaurant.name });
  } catch {
    return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
  }
}
