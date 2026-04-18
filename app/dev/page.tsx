"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * DEV: Connect to a real Tableo restaurant via API token.
 * In production, this flow happens automatically via JWT from Tableo.
 */
export default function DevPage() {
  const router = useRouter();
  const [step, setStep] = useState<"connect" | "details" | "syncing" | "done" | "checking" | "pick">("checking");
  const [restaurants, setRestaurants] = useState<{ slug: string; name: string }[]>([]);

  // Try to auto-login with an existing restaurant on mount
  useEffect(() => {
    fetch("/api/dev/auto-login", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) router.replace("/dashboard");
        else if (d.restaurants) { setRestaurants(d.restaurants); setStep("pick"); }
        else setStep("connect");
      })
      .catch(() => setStep("connect"));
  }, [router]);

  const handlePickRestaurant = async (slug: string) => {
    const res = await fetch("/api/dev/auto-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) router.replace("/dashboard");
  };
  const [apiToken, setApiToken] = useState("");
  const [apiUrl, setApiUrl] = useState("https://app.tableo.com");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [connectionData, setConnectionData] = useState<any>(null);
  const [restaurantDetails, setRestaurantDetails] = useState({
    name: "",
    slug: "",
    country_code: "MT",
    timezone: "Europe/Malta",
    currency: "EUR",
  });

  // Step 1: Test connection and fetch data from Tableo API
  const handleConnect = async () => {
    setError("");
    setStatus("Connecting to Tableo API...");

    try {
      const res = await fetch("/api/dev/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: apiToken, api_url: apiUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Connection failed");
      }

      setConnectionData(data);
      setStatus("");

      // Pre-fill name from slug (capitalize and replace hyphens)
      if (restaurantDetails.slug && !restaurantDetails.name) {
        const prettyName = restaurantDetails.slug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        setRestaurantDetails((d) => ({ ...d, name: prettyName }));
      }

      setStep("details");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("");
    }
  };

  // Step 2: Create restaurant + sync data + login
  const handleSetup = async () => {
    setError("");
    setStep("syncing");
    setStatus("Creating restaurant and syncing data...");

    try {
      const res = await fetch("/api/dev/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: apiToken,
          api_url: apiUrl,
          ...restaurantDetails,
          opening_hours: connectionData?.opening_hours || [],
          dining_areas: connectionData?.dining_areas || [],
          bookings: connectionData?.bookings || {},
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Setup failed");
      }

      setStatus(
        `Restaurant "${data.restaurant_name}" connected with ${data.bookings_synced} bookings across ${data.days_synced} days.`
      );
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setStep("details");
      setStatus("");
    }
  };

  const handleGoToDashboard = async () => {
    setStatus("Logging in...");
    const res = await fetch("/api/dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurantDetails.slug }),
    });
    if (res.ok) {
      router.push("/dashboard");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full mx-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">
            Tableo Shifts
          </h1>
          <p className="text-neutral-500 mt-2 text-sm">
            Connect to a restaurant in Tableo
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Connect */}
        {step === "connect" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tableo API URL
              </label>
              <select
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="https://app.tableo.com">Production (app.tableo.com)</option>
                <option value="https://devrms.tableo.com">Development (devrms.tableo.com)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Restaurant URL or Slug
              </label>
              <input
                type="text"
                value={restaurantDetails.slug}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  const match = val.match(/restaurants\/([^/]+)/);
                  if (match) val = match[1];
                  val = val.replace(/\/$/, "");
                  setRestaurantDetails((d) => ({ ...d, slug: val }));
                }}
                placeholder="e.g., seans-bistro or paste Tableo restaurant URL"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-neutral-400 mt-1">
                From your Tableo URL: .../restaurants/<strong>seans-bistro</strong>/
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Restaurant API Token
              </label>
              <input
                type="text"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value.trim())}
                placeholder="Paste token from Tableo → Settings → API Integration"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={!apiToken || !restaurantDetails.slug || status === "Connecting to Tableo API..."}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {status === "Connecting to Tableo API..." ? "Connecting..." : "Connect"}
            </button>
          </div>
        )}

        {/* Step 2: Restaurant details */}
        {step === "details" && (
          <div className="space-y-4">
            {connectionData && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">
                <p className="font-medium">Connected to Tableo!</p>
                <p>{connectionData.total_bookings} bookings found across {connectionData.days_fetched} days</p>
                {connectionData.dining_areas?.length > 0 && (
                  <p className="mt-1">
                    Dining areas: {connectionData.dining_areas.map((a: any) => a.name).join(", ")}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Restaurant Name *
              </label>
              <input
                type="text"
                value={restaurantDetails.name}
                onChange={(e) =>
                  setRestaurantDetails((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="e.g., Two Buoys"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-neutral-400 mt-1">
                Confirm or edit the restaurant name
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Country
                </label>
                <select
                  value={restaurantDetails.country_code}
                  onChange={(e) =>
                    setRestaurantDetails((d) => ({
                      ...d,
                      country_code: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MT">Malta</option>
                  <option value="GB">United Kingdom</option>
                  <option value="FR">France</option>
                  <option value="DE">Germany</option>
                  <option value="ES">Spain</option>
                  <option value="IT">Italy</option>
                  <option value="NL">Netherlands</option>
                  <option value="PT">Portugal</option>
                  <option value="IE">Ireland</option>
                  <option value="SE">Sweden</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="MX">Mexico</option>
                  <option value="BR">Brazil</option>
                  <option value="AR">Argentina</option>
                  <option value="CO">Colombia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Currency
                </label>
                <select
                  value={restaurantDetails.currency}
                  onChange={(e) =>
                    setRestaurantDetails((d) => ({
                      ...d,
                      currency: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                  <option value="SEK">SEK</option>
                  <option value="BRL">BRL</option>
                  <option value="MXN">MXN</option>
                  <option value="ARS">ARS</option>
                  <option value="COP">COP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Timezone
                </label>
                <select
                  value={restaurantDetails.timezone}
                  onChange={(e) =>
                    setRestaurantDetails((d) => ({
                      ...d,
                      timezone: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Europe/Malta">Europe/Malta</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Europe/Madrid">Europe/Madrid</option>
                  <option value="Europe/Rome">Europe/Rome</option>
                  <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                  <option value="Europe/Lisbon">Europe/Lisbon</option>
                  <option value="Europe/Dublin">Europe/Dublin</option>
                  <option value="Europe/Stockholm">Europe/Stockholm</option>
                  <option value="America/New_York">America/New York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los Angeles</option>
                  <option value="America/Toronto">America/Toronto</option>
                  <option value="America/Vancouver">America/Vancouver</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                  <option value="Australia/Melbourne">Australia/Melbourne</option>
                  <option value="America/Mexico_City">America/Mexico City</option>
                  <option value="America/Sao_Paulo">America/Sao Paulo</option>
                  <option value="America/Argentina/Buenos_Aires">America/Buenos Aires</option>
                  <option value="America/Bogota">America/Bogota</option>
                </select>
              </div>
            </div>

            {/* Preview fetched data */}
            {connectionData?.opening_hours?.length > 0 && (
              <div className="p-3 bg-neutral-50 rounded-lg text-sm">
                <p className="font-medium text-neutral-700 mb-1">Opening hours detected:</p>
                <div className="space-y-0.5 text-xs text-neutral-600">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, i) => {
                      const h = connectionData.opening_hours.find(
                        (oh: any) => oh.day === i
                      );
                      return (
                        <div key={day} className="flex justify-between">
                          <span>{day}</span>
                          <span>
                            {h?.closed
                              ? "Closed"
                              : h
                                ? `${h.open} - ${h.close}`
                                : "—"}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("connect")}
                className="px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleSetup}
                disabled={!restaurantDetails.name}
                className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Set Up Restaurant
              </button>
            </div>
          </div>
        )}

        {/* Restaurant picker */}
        {step === "pick" && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 mb-3">Select a restaurant:</p>
            {restaurants.map((r) => (
              <button
                key={r.slug}
                onClick={() => handlePickRestaurant(r.slug)}
                className="w-full text-left px-4 py-3 rounded-lg border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium text-neutral-900">{r.name}</p>
                <p className="text-xs text-neutral-400">{r.slug}</p>
              </button>
            ))}
            <button
              onClick={() => setStep("connect")}
              className="w-full py-2 text-sm text-neutral-400 hover:text-neutral-600 mt-2"
            >
              + Connect a new restaurant
            </button>
          </div>
        )}

        {/* Auto-checking */}
        {step === "checking" && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-neutral-400 text-sm">Connecting...</p>
          </div>
        )}

        {/* Step 3: Syncing */}
        {step === "syncing" && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-neutral-600">{status}</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {status}
            </div>
            <button
              onClick={handleGoToDashboard}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Dashboard
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-neutral-200">
          <p className="text-xs text-neutral-400 text-center">
            In production, restaurants connect automatically from the Tableo dashboard.
          </p>
        </div>
      </div>
    </main>
  );
}
