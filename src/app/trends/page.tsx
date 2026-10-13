
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Patient = { id: string; full_name: string };

type Report = {
  id: string;
  patient_id: string;
  report_date: string;
  lab_name: string | null;
};

type LabResult = {
  id: string;
  report_id: string;
  test_code: string;
  test_name: string;
  result_value: number;
  unit: string;
  reference_low: number | null;
  reference_high: number | null;
  reference_text: string | null;
};

type Point = {
  date: string;
  label: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  lab: string;
};

const PREFERRED_TESTS = [
  "hemoglobin",
  "wbc",
  "anc",
  "platelets",
  "creatinine",
  "urea",
  "alt",
  "ast",
  "bilirubin",
  "sodium",
  "potassium",
  "calcium",
  "albumin",
];

function formatDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime())
    ? date
    : value.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(value);
}

function TrendChart({ points }: { points: Point[] }) {
  const width = 760;
  const height = 300;
  const left = 62;
  const right = 24;
  const top = 26;
  const bottom = 54;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const values = points.flatMap((point) => [
    point.value,
    ...(point.low === null ? [] : [point.low]),
    ...(point.high === null ? [] : [point.high]),
  ]);

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const padding = (max - min) * 0.12;
  min -= padding;
  max += padding;

  const x = (index: number) =>
    points.length === 1
      ? left + chartWidth / 2
      : left + (index / (points.length - 1)) * chartWidth;

  const y = (value: number) =>
    top + ((max - value) / (max - min)) * chartHeight;

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`)
    .join(" ");

  const gridValues = Array.from({ length: 5 }, (_, index) =>
    min + ((max - min) * index) / 4
  );

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Blood test results over time"
        className="w-full min-w-[520px]"
      >
        {gridValues.map((value, index) => (
          <g key={index}>
            <line
              x1={left}
              y1={y(value)}
              x2={width - right}
              y2={y(value)}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text
              x={left - 10}
              y={y(value) + 4}
              fontSize="11"
              textAnchor="end"
              fill="#64748b"
            >
              {formatNumber(value)}
            </text>
          </g>
        ))}

        <line
          x1={left}
          y1={top}
          x2={left}
          y2={height - bottom}
          stroke="#cbd5e1"
        />
        <line
          x1={left}
          y1={height - bottom}
          x2={width - right}
          y2={height - bottom}
          stroke="#cbd5e1"
        />

        {points.length >= 2 && (
          <path d={path} fill="none" stroke="#047857" strokeWidth="3" />
        )}

        {points.map((point, index) => (
          <g key={point.date + point.value + index}>
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r="5"
              fill="#047857"
              stroke="white"
              strokeWidth="2"
            >
              <title>
                {`${formatDate(point.date)}: ${formatNumber(point.value)} ${point.unit}`}
              </title>
            </circle>
            <text
              x={x(index)}
              y={height - bottom + 20}
              fontSize="10"
              textAnchor="middle"
              fill="#64748b"
            >
              {formatDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function TrendsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPatientData = useCallback(async (id: string) => {
    setError("");
    setReports([]);
    setResults([]);

    const { data: reportData, error: reportError } = await supabase
      .from("blood_reports")
      .select("id, patient_id, report_date, lab_name")
      .eq("patient_id", id)
      .order("report_date", { ascending: true });

    if (reportError) {
      setError(`Could not load reports: ${reportError.message}`);
      return;
    }

    const loadedReports = (reportData ?? []) as Report[];
    setReports(loadedReports);

    if (loadedReports.length === 0) {
      setSelectedCode("");
      return;
    }

    const { data: resultData, error: resultError } = await supabase
      .from("blood_report_results")
      .select(
        "id, report_id, test_code, test_name, result_value, unit, reference_low, reference_high, reference_text"
      )
      .in(
        "report_id",
        loadedReports.map((report) => report.id)
      );

    if (resultError) {
      setError(`Could not load results: ${resultError.message}`);
      return;
    }

    const loadedResults = (resultData ?? []) as LabResult[];
    setResults(loadedResults);

    const availableCodes = Array.from(
      new Set(loadedResults.map((result) => result.test_code))
    );

    setSelectedCode((current) =>
      current && availableCodes.includes(current)
        ? current
        : PREFERRED_TESTS.find((code) => availableCodes.includes(code)) ??
          availableCodes[0] ??
          ""
    );
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
        setError(`Could not load patients: ${patientError.message}`);
        setLoading(false);
        return;
      }

      const loadedPatients = (data ?? []) as Patient[];
      setPatients(loadedPatients);

      if (loadedPatients.length > 0) {
        setPatientId(loadedPatients[0].id);
        await loadPatientData(loadedPatients[0].id);
      }

      if (active) setLoading(false);
    }

    void initialise();

    return () => {
      active = false;
    };
  }, [router, loadPatientData]);

  const availableTests = useMemo(() => {
    const map = new Map<string, string>();

    for (const result of results) {
      if (!map.has(result.test_code)) {
        map.set(result.test_code, result.test_name);
      }
    }

    return Array.from(map, ([code, name]) => ({ code, name })).sort(
      (a, b) => {
        const aIndex = PREFERRED_TESTS.indexOf(a.code);
        const bIndex = PREFERRED_TESTS.indexOf(b.code);
        const aRank = aIndex < 0 ? 999 : aIndex;
        const bRank = bIndex < 0 ? 999 : bIndex;
        return aRank - bRank || a.name.localeCompare(b.name);
      }
    );
  }, [results]);

  const points = useMemo<Point[]>(() => {
    const reportById = new Map(reports.map((report) => [report.id, report]));

    return results
      .filter((result) => result.test_code === selectedCode)
      .map((result) => {
        const report = reportById.get(result.report_id);

        return {
          date: report?.report_date ?? "",
          label: result.test_name,
          value: Number(result.result_value),
          unit: result.unit,
          low: result.reference_low,
          high: result.reference_high,
          lab: report?.lab_name || "Laboratory not specified",
        };
      })
      .filter((point) => point.date && Number.isFinite(point.value))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [results, reports, selectedCode]);

  const selectedTest = availableTests.find(
    (test) => test.code === selectedCode
  );

  const latest = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const delta = latest && previous ? latest.value - previous.value : null;

  async function changePatient(id: string) {
    setPatientId(id);
    await loadPatientData(id);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to dashboard
        </Link>

        <header className="mb-8 mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            ChemoCare
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Blood-result trends
          </h1>
          <p className="mt-3 max-w-2xl leading-6 text-slate-500">
            Review recorded laboratory results over time. Trends are for
            reference and do not replace interpretation by the care team.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading blood-result history…
          </div>
        ) : patients.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">No patient profile found</h2>
            <Link
              href="/setup"
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white"
            >
              Create patient profile
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="trend-patient"
                    className="mb-2 block text-sm font-medium"
                  >
                    Patient
                  </label>
                  <select
                    id="trend-patient"
                    value={patientId}
                    onChange={(event) => void changePatient(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
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
                    htmlFor="trend-test"
                    className="mb-2 block text-sm font-medium"
                  >
                    Laboratory test
                  </label>
                  <select
                    id="trend-test"
                    value={selectedCode}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    disabled={availableTests.length === 0}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    {availableTests.length === 0 ? (
                      <option value="">No test results yet</option>
                    ) : (
                      availableTests.map((test) => (
                        <option key={test.code} value={test.code}>
                          {test.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </section>

            {reports.length === 0 || results.length === 0 ? (
              <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <h2 className="text-lg font-bold">No blood-result history yet</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Save a reviewed report first. Its supported results will
                  appear here automatically.
                </p>
                <Link
                  href="/reports"
                  className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white"
                >
                  Open blood reports
                </Link>
              </section>
            ) : points.length === 0 ? (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
                No saved values found for this test.
              </section>
            ) : (
              <>
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">
                        {selectedTest?.name ?? "Selected test"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {points.length} recorded result(s) · values are shown
                        in the units saved for each report
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                      History view
                    </span>
                  </div>

                  <div className="mt-6">
                    <TrendChart points={points} />
                  </div>

                  {points.length === 1 && (
                    <p className="mt-2 text-sm text-slate-500">
                      One result is recorded. Add later reports to see a trend
                      line.
                    </p>
                  )}

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    This chart does not normalize different units or determine
                    whether a result is clinically safe. Check the original
                    laboratory report and ask the treating clinician about
                    changes.
                  </p>
                </section>

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-bold">Recorded values</h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-2 py-3 font-medium">Report date</th>
                          <th className="px-2 py-3 font-medium">Result</th>
                          <th className="px-2 py-3 font-medium">Unit</th>
                          <th className="px-2 py-3 font-medium">Lab reference</th>
                          <th className="px-2 py-3 font-medium">Laboratory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...points].reverse().map((point, index) => (
                          <tr
                            key={`${point.date}-${index}`}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-2 py-3">{formatDate(point.date)}</td>
                            <td className="px-2 py-3 font-semibold">
                              {formatNumber(point.value)}
                            </td>
                            <td className="px-2 py-3">{point.unit}</td>
                            <td className="px-2 py-3 text-slate-600">
                              {point.low !== null || point.high !== null
                                ? `${point.low ?? "—"} to ${point.high ?? "—"}`
                                : "See original report"}
                            </td>
                            <td className="px-2 py-3 text-slate-600">{point.lab}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">Latest recorded value</p>
                    <p className="mt-2 text-2xl font-bold">
                      {latest ? formatNumber(latest.value) : "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {latest?.unit} · {latest ? formatDate(latest.date) : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">Previous recorded value</p>
                    <p className="mt-2 text-2xl font-bold">
                      {previous ? formatNumber(previous.value) : "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {previous ? formatDate(previous.date) : "No earlier value"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">Difference from previous</p>
                    <p className="mt-2 text-2xl font-bold">
                      {delta === null
                        ? "—"
                        : `${delta > 0 ? "+" : ""}${formatNumber(delta)}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Numeric difference only, not a clinical assessment
                    </p>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
          <h2 className="font-semibold">Important</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Laboratory ranges can vary by laboratory, age, sex, treatment, and
            other clinical factors. A trend chart cannot determine whether
            chemotherapy should be delayed or changed. Contact the oncology
            team for interpretation.
          </p>
        </section>
      </div>
    </main>
  );
}
