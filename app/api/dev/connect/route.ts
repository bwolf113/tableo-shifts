import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/dev/connect
 *
 * Tests a Tableo API token by fetching availabilities and bookings.
 * Returns real data from the restaurant.
 */
export async function POST(request: NextRequest) {
  try {
    const { api_token, api_url } = await request.json();

    if (!api_token) {
      return NextResponse.json({ error: "Missing API token" }, { status: 400 });
    }

    const baseUrl = `${api_url || "https://app.tableo.com"}/api/restaurant`;
    const headers = {
      Authorization: `Bearer ${api_token}`,
      Accept: "application/json",
    };

    // 1. Fetch availabilities for today + 14 days
    const today = new Date().toISOString().split("T")[0];
    const availRes = await fetch(
      `${baseUrl}/availabilities?date=${today}&days=14`,
      { headers }
    );

    if (!availRes.ok) {
      if (availRes.status === 401) {
        return NextResponse.json(
          { error: "Invalid API token. Check your token in Tableo → Settings → API Integration." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Tableo API returned ${availRes.status}: ${availRes.statusText}` },
        { status: availRes.status }
      );
    }

    const availData = await availRes.json();
    const availabilities = availData.data || availData || [];

    // 2. Extract opening hours and dining areas from availability data
    const openingHours = extractOpeningHours(availabilities);
    const diningAreas = extractDiningAreas(availabilities);

    // 3. Fetch bookings for the next 7 days
    const bookingsByDate: Record<string, any[]> = {};
    let totalBookings = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      try {
        const bookRes = await fetch(
          `${baseUrl}/bookings?date=${dateStr}`,
          { headers }
        );

        if (bookRes.ok) {
          const bookData = await bookRes.json();
          const dayBookings = bookData.data || bookData || [];
          bookingsByDate[dateStr] = dayBookings;
          totalBookings += dayBookings.length;
        }
      } catch {
        bookingsByDate[dateStr] = [];
      }
    }

    return NextResponse.json({
      success: true,
      availabilities,
      opening_hours: openingHours,
      dining_areas: diningAreas,
      bookings: bookingsByDate,
      total_bookings: totalBookings,
      days_fetched: Object.keys(bookingsByDate).length,
    });
  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}

/**
 * Extract opening hours from Tableo availability slots.
 *
 * Tableo API returns a flat array of slots like:
 * { start_time: "2026-04-14T12:00:00+02:00", end_time: "2026-04-14T14:00:00+02:00", dining_area_id, dining_area_name, party_size }
 *
 * We group by day-of-week across 14 days to determine the pattern.
 */
function extractOpeningHours(
  availabilities: any[]
): Array<{ day: number; open: string; close: string; closed: boolean }> {
  // Group slots by day-of-week, tracking earliest start and latest start+end
  const dayMap = new Map<
    number,
    { earliestStart: string; latestEnd: string; count: number }
  >();

  for (const slot of availabilities) {
    if (!slot.start_time) continue;

    const dateObj = new Date(slot.start_time);
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

    // Extract time portions (HH:MM)
    const startTime = slot.start_time.substring(11, 16);
    // end_time of the last slot is the real closing time
    const endTime = slot.end_time?.substring(11, 16) || startTime;

    const existing = dayMap.get(dayOfWeek);
    if (!existing) {
      dayMap.set(dayOfWeek, {
        earliestStart: startTime,
        latestEnd: endTime,
        count: 1,
      });
    } else {
      if (startTime < existing.earliestStart) {
        existing.earliestStart = startTime;
      }
      // Compare end times, handling midnight crossover
      if (compareTime(endTime, existing.latestEnd) > 0) {
        existing.latestEnd = endTime;
      }
      existing.count++;
    }
  }

  // Build opening hours for all 7 days
  const hours = [];
  for (let day = 0; day < 7; day++) {
    const data = dayMap.get(day);
    if (data) {
      hours.push({
        day,
        open: data.earliestStart,
        close: data.latestEnd,
        closed: false,
      });
    } else {
      hours.push({ day, open: "00:00", close: "00:00", closed: true });
    }
  }

  return hours;
}

/**
 * Compare two time strings, handling midnight crossover.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareTime(a: string, b: string): number {
  // Treat times like 00:00, 00:15 etc. as "after midnight" = later than 23:xx
  const aMinutes = timeToMinutes(a);
  const bMinutes = timeToMinutes(b);
  return aMinutes - bMinutes;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  // If hour is 0-4, treat as next-day (add 24 hours)
  const adjusted = h < 5 ? h + 24 : h;
  return adjusted * 60 + m;
}

/**
 * Extract unique dining areas from availability data.
 */
function extractDiningAreas(
  availabilities: any[]
): Array<{ id: number; name: string }> {
  const seen = new Map<number, string>();

  for (const slot of availabilities) {
    if (slot.dining_area_id && slot.dining_area_name) {
      seen.set(slot.dining_area_id, slot.dining_area_name);
    }
  }

  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.id - b.id);
}
