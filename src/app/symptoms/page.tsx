
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Patient = {
  id: string;
  full_name: string;
};

type Symptom =
  | "nausea"
  | "vomiting"
  | "diarrhoea"
  | "constipation"
  | "fatigue"
  | "mouth_sores"
  | "pain"
  | "fever"
  | "poor_appetite"
  | "dehydration"
  | "other";

type SymptomLog = {
  id: string;
  patient_id: string;
  symptom: Symptom;
  severity: "mild" | "moderate" | "severe";
  started_at: string | null;
  recorded_at: string;
  hydration_litres: number | null;
  notes: string | null;
};

const symptoms: { value: Symptom; label: string }[] = [
  { value: "nausea", label: "Nausea" },
  { value: "vomiting", label: "Vomiting" },
  { value: "diarrhoea", label: "Diarrhoea" },
  { value: "constipation", label: "Constipation" },
  { value: "fatigue", label: "Fatigue" },
  { value: "mouth_sores", label: "Mouth sores" },
  { value: "pain", label: "Pain" },
  { value: "fever", label: "Fever" },
  { value: "poor_appetite", label: "Poor appetite" },
  { value: "dehydration", label: "Possible dehydration" },
  { value: "other", label: "Other" },
];

function displaySymptom(value: string) {
  return symptoms.find((item) => item.value === value)?.label ?? value;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SymptomsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [logs, setLogs] = useState<SymptomLog[]>([]);

  const [symptom, setSymptom] = useState<Symptom>("nausea");
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">(
    "mild"
  );
  const [startedAt, setStartedAt] = useState("");
  const [hydration, setHydration] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadLogs = useCallback(async (selectedPatientId: string) => {
    const { data, error: loadError } = await supabase
      .from("symptom_logs")
      .select(
        "id, patient_id, symptom, severity, started_at, recorded_at, hydration_litres, notes"
      )
      .eq("patient_id", selectedPatientId)
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setLogs((data ?? []) as SymptomLog[]);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialise() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: patientError } = await supabase
        .from("patient_profiles")
        .select("id, full_name")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (patientError) {
        setError(patientError.message);
        setLoading(false);
        return;
      }

      const availablePatients = (data ?? []) as Patient[];
      setPatients(availablePatients);

      if (availablePatients.length > 0) {
        setPatientId(availablePatients[0].id);
        await loadLogs(availablePatients[0].id);
      }

      if (active) setLoading(false);
    }

    initialise();

    return () => {
      active = false;
    };
  }, [router, loadLogs]);

  async function handlePatientChange(id: string) {
    setPatientId(id);
    setError("");
    setSuccess("");
    await loadLogs(id);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!patientId) {
      setError("Create a patient profile first.");
      return;
    }

    const hydrationValue = hydration.trim() ? Number(hydration) : null;

    if (
      hydrationValue !== null &&
      (!Number.isFinite(hydrationValue) ||
        hydrationValue < 0 ||
        hydrationValue > 20)
    ) {
      setError("Enter hydration between 0 and 20 litres, or leave it blank.");
      return;
    }

    setSaving(true);

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setSaving(false);
      setError("Your session has expired. Please sign in again.");
      router.replace("/login");
      return;
    }

    const { error: saveError } = await supabase
      .from("symptom_logs")
      .insert({
        patient_id: patientId,
        recorded_by: authData.user.id,
        symptom,
        severity,
        started_at: startedAt
          ? new Date(startedAt).toISOString()
          : null,
        hydration_litres: hydrationValue,
        notes: notes.trim() || null,
      });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSymptom("nausea");
    setSeverity("mild");
    setStartedAt("");
    setHydration("");
    setNotes("");
    setSuccess("Symptom entry saved.");

    await loadLogs(patientId);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mb-8 mt-5">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
            ChemoCare
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Symptom diary
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Record how the patient is feeling and keep a dated history to
            discuss with the oncology team.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-red-900/70 bg-red-950/40 p-4">
          <h2 className="font-semibold text-red-200">
            Important fever warning
          </h2>
          <p className="mt-2 text-sm leading-6 text-red-100/90">
            During chemotherapy, a temperature of 38°C (100.4°F) or higher
            generally requires immediate contact with the oncology team.
            Follow the team&apos;s emergency instructions. Do not wait for
            this app to alert you or delay contacting them.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200"
          >
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Record a symptom</h2>

          {loading ? (
            <p className="mt-5 text-slate-400">Loading patient profiles…</p>
          ) : patients.length === 0 ? (
            <div className="mt-5 rounded-xl bg-slate-800 p-4">
              <p className="text-slate-300">
                No patient profile exists yet.
              </p>
              <Link
                href="/setup"
                className="mt-3 inline-block text-cyan-400 hover:text-cyan-300"
              >
                Create a patient profile →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="patient"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Patient
                </label>
                <select
                  id="patient"
                  value={patientId}
                  onChange={(event) => handlePatientChange(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-500"
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="symptom"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Symptom
                </label>
                <select
                  id="symptom"
                  value={symptom}
                  onChange={(event) =>
                    setSymptom(event.target.value as Symptom)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-500"
                >
                  {symptoms.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="mb-3 text-sm font-medium text-slate-300">
                  Severity
                </legend>
                <div className="grid grid-cols-3 gap-3">
                  {(["mild", "moderate", "severe"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSeverity(level)}
                      aria-pressed={severity === level}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize transition ${
                        severity === level
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                          : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Patient-reported severity, not a medical assessment.
                </p>
              </fieldset>

              <div>
                <label
                  htmlFor="startedAt"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  When did it start? (optional)
                </label>
                <input
                  id="startedAt"
                  type="datetime-local"
                  value={startedAt}
                  onChange={(event) => setStartedAt(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label
                  htmlFor="hydration"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Fluids consumed in litres (optional)
                </label>
                <input
                  id="hydration"
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  inputMode="decimal"
                  value={hydration}
                  onChange={(event) => setHydration(event.target.value)}
                  placeholder="e.g. 1.5"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Record this only if useful. Follow the care team&apos;s
                  individual fluid guidance.
                </p>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="For example, what the patient experienced or what helped…"
                  className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-500"
                />
                <p className="mt-1 text-right text-xs text-slate-500">
                  {notes.length}/2000
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving entry…" : "Save symptom entry"}
              </button>
            </form>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Recent entries</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest 50 entries for the selected patient.
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
              {logs.length} entries
            </span>
          </div>

          {loading ? (
            <p className="text-slate-400">Loading history…</p>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="font-medium text-slate-300">
                No symptom entries yet
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Saved entries will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        {displaySymptom(log.symptom)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Logged {formatDate(log.recorded_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        log.severity === "severe"
                          ? "bg-red-950 text-red-200"
                          : log.severity === "moderate"
                            ? "bg-amber-950 text-amber-200"
                            : "bg-emerald-950 text-emerald-200"
                      }`}
                    >
                      {log.severity}
                    </span>
                  </div>

                  {log.started_at && (
                    <p className="mt-3 text-sm text-slate-300">
                      Started: {formatDate(log.started_at)}
                    </p>
                  )}

                  {log.hydration_litres !== null && (
                    <p className="mt-2 text-sm text-slate-300">
                      Fluids recorded: {log.hydration_litres} L
                    </p>
                  )}

                  {log.notes && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {log.notes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
