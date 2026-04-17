import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getOrCreateScheduleWeek,
  getShiftsForWeek,
  getEmployees,
} from "@/lib/queries";
import { Resend } from "resend";
import { format, addDays } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  server: "Server", bartender: "Bartender", host: "Host", runner: "Runner",
  busser: "Busser", line_cook: "Line Cook", prep_cook: "Prep Cook",
  sous_chef: "Sous Chef", head_chef: "Head Chef", dishwasher: "Dishwasher",
  manager: "Manager", assistant_manager: "Asst. Manager", barista: "Barista",
  sommelier: "Sommelier", other: "Other",
};

/**
 * POST /api/schedules/notify
 * Send the published schedule to all staff members who have an email and invite token.
 * Body: { week_start: "2026-04-20" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "Email not configured. Add RESEND_API_KEY to environment variables." }, { status: 503 });
    }

    const { week_start } = await request.json();
    if (!week_start) {
      return NextResponse.json({ error: "Missing week_start" }, { status: 400 });
    }

    const scheduleWeek = await getOrCreateScheduleWeek(restaurant.id, week_start);
    const [shifts, employees] = await Promise.all([
      getShiftsForWeek(scheduleWeek.id),
      getEmployees(restaurant.id),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
    const resend = new Resend(resendKey);
    const fromEmail = process.env.NOTIFY_FROM_EMAIL || "shifts@tableo.com";

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(week_start), i);
      return { dateStr: format(d, "yyyy-MM-dd"), label: format(d, "EEE d MMM") };
    });

    const weekLabel = `${format(new Date(week_start), "d MMM")} – ${format(addDays(new Date(week_start), 6), "d MMM yyyy")}`;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const employee of employees) {
      if (!employee.email) { skipped++; continue; }

      // Build this employee's shifts for the week
      const myShifts = shifts.filter((s) => s.employee_id === employee.id);

      // Build shift rows HTML
      const shiftRows = weekDays.map(({ dateStr, label }) => {
        const dayShifts = myShifts.filter((s) => s.date === dateStr);
        if (dayShifts.length === 0) {
          return `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#999;">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#ccc;">—</td></tr>`;
        }
        return dayShifts.map((s) =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-weight:500;">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${s.start_time}–${s.end_time} &nbsp;<span style="color:#666;font-size:13px;">${ROLE_LABELS[s.role] || s.role}</span></td></tr>`
        ).join("");
      }).join("");

      const totalHours = myShifts.reduce((sum, s) => sum + s.scheduled_hours, 0);

      // Portal link
      const portalLink = employee.invite_token
        ? `${appUrl}/staff/login?token=${employee.invite_token}`
        : null;

      const portalSection = portalLink
        ? `<p style="margin:24px 0 8px;">You can view your shifts and submit time-off requests anytime via your staff portal:</p>
           <p><a href="${portalLink}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">View My Shifts</a></p>
           <p style="font-size:12px;color:#999;margin-top:6px;">Or copy this link: ${portalLink}</p>`
        : "";

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f9f9;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#111;padding:24px 32px;">
      <p style="color:#fff;font-size:18px;font-weight:600;margin:0;">${restaurant.name}</p>
      <p style="color:#aaa;font-size:14px;margin:4px 0 0;">Schedule: ${weekLabel}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;">Hi ${employee.first_name},</p>
      <p style="margin:0 0 16px;">Here is your schedule for the week of <strong>${weekLabel}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${shiftRows}
      </table>
      ${totalHours > 0 ? `<p style="margin:16px 0 0;font-size:13px;color:#666;">Total: <strong>${totalHours.toFixed(1)} hours</strong></p>` : ""}
      ${portalSection}
    </div>
    <div style="padding:16px 32px;background:#f9f9f9;font-size:12px;color:#aaa;border-top:1px solid #f0f0f0;">
      Sent by Tableo Shifts &bull; ${restaurant.name}
    </div>
  </div>
</body>
</html>`;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: employee.email,
          subject: `Your schedule: ${weekLabel} — ${restaurant.name}`,
          html,
        });
        sent++;
      } catch (err) {
        errors.push(`${employee.first_name} ${employee.last_name}: ${err instanceof Error ? err.message : "send failed"}`);
      }
    }

    return NextResponse.json({
      data: { sent, skipped, errors },
    });
  } catch (error) {
    console.error("Notify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
