import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * POST /api/dev/auto-login
 * If a restaurant is already set up in the DB, create a session automatically.
 * Saves having to re-enter credentials every time the session expires.
 */
export async function POST() {
  try {
    const { data } = await getDb()
      .from("restaurants")
      .select("id, slug, name, tableo_restaurant_id")
      .limit(1)
      .single();

    if (!data) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
    }

    const sessionToken = await createSessionToken({
      userId: 1,
      restaurantId: data.tableo_restaurant_id || 0,
      restaurantSlug: data.slug,
      role: "restaurant_admin",
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ success: true, restaurant_name: data.name });
  } catch {
    return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
  }
}
