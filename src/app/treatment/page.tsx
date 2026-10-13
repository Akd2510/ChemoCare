
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Patient = {
  id: string;
  full_name: string;
};

export default function TreatmentPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [treatmentName, setTreatmentName] = useState("");
  const [cycleNumber, setCycleNumber] = useState("1");
  const [totalCycles, setTotalCycles] = useState("");
  const [nextInfusionDate, setNextInfusionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [today, setToday] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setToday(new Date().toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPatients() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("patient_profiles")
          .select("id, full_name")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (active) {
          const loadedPatients = data ?? [];
          setPatients(loadedPatients);

          if (loadedPatients.length > 0) {
            setPatientId(loadedPatients[0].id);
          }
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
        if (active) setLoadingPatients(false);
      }
    }

    loadPatients();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cycle = Number(cycleNumber);
    const total = totalCycles ? Number(totalCycles) : null;

    if (!patientId) {
      setMessage("Create a patient profile before adding a treatment plan.");
      return;
    }

    if (!treatmentName.trim()) {
      setMessage("Enter the treatment name provided by the oncology team.");
      return;
    }

    if (!Number.isInteger(cycle) || cycle < 1) {
      setMessage("The cycle number must be a positive whole number.");
      return;
    }

    if (
      total !== null &&
      (!Number.isInteger(total) || total < cycle)
    ) {
      setMessage("Total cycles must be a whole number equal to or greater than the current cycle.");
      return;
    }

    if (nextInfusionDate && today && nextInfusionDate < today) {
      setMessage(
        "The infusion date is in the past. Please check the date or leave it blank if not confirmed."
      );
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

      const { error } = await supabase.from("treatment_plans").insert({
        patient_id: patientId,
        treatment_name: treatmentName.trim(),
        cycle_number: cycle,
        total_cycles: total,
        next_infusion_date: nextInfusionDate || null,
        notes: notes.trim() || null,
        created_by: user.id,
      });

      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the treatment plan. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-5 py-10 text-slate-800">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <a
          href="/"
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back to dashboard
        </a>

        <p className="mt-8 text-sm font-semibold text-emerald-800">
          TREATMENT DETAILS
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Treatment plan
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Record the schedule confirmed by the oncology team. ChemoCare does
          not recommend or calculate chemotherapy regimens.
        </p>

        {loadingPatients ? (
          <p className="mt-8 text-sm text-slate-600">
            Loading patient profiles...
          </p>
        ) : patients.length === 0 ? (
          <div className="mt-8 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            No patient profile was found. Create a profile first.
            <div className="mt-3">
              <a href="/setup" className="font-semibold underline">
                Create patient profile
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="patient"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Patient
              </label>
              <select
                id="patient"
                required
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
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
                htmlFor="treatmentName"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Treatment name
              </label>
              <input
                id="treatmentName"
                required
                maxLength={200}
                value={treatmentName}
                onChange={(event) => setTreatmentName(event.target.value)}
                placeholder="Enter the name from the oncology team"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cycleNumber"
                  className="mb-2 block text-sm font-medium text-slate-800"
                >
                  Current cycle number
                </label>
                <input
                  id="cycleNumber"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={cycleNumber}
                  onChange={(event) => setCycleNumber(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="totalCycles"
                  className="mb-2 block text-sm font-medium text-slate-800"
                >
                  Total planned cycles (optional)
                </label>
                <input
                  id="totalCycles"
                  type="number"
                  min={cycleNumber || "1"}
                  step="1"
                  value={totalCycles}
                  onChange={(event) => setTotalCycles(event.target.value)}
                  placeholder="If confirmed"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="nextInfusionDate"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Next confirmed infusion date (optional)
              </label>
              <input
                id="nextInfusionDate"
                type="date"
                value={nextInfusionDate}
                min={today || undefined}
                onChange={(event) => setNextInfusionDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add relevant instructions from the oncology team"
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !patientId}
              className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving treatment plan..." : "Save treatment plan"}
            </button>
          </form>
        )}

        {message && (
          <p
            role="alert"
            aria-live="polite"
            className="mt-5 break-words rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800"
          >
            {message}
          </p>
        )}

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Only enter treatment details and dates confirmed by the patient's
          oncology team. This page records information; it does not provide
          medical advice.
        </p>
      </section>
    </main>
  );
}
