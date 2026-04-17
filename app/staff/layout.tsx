import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff-auth";
import Link from "next/link";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page doesn't need auth
  return <>{children}</>;
}
