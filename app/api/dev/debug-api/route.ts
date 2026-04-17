import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/dev/debug-api
 *
 * Returns the raw response from the Tableo API so we can see the exact structure.
 */
export async function POST(request: NextRequest) {
  try {
    const { api_token, api_url } = await request.json();

    const baseUrl = `${api_url || "https://app.tableo.com"}/api/restaurant`;
    const headers = {
      Authorization: `Bearer ${api_token}`,
      Accept: "application/json",
    };

    const today = new Date().toISOString().split("T")[0];

    // Fetch availabilities
    const availRes = await fetch(
      `${baseUrl}/availabilities?date=${today}&days=3`,
      { headers }
    );
    const availRaw = await availRes.json();

    // Fetch one day of bookings
    const bookRes = await fetch(
      `${baseUrl}/bookings?date=${today}`,
      { headers }
    );
    const bookRaw = await bookRes.json();

    return NextResponse.json({
      availabilities_status: availRes.status,
      availabilities_raw: availRaw,
      bookings_status: bookRes.status,
      bookings_raw: bookRaw,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed",
    });
  }
}
