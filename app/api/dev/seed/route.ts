import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/dev/seed
 *
 * DEV ONLY: Seeds test data and creates a dev session.
 * Remove this route before going to production.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const db = getDb();

  // 1. Create a test restaurant
  const { data: restaurant, error: restError } = await db
    .from("restaurants")
    .upsert(
      {
        tableo_restaurant_id: 99901,
        name: "La Trattoria Da Marco",
        timezone: "Europe/Malta",
        country_code: "MT",
        currency: "EUR",
        opening_hours: [
          { day: 0, open: "12:00", close: "22:00", closed: false },
          { day: 1, open: "00:00", close: "00:00", closed: true },
          { day: 2, open: "12:00", close: "23:00", closed: false },
          { day: 3, open: "12:00", close: "23:00", closed: false },
          { day: 4, open: "12:00", close: "23:00", closed: false },
          { day: 5, open: "12:00", close: "00:00", closed: false },
          { day: 6, open: "12:00", close: "00:00", closed: false },
        ],
        service_periods: [
          { name: "Lunch", start: "12:00", end: "15:00" },
          { name: "Dinner", start: "18:00", end: "23:00" },
        ],
        covers_per_staff: {
          server: 15,
          bartender: 25,
          line_cook: 35,
          host: 50,
          runner: 20,
          dishwasher: 60,
        },
        avg_spend_per_cover: 45.0,
        target_labor_cost_pct: 30.0,
        walkin_factor_pct: 20.0,
        noshow_factor_pct: 10.0,
        plan_status: "active",
      },
      { onConflict: "tableo_restaurant_id" }
    )
    .select()
    .single();

  if (restError) {
    return NextResponse.json({ error: `Restaurant: ${restError.message}` }, { status: 500 });
  }

  // 2. Assign Malta compliance profile if it exists
  const { data: maltaProfile } = await db
    .from("compliance_profiles")
    .select("id")
    .eq("country_code", "MT")
    .eq("is_default", true)
    .limit(1)
    .single();

  if (maltaProfile) {
    await db
      .from("restaurants")
      .update({ compliance_profile_id: maltaProfile.id })
      .eq("id", restaurant.id);
  }

  // 3. Create test employees
  const employees = [
    { first_name: "Maria", last_name: "Vella", role: "manager", department: "foh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 18.00, color: "#6366F1", email: "maria@latrattoria.mt" },
    { first_name: "Luke", last_name: "Borg", role: "server", department: "foh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 12.50, color: "#3B82F6", email: "luke@latrattoria.mt" },
    { first_name: "Sofia", last_name: "Camilleri", role: "server", department: "foh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 12.50, color: "#EC4899", email: "sofia@latrattoria.mt" },
    { first_name: "James", last_name: "Farrugia", role: "server", department: "foh", employment_type: "part_time", contracted_hours_per_week: 24, hourly_rate: 11.50, color: "#10B981" },
    { first_name: "Nina", last_name: "Zammit", role: "bartender", department: "foh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 13.00, color: "#F59E0B", email: "nina@latrattoria.mt" },
    { first_name: "Daniel", last_name: "Grech", role: "host", department: "foh", employment_type: "part_time", contracted_hours_per_week: 20, hourly_rate: 11.00, color: "#14B8A6" },
    { first_name: "Alex", last_name: "Muscat", role: "runner", department: "foh", employment_type: "casual", contracted_hours_per_week: null, hourly_rate: 10.50, color: "#8B5CF6", is_minor: true },
    { first_name: "Marco", last_name: "Spiteri", role: "head_chef", department: "boh", employment_type: "full_time", contracted_hours_per_week: 44, hourly_rate: 22.00, color: "#EF4444", email: "marco@latrattoria.mt" },
    { first_name: "Toni", last_name: "Galea", role: "sous_chef", department: "boh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 16.00, color: "#F97316" },
    { first_name: "Chris", last_name: "Azzopardi", role: "line_cook", department: "boh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 13.50, color: "#84CC16" },
    { first_name: "Sarah", last_name: "Mifsud", role: "line_cook", department: "boh", employment_type: "part_time", contracted_hours_per_week: 24, hourly_rate: 12.00, color: "#06B6D4" },
    { first_name: "Joe", last_name: "Calleja", role: "dishwasher", department: "boh", employment_type: "full_time", contracted_hours_per_week: 40, hourly_rate: 10.00, color: "#E11D48" },
  ];

  // Delete existing employees for this restaurant first
  await db.from("employees").delete().eq("restaurant_id", restaurant.id);

  const { data: createdEmployees, error: empError } = await db
    .from("employees")
    .insert(
      employees.map((e) => ({
        restaurant_id: restaurant.id,
        ...e,
        skills: [],
        dining_area_ids: [],
        is_active: true,
        is_minor: (e as any).is_minor || false,
      }))
    )
    .select();

  if (empError) {
    return NextResponse.json({ error: `Employees: ${empError.message}` }, { status: 500 });
  }

  // 4. Create a schedule week with shifts for this week
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const weekStart = monday.toISOString().split("T")[0];

  // Delete existing schedule data for this week
  const { data: existingWeek } = await db
    .from("schedule_weeks")
    .select("id")
    .eq("restaurant_id", restaurant.id)
    .eq("week_start", weekStart)
    .single();

  if (existingWeek) {
    await db.from("shifts").delete().eq("schedule_week_id", existingWeek.id);
    await db.from("schedule_weeks").delete().eq("id", existingWeek.id);
  }

  const { data: scheduleWeek, error: swError } = await db
    .from("schedule_weeks")
    .insert({
      restaurant_id: restaurant.id,
      week_start: weekStart,
      status: "draft",
    })
    .select()
    .single();

  if (swError) {
    return NextResponse.json({ error: `Schedule: ${swError.message}` }, { status: 500 });
  }

  // Build shifts for the week
  const empByRole = (role: string) =>
    createdEmployees?.filter((e) => e.role === role) || [];

  const shiftDefs: Array<{
    dayOffset: number;
    start_time: string;
    end_time: string;
    role: string;
    department: string;
    break_minutes: number;
    employeeIndex: number;
  }> = [];

  // Tuesday through Saturday (closed Monday, lighter Sunday)
  for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
    // Manager - full day
    shiftDefs.push({ dayOffset, start_time: "11:00", end_time: "23:00", role: "manager", department: "foh", break_minutes: 60, employeeIndex: 0 });
    // Servers - lunch
    shiftDefs.push({ dayOffset, start_time: "11:30", end_time: "15:30", role: "server", department: "foh", break_minutes: 0, employeeIndex: 0 });
    shiftDefs.push({ dayOffset, start_time: "11:30", end_time: "15:30", role: "server", department: "foh", break_minutes: 0, employeeIndex: 1 });
    // Servers - dinner
    shiftDefs.push({ dayOffset, start_time: "17:00", end_time: "23:00", role: "server", department: "foh", break_minutes: 30, employeeIndex: 0 });
    shiftDefs.push({ dayOffset, start_time: "17:00", end_time: "23:00", role: "server", department: "foh", break_minutes: 30, employeeIndex: 1 });
    shiftDefs.push({ dayOffset, start_time: "17:00", end_time: "23:00", role: "server", department: "foh", break_minutes: 30, employeeIndex: 2 });
    // Bartender
    shiftDefs.push({ dayOffset, start_time: "17:00", end_time: "00:00", role: "bartender", department: "foh", break_minutes: 30, employeeIndex: 0 });
    // Host - dinner only
    shiftDefs.push({ dayOffset, start_time: "17:30", end_time: "22:30", role: "host", department: "foh", break_minutes: 0, employeeIndex: 0 });
    // Head chef
    shiftDefs.push({ dayOffset, start_time: "10:00", end_time: "23:00", role: "head_chef", department: "boh", break_minutes: 60, employeeIndex: 0 });
    // Sous chef
    shiftDefs.push({ dayOffset, start_time: "11:00", end_time: "23:00", role: "sous_chef", department: "boh", break_minutes: 60, employeeIndex: 0 });
    // Line cooks
    shiftDefs.push({ dayOffset, start_time: "10:00", end_time: "16:00", role: "line_cook", department: "boh", break_minutes: 30, employeeIndex: 0 });
    shiftDefs.push({ dayOffset, start_time: "16:00", end_time: "23:00", role: "line_cook", department: "boh", break_minutes: 30, employeeIndex: 1 });
    // Dishwasher
    shiftDefs.push({ dayOffset, start_time: "11:00", end_time: "23:00", role: "dishwasher", department: "boh", break_minutes: 60, employeeIndex: 0 });
  }

  // Sunday (lighter)
  shiftDefs.push({ dayOffset: 6, start_time: "11:00", end_time: "22:00", role: "manager", department: "foh", break_minutes: 60, employeeIndex: 0 });
  shiftDefs.push({ dayOffset: 6, start_time: "11:30", end_time: "22:00", role: "server", department: "foh", break_minutes: 30, employeeIndex: 0 });
  shiftDefs.push({ dayOffset: 6, start_time: "11:30", end_time: "22:00", role: "server", department: "foh", break_minutes: 30, employeeIndex: 1 });
  shiftDefs.push({ dayOffset: 6, start_time: "17:00", end_time: "22:00", role: "bartender", department: "foh", break_minutes: 0, employeeIndex: 0 });
  shiftDefs.push({ dayOffset: 6, start_time: "10:00", end_time: "22:00", role: "head_chef", department: "boh", break_minutes: 60, employeeIndex: 0 });
  shiftDefs.push({ dayOffset: 6, start_time: "10:00", end_time: "22:00", role: "line_cook", department: "boh", break_minutes: 30, employeeIndex: 0 });
  shiftDefs.push({ dayOffset: 6, start_time: "11:00", end_time: "22:00", role: "dishwasher", department: "boh", break_minutes: 60, employeeIndex: 0 });

  const shiftsToInsert = shiftDefs.map((def) => {
    const shiftDate = new Date(monday);
    shiftDate.setDate(monday.getDate() + def.dayOffset);
    const dateStr = shiftDate.toISOString().split("T")[0];

    const roleEmployees = empByRole(def.role);
    const employee = roleEmployees[def.employeeIndex] || roleEmployees[0];

    // Calculate hours
    const [sh, sm] = def.start_time.split(":").map(Number);
    const [eh, em] = def.end_time.split(":").map(Number);
    let totalMins = eh * 60 + em - (sh * 60 + sm);
    if (totalMins < 0) totalMins += 24 * 60;
    const hours = Math.max(0, (totalMins - def.break_minutes) / 60);

    return {
      schedule_week_id: scheduleWeek.id,
      restaurant_id: restaurant.id,
      employee_id: employee?.id || null,
      date: dateStr,
      start_time: def.start_time,
      end_time: def.end_time,
      role: def.role,
      department: def.department,
      break_minutes: def.break_minutes,
      is_training: false,
      is_open: !employee,
      scheduled_hours: Math.round(hours * 100) / 100,
      estimated_cost: employee
        ? Math.round(hours * employee.hourly_rate * 100) / 100
        : 0,
    };
  });

  const { error: shiftsError } = await db.from("shifts").insert(shiftsToInsert);
  if (shiftsError) {
    return NextResponse.json({ error: `Shifts: ${shiftsError.message}` }, { status: 500 });
  }

  // 5. Create some staffing data
  const staffingDays = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (i === 0) continue; // skip Monday (closed)

    const dayCovers = i >= 4 ? 85 + Math.floor(Math.random() * 60) : 50 + Math.floor(Math.random() * 40);
    staffingDays.push({
      restaurant_id: restaurant.id,
      date: d.toISOString().split("T")[0],
      booked_covers: dayCovers,
      booking_count: Math.floor(dayCovers / 3.2),
      covers_by_period: {
        Lunch: { covers: Math.floor(dayCovers * 0.35), bookings: Math.floor(dayCovers * 0.35 / 3) },
        Dinner: { covers: Math.floor(dayCovers * 0.65), bookings: Math.floor(dayCovers * 0.65 / 3.5) },
      },
      recommended_staff: {
        server: Math.ceil(dayCovers / 15),
        bartender: Math.ceil(dayCovers / 25),
        line_cook: Math.ceil(dayCovers / 35),
        host: Math.ceil(dayCovers / 50),
        runner: Math.ceil(dayCovers / 20),
        dishwasher: Math.ceil(dayCovers / 60),
      },
      scheduled_staff: {
        server: 3,
        bartender: 1,
        line_cook: 2,
        host: 1,
        runner: 0,
        dishwasher: 1,
      },
      staffing_status: dayCovers > 100 ? "understaffed" : dayCovers > 70 ? "optimal" : "overstaffed",
      last_synced_at: new Date().toISOString(),
    });
  }

  await db.from("daily_staffing_data").delete().eq("restaurant_id", restaurant.id);
  const { error: staffError } = await db.from("daily_staffing_data").insert(staffingDays);
  if (staffError) {
    console.error("Staffing seed error:", staffError.message);
  }

  // 6. Create a couple of time-off requests
  const lukeEmployee = createdEmployees?.find((e) => e.first_name === "Luke");
  const sarahEmployee = createdEmployees?.find((e) => e.first_name === "Sarah");

  if (lukeEmployee || sarahEmployee) {
    await db.from("time_off_requests").delete().eq("restaurant_id", restaurant.id);
    const timeOffRequests = [];

    if (lukeEmployee) {
      const nextWeekMon = new Date(monday);
      nextWeekMon.setDate(monday.getDate() + 7);
      timeOffRequests.push({
        employee_id: lukeEmployee.id,
        restaurant_id: restaurant.id,
        start_date: nextWeekMon.toISOString().split("T")[0],
        end_date: new Date(nextWeekMon.getTime() + 2 * 86400000).toISOString().split("T")[0],
        reason: "Family wedding in Gozo",
        status: "pending",
      });
    }

    if (sarahEmployee) {
      const nextFri = new Date(monday);
      nextFri.setDate(monday.getDate() + 11);
      timeOffRequests.push({
        employee_id: sarahEmployee.id,
        restaurant_id: restaurant.id,
        start_date: nextFri.toISOString().split("T")[0],
        end_date: nextFri.toISOString().split("T")[0],
        reason: "Dentist appointment",
        status: "pending",
      });
    }

    await db.from("time_off_requests").insert(timeOffRequests);
  }

  return NextResponse.json({
    success: true,
    restaurant_id: restaurant.id,
    employees_created: createdEmployees?.length || 0,
    shifts_created: shiftsToInsert.length,
    week_start: weekStart,
  });
}
