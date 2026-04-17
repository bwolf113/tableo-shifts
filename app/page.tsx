import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionUser();

  if (session) {
    redirect("/dashboard");
  }

  redirect("/dev");
}
