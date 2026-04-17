import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/auth";
import { upsertRestaurant } from "@/lib/queries";

/**
 * POST /api/webhooks/restaurant-sync
 *
 * Webhook from Tableo main app to create/update restaurant in Shifts.
 * Called when:
 *  - Restaurant activates the Shifts add-on
 *  - Restaurant updates opening hours or service settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("X-Tableo-Signature") || "";

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, signature);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);

    const {
      tableo_restaurant_id,
      name,
      timezone,
      country_code,
      currency,
      opening_hours,
      service_periods,
    } = payload;

    if (!tableo_restaurant_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: tableo_restaurant_id, name" },
        { status: 400 }
      );
    }

    // Calculate trial end (2 months from now)
    const trialEnds = new Date();
    trialEnds.setMonth(trialEnds.getMonth() + 2);

    const restaurant = await upsertRestaurant({
      tableo_restaurant_id,
      name,
      timezone: timezone || "Europe/London",
      country_code: country_code || "MT",
      currency: currency || "EUR",
      opening_hours: opening_hours || [],
      service_periods: service_periods || [],
      trial_ends_at: trialEnds.toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        restaurant_id: restaurant.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
