import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import { updateRestaurant } from "@/lib/queries";

/**
 * PATCH /api/restaurants/[id]
 * Update restaurant settings (ratios, service periods, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific settings fields
    const allowedFields = [
      "api_token",
      "covers_per_staff",
      "avg_spend_per_cover",
      "target_labor_cost_pct",
      "walkin_factor_pct",
      "noshow_factor_pct",
      "service_periods",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const restaurant = await updateRestaurant(id, updates);

    return NextResponse.json({ data: restaurant });
  } catch (error) {
    console.error("Update restaurant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
