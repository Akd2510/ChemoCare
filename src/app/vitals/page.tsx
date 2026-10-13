
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Patient = {
  id: string;
  full_name: string;
};

type Reading = {
  id: string;
  temperature_c: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  pulse: number | null;
  oxygen_saturation: number | null;
  measured_at: string;
  source: string;
};

export default function VitalsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [temperature, setTemperature] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState<"F" | "C">("F");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [oxygen, setOxygen] = useState("");
  const [measuredAt, setMeasuredAt] = useState("");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = new Date();
    setToday(now.toISOString().split("T")[0]);
    setMeasuredAt(
      new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: patientData, error: patientError } = await supabase
          .from("patient_profiles")
          .select("id, full_name")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (patientError) throw patientError;

        if (!active) return;

        const loadedPatients = patientData ?? [];
        setPatients(loadedPatients);

        if (loadedPatients.length > 0) {
          setPatientId(loadedPatients[0].id);
        } else {
          setMessage("Create a patient profile before recording readings.");
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load patient profiles."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!patientId) {
        setHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from("vital_signs")
        .select(
          "id, temperature_c, systolic_bp, diastolic_bp, pulse, oxygen_saturation, measured_at, source"
        )
        .eq("patient_id", patientId)
        .order("measured_at", { ascending: false })
        .limit(20);

      if (!active) return;

      if (error) {
        setMessage(error.message);
        return;
      }

      setHistory((data ?? []) as Reading[]);
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [patientId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const hasTemperature = temperature.trim() !== "";
    const hasSystolic = systolic.trim() !== "";
    const hasDiastolic = diastolic.trim() !== "";
    const hasPulse = pulse.trim() !== "";
    const hasOxygen = oxygen.trim() !== "";

    if (!patientId) {
      setMessage("Please create a patient profile first.");
      return;
    }

    if (
      !hasTemperature &&
      !hasSystolic &&
      !hasDiastolic &&
      !hasPulse &&
      !hasOxygen
    ) {
      setMessage("Enter at least one measurement.");
      return;
    }

    if (hasSystolic !== hasDiastolic) {
      setMessage("Enter both systolic and diastolic blood pressure.");
      return;
    }

    const enteredTemperature = hasTemperature
      ? Number(temperature)
      : null;

    const temperatureC =
      enteredTemperature === null
        ? null
        : temperatureUnit === "F"
          ? (enteredTemperature - 32) * (5 / 9)
          : enteredTemperature;

    const systolicValue = hasSystolic ? Number(systolic) : null;
    const diastolicValue = hasDiastolic ? Number(diastolic) : null;
    const pulseValue = hasPulse ? Number(pulse) : null;
    const oxygenValue = hasOxygen ? Number(oxygen) : null;

    if (
      temperatureC !== null &&
      (!Number.isFinite(temperatureC) ||
        temperatureC < 25 ||
        temperatureC > 45)
    ) {
      setMessage("Check the temperature and selected unit.");
      return;
    }

    if (
      systolicValue !== null &&
      (!Number.isInteger(systolicValue) ||
        systolicValue < 40 ||
        systolicValue > 300)
    ) {
      setMessage("Check the systolic blood pressure value.");
      return;
    }

    if (
      diastolicValue !== null &&
      (!Number.isInteger(diastolicValue) ||
        diastolicValue < 20 ||
        diastolicValue > 200)
    ) {
      setMessage("Check the diastolic blood pressure value.");
      return;
    }

    if (
      pulseValue !== null &&
      (!Number.isInteger(pulseValue) ||
        pulseValue < 20 ||
        pulseValue > 250)
    ) {
      setMessage("Check the pulse value.");
      return;
    }

    if (
      oxygenValue !== null &&
      (!Number.isFinite(oxygenValue) ||
        oxygenValue < 50 ||
        oxygenValue > 100)
    ) {
      setMessage("Oxygen saturation must be between 50 and 100%.");
      return;
    }

    if (!measuredAt || Number.isNaN(new Date(measuredAt).getTime())) {
      setMessage("Enter a valid measurement date and time.");
      return;
    }

    const measuredDate = new Date(measuredAt);

    if (measuredDate.getTime() > Date.now()) {
      setMessage("Measurement time cannot be in the future.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase.from("vital_signs").insert({
        patient_id: patientId,
        recorded_by: user.id,
        temperature_c:
          temperatureC === null
            ? null
            : Number(temperatureC.toFixed(2)),
        systolic_bp: systolicValue,
        diastolic_bp: diastolicValue,
        pulse: pulseValue,
        oxygen_saturation: oxygenValue,
        measured_at: measuredDate.toISOString(),
        source,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      setMessage("Reading saved successfully.");
      setTemperature("");
      setSystolic("");
      setDiastolic("");
      setPulse("");
      setOxygen("");
      setNotes("");

      const { data, error: historyError } = await supabase
        .from("vital_signs")
        .select(
          "id, temperature_c, systolic_bp, diastolic_bp, pulse, oxygen_saturation, measured_at, source"
        )
        .eq("patient_id", patientId)
        .order("measured_at", { ascending: false })
        .limit(20);

      if (historyError) throw historyError;
      setHistory((data ?? []) as Reading[]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the reading. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function formatMeasurementTime(value: string) {
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatTemperature(value: number) {
    const fahrenheit = (value * 9) / 5 + 32;
    return `${fahrenheit.toFixed(1)} °F (${value.toFixed(1)} °C)`;
  }

  const recentFever = history.some(
    (reading) =>
      reading.temperature_c !== null && reading.temperature_c >= 38
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-5 py-10 text-slate-800">
      <div className="mx-auto max-w-3xl">
        <a
          href="/"
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back to dashboard
        </a>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold text-emerald-800">
            DAILY HEALTH TRACKING
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Record vital signs
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter the values displayed by the device. Check the units and
            confirm the numbers before saving.
          </p>

          {recentFever && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
            >
              <strong>Urgent temperature recorded.</strong> At least one
              recent saved reading is 38°C (100.4°F) or higher. During
              chemotherapy, contact the oncology team immediately and follow
              their instructions. Do not delay contact to repeat the
              measurement or wait for this website.
            </div>
          )}

          {loading ? (
            <p className="mt-8 text-sm text-slate-600">
              Loading patient profiles...
            </p>
          ) : patients.length === 0 ? (
            <div className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              No patient profile found.{" "}
              <a href="/setup" className="font-semibold underline">
                Create a profile
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div>
                <label
                  htmlFor="patient"
                  className="mb-2 block text-sm font-medium"
                >
                  Patient
                </label>
                <select
                  id="patient"
                  value={patientId}
                  onChange={(event) => setPatientId(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <section className="rounded-2xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-900">Temperature</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Leave blank if you are not recording a temperature.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label
                      htmlFor="temperature"
                      className="mb-2 block text-sm font-medium"
                    >
                      Device reading
                    </label>
                    <input
                      id="temperature"
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(event) => setTemperature(event.target.value)}
                      placeholder={temperatureUnit === "F" ? "e.g. 98.6" : "e.g. 37.0"}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="temperatureUnit"
                      className="mb-2 block text-sm font-medium"
                    >
                      Unit
                    </label>
                    <select
                      id="temperatureUnit"
                      value={temperatureUnit}
                      onChange={(event) =>
                        setTemperatureUnit(event.target.value as "F" | "C")
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                    >
                      <option value="F">°F</option>
                      <option value="C">°C</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-900">
                  Blood pressure
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter both values shown on the monitor.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="systolic"
                      className="mb-2 block text-sm font-medium"
                    >
                      Systolic (SYS), mmHg
                    </label>
                    <input
                      id="systolic"
                      type="number"
                      value={systolic}
                      onChange={(event) => setSystolic(event.target.value)}
                      placeholder="e.g. 120"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="diastolic"
                      className="mb-2 block text-sm font-medium"
                    >
                      Diastolic (DIA), mmHg
                    </label>
                    <input
                      id="diastolic"
                      type="number"
                      value={diastolic}
                      onChange={(event) => setDiastolic(event.target.value)}
                      placeholder="e.g. 80"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-900">
                  Other measurements
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="pulse"
                      className="mb-2 block text-sm font-medium"
                    >
                      Pulse, beats/min
                    </label>
                    <input
                      id="pulse"
                      type="number"
                      value={pulse}
                      onChange={(event) => setPulse(event.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="oxygen"
                      className="mb-2 block text-sm font-medium"
                    >
                      Oxygen saturation, %
                    </label>
                    <input
                      id="oxygen"
                      type="number"
                      step="0.1"
                      value={oxygen}
                      onChange={(event) => setOxygen(event.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
              </section>

              <div>
                <label
                  htmlFor="measuredAt"
                  className="mb-2 block text-sm font-medium"
                >
                  Date and time measured
                </label>
                <input
                  id="measuredAt"
                  type="datetime-local"
                  required
                  max={measuredAt || undefined}
                  value={measuredAt}
                  onChange={(event) => setMeasuredAt(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="source"
                  className="mb-2 block text-sm font-medium"
                >
                  Measurement source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                >
                  <option value="manual">Manual entry</option>
                  <option value="thermometer">Thermometer</option>
                  <option value="bp_monitor">Blood pressure monitor</option>
                  <option value="other">Other device</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional context about this reading"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving reading..." : "Save vital signs"}
              </button>
            </form>
          )}

          {message && (
            <p
              role="status"
              aria-live="polite"
              className="mt-5 break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"
            >
              {message}
            </p>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <h2 className="text-xl font-bold text-slate-900">
            Recent readings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The latest 20 saved measurements for the selected patient.
          </p>

          {history.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">
              No readings recorded yet.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {history.map((reading) => (
                <article
                  key={reading.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs text-slate-500">
                    {formatMeasurementTime(reading.measured_at)}
                  </p>

                  <div className="mt-2 space-y-1 text-sm text-slate-800">
                    {reading.temperature_c !== null && (
                      <p>
                        <strong>Temperature:</strong>{" "}
                        {formatTemperature(Number(reading.temperature_c))}
                      </p>
                    )}

                    {reading.systolic_bp !== null &&
                      reading.diastolic_bp !== null && (
                        <p>
                          <strong>Blood pressure:</strong>{" "}
                          {reading.systolic_bp}/{reading.diastolic_bp} mmHg
                        </p>
                      )}

                    {reading.pulse !== null && (
                      <p>
                        <strong>Pulse:</strong> {reading.pulse} bpm
                      </p>
                    )}

                    {reading.oxygen_saturation !== null && (
                      <p>
                        <strong>Oxygen saturation:</strong>{" "}
                        {Number(reading.oxygen_saturation).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
