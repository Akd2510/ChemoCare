
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SetupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("mother");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [today, setToday] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Calculate today's date in the browser, after the initial render.
  useEffect(() => {
    setToday(new Date().toISOString().split("T")[0]);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setMessage("Please enter the patient's full name.");
      return;
    }

    if (dateOfBirth && today && dateOfBirth > today) {
      setMessage("Date of birth cannot be in the future.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("patient_profiles")
        .insert({
          created_by: user.id,
          full_name: trimmedName,
          relationship,
          date_of_birth: dateOfBirth || null,
        });

      if (error) {
        throw error;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-5 py-10 text-slate-800">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <a
          href="/"
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back to dashboard
        </a>

        <p className="mt-8 text-sm font-semibold text-emerald-800">
          YOUR PRIVATE CARE SPACE
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Set up a patient profile
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Create a profile for yourself or someone you help care for.
          Treatment details can be added in a later step.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Patient&apos;s full name
            </label>

            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter the patient's name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="relationship"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Your relationship to the patient
            </label>

            <select
              id="relationship"
              required
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="self">Myself</option>
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="spouse">Spouse / partner</option>
              <option value="child">Child</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="dateOfBirth"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Date of birth (optional)
            </label>

            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              max={today || undefined}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving profile..." : "Save patient profile"}
          </button>
        </form>

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
          This creates a basic patient profile only. Treatment schedules,
          medical records, and caregiver permissions will be configured
          separately.
        </p>
      </section>
    </main>
  );
}
