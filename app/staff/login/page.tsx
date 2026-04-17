"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function StaffLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/staff/shifts");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full mx-4 text-center">
          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            Staff Portal
          </h1>
          <p className="text-neutral-500 text-sm">
            Ask your manager for your login link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full mx-4">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-neutral-900">Staff Portal</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Enter your 4-digit PIN to view your shifts
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Enter PIN"
              className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={pin.length !== 4 || loading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "View My Shifts"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <p className="text-neutral-400">Loading...</p>
      </main>
    }>
      <StaffLoginContent />
    </Suspense>
  );
}
