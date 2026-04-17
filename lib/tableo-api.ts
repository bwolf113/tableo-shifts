/**
 * Client for the Tableo core platform public API.
 *
 * Endpoints used:
 *   GET /api/restaurant/availabilities — service hours, time slots
 *   GET /api/restaurant/bookings      — daily bookings with party sizes
 *
 * Auth: Bearer token per restaurant (created in Tableo Settings > API Integration)
 */

const TABLEO_API_URL =
  process.env.TABLEO_API_URL || "https://app.tableo.com/api/restaurant";

export interface TableoAvailability {
  date: string;
  spots_total: number;
  spots_open: number;
  time_slots: Array<{
    time: string;
    spots_total: number;
    spots_open: number;
    dining_area_id: number;
    dining_area_name: string;
  }>;
}

export interface TableoBooking {
  id: number;
  reference: string;
  status: string;
  date: string;         // ISO datetime: "2026-04-14T18:00:00+02:00"
  end_time: string;     // ISO datetime: "2026-04-14T20:00:00+02:00"
  adults: number;
  children: number;
  comment: string;
  dining_area: {
    id: number;
    name: string;
  };
  tables: Array<{
    id: number;
    name: string;
    covers: number;
  }>;
  patron?: {
    name: string;
    email: string;
    mobile_number: string;
  };
}

/**
 * Get total covers (adults + children) from a booking.
 */
export function getBookingCovers(booking: TableoBooking): number {
  return (booking.adults || 0) + (booking.children || 0);
}

/**
 * Get the time portion (HH:MM) from a booking's ISO date string.
 */
export function getBookingTime(booking: TableoBooking): string {
  return booking.date.substring(11, 16);
}

export interface TableoServiceHours {
  date: string;
  service_hours: Array<{
    name: string;
    start: string;
    end: string;
  }>;
}

interface ApiOptions {
  apiToken: string;
  baseUrl?: string;
}

/**
 * Fetch availability/service hours for a date range.
 */
export async function getAvailabilities(
  date: string,
  days: number,
  opts: ApiOptions
): Promise<TableoAvailability[]> {
  const url = `${opts.baseUrl || TABLEO_API_URL}/availabilities?date=${date}&days=${days}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.apiToken}`,
      Accept: "application/json",
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!res.ok) {
    throw new Error(`Tableo API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Fetch bookings for a specific date.
 */
export async function getBookings(
  date: string,
  opts: ApiOptions
): Promise<TableoBooking[]> {
  const url = `${opts.baseUrl || TABLEO_API_URL}/bookings?date=${date}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.apiToken}`,
      Accept: "application/json",
    },
    cache: "no-store", // Always fetch fresh booking data
  });

  if (!res.ok) {
    throw new Error(`Tableo API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Fetch bookings for a range of dates (batches individual date calls).
 */
export async function getBookingsForRange(
  startDate: string,
  days: number,
  opts: ApiOptions
): Promise<Map<string, TableoBooking[]>> {
  const results = new Map<string, TableoBooking[]>();
  const start = new Date(startDate);

  // Batch requests (respect rate limits: max 60/min)
  const batchSize = 7; // One week at a time
  for (let i = 0; i < days; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, days); j++) {
      const date = new Date(start);
      date.setDate(date.getDate() + j);
      const dateStr = date.toISOString().split("T")[0];
      batch.push(
        getBookings(dateStr, opts).then((bookings) => ({
          date: dateStr,
          bookings,
        }))
      );
    }

    const batchResults = await Promise.all(batch);
    for (const { date, bookings } of batchResults) {
      results.set(date, bookings);
    }
  }

  return results;
}

/**
 * Calculate total covers from bookings, applying no-show and walk-in factors.
 */
export function calculateExpectedCovers(
  bookings: TableoBooking[],
  noshowFactorPct: number = 10,
  walkinFactorPct: number = 20
): number {
  const bookedCovers = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show" && b.status !== "tentative")
    .reduce((sum, b) => sum + getBookingCovers(b), 0);

  const afterNoshows = bookedCovers * (1 - noshowFactorPct / 100);
  const withWalkins = afterNoshows * (1 + walkinFactorPct / 100);

  return Math.round(withWalkins);
}

/**
 * Group bookings by time period (Lunch, Dinner, etc.)
 */
export function groupBookingsByPeriod(
  bookings: TableoBooking[],
  servicePeriods: Array<{ name: string; start: string; end: string }>
): Record<string, { covers: number; bookings: number }> {
  const result: Record<string, { covers: number; bookings: number }> = {};

  for (const period of servicePeriods) {
    result[period.name] = { covers: 0, bookings: 0 };
  }

  for (const booking of bookings) {
    if (booking.status === "cancelled" || booking.status === "no_show" || booking.status === "tentative") continue;

    const time = getBookingTime(booking);
    for (const period of servicePeriods) {
      if (time >= period.start && time < period.end) {
        result[period.name].covers += getBookingCovers(booking);
        result[period.name].bookings += 1;
        break;
      }
    }
  }

  return result;
}
