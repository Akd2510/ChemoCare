
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Patient = {
  id: string;
  full_name: string;
  relationship: string | null;
  date_of_birth: string | null;
};

type TreatmentPlan = {
  id: string;
  treatment_name: string;
  cycle_number: number | null;
  total_cycles: number | null;
  next_infusion_date: string | null;
  notes: string | null;
};

type VitalSign = {
  id: string;
  temperature_c: number | string | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  pulse: number | null;
  oxygen_saturation: number | null;
  measured_at: string;
  notes: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayNumber(
  value: number | string | null | undefined,
  suffix = ""
): string {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number}${suffix}`;
}

function getTemperatureC(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getInfusionLabel(date: string | null | undefined): string {
  if (!date) return "No infusion scheduled";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const infusion = new Date(`${date.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(infusion.getTime())) return formatDate(date);

  const difference = Math.round(
    (infusion.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (difference < 0) {
    return `${Math.abs(difference)} day(s) ago`;
  }

  if (difference === 0) return "Today";

  if (difference === 1) return "Tomorrow";

  return `In ${difference} days`;
}

function ActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-36 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">
          {icon}
        </span>
        <span className="text-lg text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700">
          →
        </span>
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>

      <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
    </Link>
  );
}

function VitalCard({
  label,
  value,
  unit,
  description,
}: {
  label: string;
  value: string;
  unit?: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
        {unit && value !== "—" && (
          <span className="ml-1 text-sm font-medium text-slate-500">
            {unit}
          </span>
        )}
      </p>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [treatment, setTreatment] = useState<TreatmentPlan | null>(null);
  const [latestVital, setLatestVital] = useState<VitalSign | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

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
        .select("id, full_name, relationship, date_of_birth")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (patientError) {
        throw new Error(
          `Could not load the patient profile: ${patientError.message}`
        );
      }

      if (!patientData) {
        setPatient(null);
        setTreatment(null);
        setLatestVital(null);
        setLoading(false);
        return;
      }

      const currentPatient = patientData as Patient;
      setPatient(currentPatient);

      const [treatmentResponse, vitalsResponse] = await Promise.all([
        supabase
          .from("treatment_plans")
          .select(
            "id, treatment_name, cycle_number, total_cycles, next_infusion_date, notes"
          )
          .eq("patient_id", currentPatient.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("vital_signs")
          .select(
            "id, temperature_c, systolic_bp, diastolic_bp, pulse, oxygen_saturation, measured_at, notes"
          )
          .eq("patient_id", currentPatient.id)
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (treatmentResponse.error) {
        throw new Error(
          `Could not load the treatment plan: ${treatmentResponse.error.message}`
        );
      }

      if (vitalsResponse.error) {
        throw new Error(
          `Could not load vital signs: ${vitalsResponse.error.message}`
        );
      }

      setTreatment(
        treatmentResponse.data
          ? (treatmentResponse.data as TreatmentPlan)
          : null
      );

      setLatestVital(
        vitalsResponse.data ? (vitalsResponse.data as VitalSign) : null
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while loading the dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleSignOut() {
    setSigningOut(true);
    setError("");

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(`Could not sign out: ${signOutError.message}`);
      setSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const temperatureC = getTemperatureC(latestVital?.temperature_c);

  const temperatureF =
    temperatureC === null
      ? null
      : (temperatureC * 9) / 5 + 32;

  const feverWarning = temperatureC !== null && temperatureC >= 38;

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-2xl text-white shadow-sm">
              +
            </span>

            <span>
              <span className="block text-xl font-bold tracking-tight text-slate-900">
                ChemoCare
              </span>
              <span className="block text-xs text-slate-500">
                Your care, organised
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        <section className="mt-8 rounded-3xl bg-emerald-800 p-6 text-white shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-100">
            Your care dashboard
          </p>

          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {loading
                  ? "Loading your care..."
                  : patient
                    ? `Hello, ${patient.full_name}`
                    : "Welcome to ChemoCare"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
                Keep treatment information, daily observations, and blood
                reports organised in one place.
              </p>
            </div>

            {patient?.relationship && (
              <span className="inline-flex w-fit rounded-full border border-emerald-600 bg-emerald-700/70 px-4 py-2 text-sm font-medium text-white">
                {patient.relationship === "self"
                  ? "My care"
                  : `${patient.relationship.charAt(0).toUpperCase()}${patient.relationship.slice(1)}'s care`}
              </span>
            )}
          </div>
        </section>

        {error && (
          <section
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-semibold">Something needs attention</p>
            <p className="mt-1 break-words">{error}</p>

            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="mt-3 font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </section>
        )}

        {loading ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-700" />
            <p className="mt-4 text-sm text-slate-500">
              Loading your patient information...
            </p>
          </section>
        ) : !patient ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
              ♡
            </span>

            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Set up your patient profile
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Create a patient profile before recording treatment information,
              vital signs, symptoms, or blood reports.
            </p>

            <Link
              href="/setup"
              className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Create patient profile →
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Treatment overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your current treatment plan and upcoming infusion.
                  </p>
                </div>

                <Link
                  href="/treatment"
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Manage treatment →
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Treatment plan
                  </p>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">
                    {treatment?.treatment_name || "No plan added yet"}
                  </h3>

                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    {treatment?.notes || "Keep treatment details in one place."}
                  </p>

                  {!treatment && (
                    <Link
                      href="/treatment"
                      className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Add treatment plan →
                    </Link>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Treatment cycle
                  </p>

                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                    {treatment?.cycle_number != null
                      ? treatment.total_cycles != null
                        ? `${treatment.cycle_number} / ${treatment.total_cycles}`
                        : treatment.cycle_number
                      : "—"}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {treatment?.total_cycles != null
                      ? "Current cycle / total planned cycles"
                      : "Cycle details not recorded"}
                  </p>
                </article>

                <article className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
                  <p className="text-sm font-medium text-emerald-800">
                    Next infusion
                  </p>

                  <p className="mt-3 text-xl font-bold text-slate-900">
                    {formatDate(treatment?.next_infusion_date)}
                  </p>

                  <p className="mt-2 text-sm font-medium text-emerald-800">
                    {getInfusionLabel(treatment?.next_infusion_date)}
                  </p>

                  <Link
                    href="/treatment"
                    className="mt-4 inline-flex text-sm font-semibold text-emerald-800 hover:text-emerald-900"
                  >
                    Review schedule →
                  </Link>
                </article>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Latest vital signs
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {latestVital
                      ? `Last recorded ${formatDateTime(latestVital.measured_at)}`
                      : "No vital signs have been recorded yet."}
                  </p>
                </div>

                <Link
                  href="/vitals"
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  View vital history →
                </Link>
              </div>

              {feverWarning && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4"
                >
                  <p className="font-bold text-red-900">
                    Fever reading recorded
                  </p>

                  <p className="mt-1 text-sm leading-6 text-red-800">
                    The latest recorded temperature is{" "}
                    {temperatureC?.toFixed(1)}°C
                    {temperatureF !== null
                      ? ` (${temperatureF.toFixed(1)}°F)`
                      : ""}
                    . During chemotherapy, a temperature of 38°C (100.4°F) or
                    higher can require urgent medical attention. Contact the
                    oncology team immediately and follow their instructions.
                    Do not delay contacting them to recheck the temperature.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <VitalCard
                  label="Temperature"
                  value={
                    temperatureC === null ? "—" : temperatureC.toFixed(1)
                  }
                  unit="°C"
                  description={
                    temperatureF === null
                      ? "No reading recorded"
                      : `${temperatureF.toFixed(1)}°F`
                  }
                />

                <VitalCard
                  label="Blood pressure"
                  value={
                    latestVital?.systolic_bp != null &&
                    latestVital?.diastolic_bp != null
                      ? `${latestVital.systolic_bp}/${latestVital.diastolic_bp}`
                      : "—"
                  }
                  unit="mmHg"
                  description="Systolic / diastolic"
                />

                <VitalCard
                  label="Pulse"
                  value={displayNumber(latestVital?.pulse)}
                  unit="bpm"
                  description="Heart rate"
                />

                <VitalCard
                  label="Oxygen saturation"
                  value={displayNumber(latestVital?.oxygen_saturation)}
                  unit="%"
                  description="SpO₂"
                />
              </div>

              {latestVital?.notes && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Latest reading notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                    {latestVital.notes}
                  </p>
                </div>
              )}

              <Link
                href="/vitals"
                className="mt-4 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Record vital signs →
              </Link>
            </section>

            <section className="mt-10">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Your care tools
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Access your daily records and treatment information.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ActionCard
                  href="/vitals"
                  title="Vital signs"
                  description="Record temperature, blood pressure, pulse, and oxygen saturation."
                  icon="♥"
                />

                <ActionCard
                  href="/symptoms"
                  title="Symptom diary"
                  description="Track symptoms, severity, hydration, and notes over time."
                  icon="✎"
                />

                <ActionCard
                  href="/reports"
                  title="Blood reports"
                  description="Import PDF reports, review extracted values, and save laboratory results."
                  icon="▤"
                />

                <ActionCard
                  href="/trends"
                  title="Blood-result trends"
                  description="View saved blood test values chronologically and compare recorded results."
                  icon="↗"
                />

                <ActionCard
                  href="/treatment"
                  title="Treatment plan"
                  description="Review treatment details, cycles, notes, and upcoming infusion dates."
                  icon="✚"
                />

                <ActionCard
                  href="/setup"
                  title="Patient profile"
                  description="Review or set up patient information for your care records."
                  icon="♙"
                />
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 sm:p-6">
              <h2 className="font-bold text-slate-900">A note about medical safety</h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                ChemoCare helps organise information and is not a substitute
                for your oncology team's advice. Contact the oncology team
                promptly about concerning symptoms or results. During
                chemotherapy, a temperature of 38°C (100.4°F) or higher
                warrants immediate contact with the oncology team.
              </p>
            </section>
          </>
        )}

        <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs leading-5 text-slate-500">
          ChemoCare · Private care records · Follow your oncology team's
          instructions for medical decisions.
        </footer>
      </div>
    </main>
  );
}
