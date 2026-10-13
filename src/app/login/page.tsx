
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage(
          data.session
            ? "Account created successfully. You can now continue to ChemoCare."
            : "Account created. Check your email to confirm your address before signing in."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        window.location.href = "/";
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link
          href="/"
          className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
        >
          ← ChemoCare
        </Link>

        <div className="mt-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-2xl text-white">
            ♡
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in securely to access your family&apos;s care space.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            aria-live="polite"
            className="mt-5 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          {mode === "login"
            ? "New to ChemoCare?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
            className="font-semibold text-emerald-800 hover:text-emerald-950 hover:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
