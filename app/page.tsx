import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionUser();

  if (session) {
    redirect("/dashboard");
  }

  // Landing / auth entry point
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          Tableo Shifts
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          Smart staff scheduling powered by your reservation data.
          The only shift planner that knows how many guests are coming
          before they arrive.
        </p>
        <p className="text-sm text-neutral-400">
          Access Tableo Shifts from your Tableo dashboard.
        </p>
      </div>
    </main>
  );
}
