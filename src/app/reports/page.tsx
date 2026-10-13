"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  parseBloodReportText,
  type ParsedBloodResult,
} from "@/lib/blood-report-parser";

type Patient = { id: string; full_name: string };

type Report = {
  id: string;
  patient_id: string;
  report_date: string;
  lab_name: string | null;
  treatment_cycle: number | null;
  notes: string | null;
  created_at: string;
};

type Result = {
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

type TestDefinition = {
  code: string;
  name: string;
  defaultUnit: string;
};

type ManualInput = {
  value: string;
  unit: string;
  low: string;
  high: string;
  referenceText: string;
};

type ReviewRow = {
  id: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  low: string;
  high: string;
  referenceText: string;
  sourceLine: string;
  duplicate: boolean;
};

const tests: TestDefinition[] = [
  { code: "hemoglobin", name: "Haemoglobin", defaultUnit: "g/dL" },
  { code: "wbc", name: "WBC Count", defaultUnit: "10^3/mm3" },
  { code: "anc", name: "Absolute neutrophil count", defaultUnit: "" },
  { code: "platelets", name: "Platelet Count", defaultUnit: "10^3/mm3" },
  { code: "rbc", name: "RBC Count", defaultUnit: "million/uL" },
  { code: "hematocrit", name: "Haematocrit", defaultUnit: "%" },
  { code: "mcv", name: "MCV", defaultUnit: "fL" },
  { code: "mch", name: "MCH", defaultUnit: "pg" },
  { code: "mchc", name: "MCHC", defaultUnit: "g/dL" },
  { code: "rdw", name: "RDW", defaultUnit: "%" },
  { code: "mpv", name: "Mean Platelet Volume", defaultUnit: "fL" },
  { code: "esr", name: "ESR", defaultUnit: "mm/hr" },
  { code: "neutrophils", name: "Neutrophils", defaultUnit: "%" },
  { code: "lymphocytes", name: "Lymphocytes", defaultUnit: "%" },
  { code: "monocytes", name: "Monocytes", defaultUnit: "%" },
  { code: "eosinophils", name: "Eosinophils", defaultUnit: "%" },
  { code: "basophils", name: "Basophils", defaultUnit: "%" },
  { code: "creatinine", name: "Creatinine", defaultUnit: "mg/dL" },
  { code: "urea", name: "Urea", defaultUnit: "mg/dL" },
  { code: "egfr", name: "eGFR", defaultUnit: "mL/min/1.73m2" },
  { code: "alt", name: "ALT (SGPT)", defaultUnit: "U/L" },
  { code: "ast", name: "AST (SGOT)", defaultUnit: "U/L" },
  { code: "bilirubin", name: "Total bilirubin", defaultUnit: "mg/dL" },
  { code: "direct_bilirubin", name: "Direct bilirubin", defaultUnit: "mg/dL" },
  { code: "albumin", name: "Albumin", defaultUnit: "g/dL" },
  { code: "potassium", name: "Potassium", defaultUnit: "mEq/L" },
  { code: "sodium", name: "Sodium", defaultUnit: "mEq/L" },
  { code: "chloride", name: "Chloride", defaultUnit: "mEq/L" },
  { code: "calcium", name: "Calcium", defaultUnit: "mg/dL" },
  { code: "phosphorus", name: "Phosphorus", defaultUnit: "mg/dL" },
  { code: "uric_acid", name: "Uric acid", defaultUnit: "mg/dL" },
  { code: "alkaline_phosphatase", name: "Alkaline phosphatase", defaultUnit: "U/L" },
  { code: "ggtp", name: "GGT", defaultUnit: "U/L" },
  { code: "protein_total", name: "Total protein", defaultUnit: "g/dL" },
  { code: "fsh", name: "FSH", defaultUnit: "" },
  { code: "estradiol", name: "Estradiol", defaultUnit: "" },
  { code: "lh", name: "LH", defaultUnit: "" },
  { code: "inr", name: "INR", defaultUnit: "" },
];

function emptyManualInputs(): Record<string, ManualInput> {
  return Object.fromEntries(
    tests.map((test) => [
      test.code,
      {
        value: "",
        unit: test.defaultUnit,
        low: "",
        high: "",
        referenceText: "",
      },
    ])
  );
}

function localDateString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function resultToReviewRow(
  result: ParsedBloodResult,
  index: number
): ReviewRow {
  const definition = tests.find(
    (test) => test.code === result.testCode
  );

  return {
    id: `${result.testCode}-${index}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    testCode: result.testCode,
    testName: result.testName,
    value: String(result.result),
    unit: result.unit || definition?.defaultUnit || "",
    low:
      result.referenceLow === null
        ? ""
        : String(result.referenceLow),
    high:
      result.referenceHigh === null
        ? ""
        : String(result.referenceHigh),
    referenceText: result.referenceText ?? "",
    sourceLine: result.sourceLine,
    duplicate: result.duplicate,
  };
}

export default function ReportsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [resultsByReport, setResultsByReport] = useState<
    Record<string, Result[]>
  >({});

  const [reportDate, setReportDate] = useState("");
  const [labName, setLabName] = useState("");
  const [cycle, setCycle] = useState("");
  const [notes, setNotes] = useState("");
  const [manualInputs, setManualInputs] =
    useState<Record<string, ManualInput>>(emptyManualInputs);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [pdfFileName, setPdfFileName] = useState("");
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");

  const loadReports = useCallback(async (selectedPatientId: string) => {
    setError("");

    const { data: reportData, error: reportError } = await supabase
      .from("blood_reports")
      .select(
        "id, patient_id, report_date, lab_name, treatment_cycle, notes, created_at"
      )
      .eq("patient_id", selectedPatientId)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (reportError) {
      setError(`Could not load reports: ${reportError.message}`);
      return;
    }

    const loadedReports = (reportData ?? []) as Report[];
    setReports(loadedReports);

    if (loadedReports.length === 0) {
      setResultsByReport({});
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
      setError(`Could not load test results: ${resultError.message}`);
      return;
    }

    const grouped: Record<string, Result[]> = {};

    for (const result of (resultData ?? []) as Result[]) {
      grouped[result.report_id] ??= [];
      grouped[result.report_id].push(result);
    }

    setResultsByReport(grouped);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialise() {
      setLoading(true);
      setReportDate(localDateString());

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
        await loadReports(loadedPatients[0].id);
      }

      if (active) setLoading(false);
    }

    void initialise();

    return () => {
      active = false;
    };
  }, [router, loadReports]);

  function updateManualInput(
    code: string,
    field: keyof ManualInput,
    value: string
  ) {
    setManualInputs((previous) => ({
      ...previous,
      [code]: { ...previous[code], [field]: value },
    }));
  }

  function updateReviewRow(
    id: string,
    field: keyof ReviewRow,
    value: string
  ) {
    setReviewRows((previous) =>
      previous.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  }

  function removeReviewRow(id: string) {
    setReviewRows((previous) =>
      previous.filter((row) => row.id !== id)
    );
  }

  async function handlePdfSelected(file?: File) {
    setPdfStatus("");
    setError("");
    setSuccess("");
    setExtractedText("");
    setReviewRows([]);

    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setPdfStatus("Please choose a PDF file.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setPdfStatus(
        "This PDF is larger than 15 MB. Please choose a smaller file."
      );
      return;
    }

    setPdfFileName(file.name);
    setExtractingPdf(true);

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      }).promise;

      if (pdf.numPages > 8) {
        throw new Error(
          "This version supports PDFs up to 8 pages. Split the report into smaller PDFs."
        );
      }

      let combinedText = "";
      const pagesForOcr: Array<{
        page: any;
        pageNumber: number;
      }> = [];

      // Use the same PDF.js text extraction strategy as /parser-test.
      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const items = content.items.filter(
          (item: any) =>
            "str" in item && typeof item.str === "string"
        );

        const positioned = items
          .filter(
            (item: any) =>
              item.str?.trim() && item.transform
          )
          .map((item: any) => ({
            text: item.str.trim(),
            x: item.transform[4] as number,
            y: item.transform[5] as number,
          }))
          .sort((a, b) => {
            if (Math.abs(a.y - b.y) > 3) {
              return b.y - a.y;
            }
            return a.x - b.x;
          });

        const rows: Array<{
          y: number;
          cells: Array<{ x: number; text: string }>;
        }> = [];

        for (const item of positioned) {
          let row = rows.find(
            (candidate) => Math.abs(candidate.y - item.y) <= 3
          );

          if (!row) {
            row = { y: item.y, cells: [] };
            rows.push(row);
          }

          row.cells.push({
            x: item.x,
            text: item.text,
          });
        }

        rows.sort((a, b) => b.y - a.y);

        const pageLines: string[] = [];

        for (const row of rows) {
          row.cells.sort((a, b) => a.x - b.x);

          const line = row.cells
            .map((cell) => cell.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          if (line) pageLines.push(line);
        }

        combinedText +=
          `\n--- Page ${pageNumber} ---\n` +
          (
            pageLines.length > 0
              ? pageLines.join("\n")
              : "[No selectable text extracted from this page.]"
          ) +
          "\n";

        if (
          pageLines.join("").replace(/\s/g, "").length < 35
        ) {
          pagesForOcr.push({ page, pageNumber });
        }
      }

      // Keep OCR for scanned or image-only pages.
      if (pagesForOcr.length > 0) {
        setPdfStatus(
          `Running browser-based OCR on ${pagesForOcr.length} scanned page(s)…`
        );

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");

        try {
          for (const { page, pageNumber } of pagesForOcr) {
            const viewport = page.getViewport({ scale: 1.6 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            if (!context) {
              throw new Error("Could not prepare a canvas for OCR.");
            }

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render({
              canvas,
              canvasContext: context,
              viewport,
            }).promise;

            const result = await worker.recognize(canvas);

            combinedText +=
              `\n--- OCR Page ${pageNumber} ---\n` +
              `${result.data.text}\n`;

            canvas.width = 0;
            canvas.height = 0;
          }
        } finally {
          await worker.terminate();
        }
      }

      setExtractedText(combinedText.trim());

      const parsed = parseBloodReportText(combinedText);
      const rows = parsed.map(resultToReviewRow);

      setReviewRows(rows);

      // Suggest a laboratory based on the filename. Confirm it before saving.
      if (/apollo/i.test(file.name)) {
        setLabName("Apollo Hospitals");
      } else if (/tata.?1mg|1mg/i.test(file.name)) {
        setLabName("Tata 1mg");
      }

      setPdfStatus(
        rows.length
          ? `${rows.length} candidate result(s) found. Review every row against the PDF before saving.`
          : "No supported rows were confidently identified. You can still enter results manually."
      );
    } catch (err) {
      console.error("PDF extraction failed:", err);

      setPdfStatus(
        err instanceof Error
          ? err.message
          : "Could not read this PDF. You can enter results manually."
      );
    } finally {
      setExtractingPdf(false);
    }
  }

  async function changePatient(id: string) {
    setPatientId(id);
    setSuccess("");
    setError("");
    await loadReports(id);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!patientId) {
      setError("Create a patient profile before adding a report.");
      return;
    }

    if (!reportDate) {
      setError("Select the date printed on the laboratory report.");
      return;
    }

    const cycleNumber = cycle.trim() ? Number(cycle) : null;

    if (
      cycleNumber !== null &&
      (!Number.isInteger(cycleNumber) || cycleNumber < 1)
    ) {
      setError("Treatment cycle must be a positive whole number.");
      return;
    }

    const enteredResults: Array<{
      test_code: string;
      test_name: string;
      result_value: number;
      unit: string;
      reference_low: number | null;
      reference_high: number | null;
      reference_text: string | null;
    }> = [];

    // Preserve repeated imported tests for manual review.
    for (const row of reviewRows) {
      if (!row.value.trim()) {
        setError(
          `Enter a result for imported test "${row.testName}" or remove that row.`
        );
        return;
      }

      const value = Number(row.value);
      const low = row.low.trim() ? Number(row.low) : null;
      const high = row.high.trim() ? Number(row.high) : null;

      if (!Number.isFinite(value)) {
        setError(
          `The result for "${row.testName}" is not a valid number.`
        );
        return;
      }

      if (!row.unit.trim()) {
        setError(`Enter a unit for "${row.testName}".`);
        return;
      }

      if (
        (low !== null && !Number.isFinite(low)) ||
        (high !== null && !Number.isFinite(high))
      ) {
        setError(
          `Reference limits for "${row.testName}" must be numeric.`
        );
        return;
      }

      if (low !== null && high !== null && low > high) {
        setError(
          `The lower reference limit exceeds the upper limit for "${row.testName}".`
        );
        return;
      }

      enteredResults.push({
        test_code: row.testCode,
        test_name: row.testName,
        result_value: value,
        unit: row.unit.trim(),
        reference_low: low,
        reference_high: high,
        reference_text: row.referenceText.trim() || null,
      });
    }

    // Add manually entered results.
    for (const test of tests) {
      const input = manualInputs[test.code];

      if (!input?.value.trim()) continue;

      const value = Number(input.value);
      const low = input.low.trim() ? Number(input.low) : null;
      const high = input.high.trim() ? Number(input.high) : null;

      if (!Number.isFinite(value)) {
        setError(`Enter a valid result for ${test.name}.`);
        return;
      }

      if (!input.unit.trim()) {
        setError(`Enter a unit for ${test.name}.`);
        return;
      }

      if (
        (low !== null && !Number.isFinite(low)) ||
        (high !== null && !Number.isFinite(high))
      ) {
        setError(`Reference limits for ${test.name} must be numeric.`);
        return;
      }

      if (low !== null && high !== null && low > high) {
        setError(
          `The lower reference limit exceeds the upper limit for ${test.name}.`
        );
        return;
      }

      enteredResults.push({
        test_code: test.code,
        test_name: test.name,
        result_value: value,
        unit: input.unit.trim(),
        reference_low: low,
        reference_high: high,
        reference_text: input.referenceText.trim() || null,
      });
    }

    if (enteredResults.length === 0) {
      setError(
        "Enter at least one result or import a PDF before saving."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError("Your session has expired. Please sign in again.");
        router.replace("/login");
        return;
      }

      const { data: newReport, error: reportError } = await supabase
        .from("blood_reports")
        .insert({
          patient_id: patientId,
          created_by: authData.user.id,
          report_date: reportDate,
          lab_name: labName.trim() || null,
          treatment_cycle: cycleNumber,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (reportError || !newReport) {
        setError(
          `Could not save the report: ${
            reportError?.message ?? "No report ID returned."
          }`
        );
        return;
      }

      const { error: resultsError } = await supabase
        .from("blood_report_results")
        .insert(
          enteredResults.map((result) => ({
            ...result,
            report_id: newReport.id,
          }))
        );

      if (resultsError) {
        const { error: cleanupError } = await supabase
          .from("blood_reports")
          .delete()
          .eq("id", newReport.id);

        setError(
          cleanupError
            ? `Results failed to save (${resultsError.message}); the empty report may still exist.`
            : `Results failed to save, so the empty report was removed. ${resultsError.message}`
        );
        return;
      }

      setManualInputs(emptyManualInputs());
      setReviewRows([]);
      setPdfFileName("");
      setExtractedText("");
      setPdfStatus("");
      setLabName("");
      setCycle("");
      setNotes("");
      setSuccess(`Saved ${enteredResults.length} result(s).`);

      await loadReports(patientId);
    } catch (err) {
      console.error("Saving report failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(report: Report) {
    const confirmed = window.confirm(
      `Delete the report dated ${displayDate(report.report_date)} and all its results? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(report.id);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("blood_reports")
      .delete()
      .eq("id", report.id);

    if (deleteError) {
      setError(`Could not delete the report: ${deleteError.message}`);
      setDeletingId("");
      return;
    }

    setSuccess("Report deleted.");
    await loadReports(patientId);
    setDeletingId("");
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600";

  const labelClass = "mb-1.5 block text-xs text-slate-500";

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
            Blood reports
          </h1>
          <p className="mt-3 max-w-2xl leading-6 text-slate-500">
            Import a PDF or enter results manually. Every imported result must
            be reviewed before saving.
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

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading patients and reports…
          </div>
        ) : patients.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">No patient profile found</h2>
            <p className="mt-2 text-slate-500">
              Create a patient profile before recording laboratory results.
            </p>
            <Link
              href="/setup"
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Create patient profile
            </Link>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-xl font-bold">Add a laboratory report</h2>

              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
                <h3 className="font-semibold">Import from PDF</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  PDFs are processed in your browser. The original file is not
                  uploaded to Supabase. Scanned PDFs may require OCR.
                </p>

                <label
                  htmlFor="blood-report-pdf"
                  className="mt-4 block text-sm font-medium"
                >
                  PDF file (maximum 15 MB, up to 8 pages)
                </label>

                <input
                  id="blood-report-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={extractingPdf}
                  onChange={(event) =>
                    void handlePdfSelected(event.target.files?.[0])
                  }
                  className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:font-semibold file:text-white"
                />

                {pdfFileName && (
                  <p className="mt-2 break-all text-xs text-slate-500">
                    Selected: {pdfFileName}
                  </p>
                )}

                {extractingPdf && (
                  <p
                    role="status"
                    className="mt-3 text-sm font-medium text-emerald-800"
                  >
                    Extracting PDF… keep this page open.
                  </p>
                )}

                {pdfStatus && (
                  <p
                    role="status"
                    className="mt-3 text-sm leading-6 text-slate-700"
                  >
                    {pdfStatus}
                  </p>
                )}

                {extractedText && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
                      Inspect extracted text
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                      {extractedText}
                    </pre>
                  </details>
                )}
              </div>

              {reviewRows.length > 0 && (
                <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                  <h3 className="text-lg font-bold">
                    Review imported results ({reviewRows.length})
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Check each row against the PDF. Edit incorrect fields or
                    remove uncertain rows. Repeated tests are kept separate
                    for review.
                  </p>

                  <div className="mt-4 space-y-4">
                    {reviewRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{row.testName}</p>
                            {row.duplicate && (
                              <p className="mt-1 text-xs font-medium text-amber-800">
                                Duplicate test detected. Confirm which
                                result(s) belong in this report.
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              Source: {row.sourceLine}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeReviewRow(row.id)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Remove row
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                          <div>
                            <label className={labelClass}>Result</label>
                            <input
                              type="number"
                              step="any"
                              value={row.value}
                              onChange={(e) =>
                                updateReviewRow(row.id, "value", e.target.value)
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Unit</label>
                            <input
                              maxLength={40}
                              value={row.unit}
                              onChange={(e) =>
                                updateReviewRow(row.id, "unit", e.target.value)
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Reference low</label>
                            <input
                              type="number"
                              step="any"
                              value={row.low}
                              onChange={(e) =>
                                updateReviewRow(row.id, "low", e.target.value)
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Reference high</label>
                            <input
                              type="number"
                              step="any"
                              value={row.high}
                              onChange={(e) =>
                                updateReviewRow(row.id, "high", e.target.value)
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Reference text</label>
                            <input
                              maxLength={500}
                              value={row.referenceText}
                              onChange={(e) =>
                                updateReviewRow(
                                  row.id,
                                  "referenceText",
                                  e.target.value
                                )
                              }
                              placeholder="< 128 or phase range"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
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
                    onChange={(e) => void changePatient(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                  >
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reportDate"
                      className="mb-2 block text-sm font-medium"
                    >
                      Report date
                    </label>
                    <input
                      id="reportDate"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="labName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Laboratory name
                    </label>
                    <input
                      id="labName"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      maxLength={200}
                      placeholder="Apollo Hospitals or Tata 1mg"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cycle"
                      className="mb-2 block text-sm font-medium"
                    >
                      Treatment cycle (optional)
                    </label>
                    <input
                      id="cycle"
                      type="number"
                      min="1"
                      step="1"
                      value={cycle}
                      onChange={(e) => setCycle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Manual entry</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Use these fields for tests that were not imported, or
                    enter the entire report manually.
                  </p>

                  <div className="mt-4 space-y-4">
                    {tests.map((test) => (
                      <div
                        key={test.code}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <h4 className="mb-3 text-sm font-semibold">
                          {test.name}
                        </h4>

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                          <div>
                            <label className={labelClass}>Result</label>
                            <input
                              type="number"
                              step="any"
                              value={manualInputs[test.code].value}
                              onChange={(e) =>
                                updateManualInput(
                                  test.code,
                                  "value",
                                  e.target.value
                                )
                              }
                              placeholder="Value"
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Unit</label>
                            <input
                              value={manualInputs[test.code].unit}
                              onChange={(e) =>
                                updateManualInput(
                                  test.code,
                                  "unit",
                                  e.target.value
                                )
                              }
                              maxLength={40}
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Reference low</label>
                            <input
                              type="number"
                              step="any"
                              value={manualInputs[test.code].low}
                              onChange={(e) =>
                                updateManualInput(
                                  test.code,
                                  "low",
                                  e.target.value
                                )
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Reference high</label>
                            <input
                              type="number"
                              step="any"
                              value={manualInputs[test.code].high}
                              onChange={(e) =>
                                updateManualInput(
                                  test.code,
                                  "high",
                                  e.target.value
                                )
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>Reference text</label>
                            <input
                              maxLength={500}
                              value={manualInputs[test.code].referenceText}
                              onChange={(e) =>
                                updateManualInput(
                                  test.code,
                                  "referenceText",
                                  e.target.value
                                )
                              }
                              placeholder="< 128 or phase range"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="mb-2 block text-sm font-medium"
                  >
                    Report notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || extractingPdf}
                  className="w-full rounded-xl bg-emerald-700 px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving report…" : "Save reviewed blood report"}
                </button>
              </form>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-bold">Saved reports</h2>
              <p className="mt-1 text-sm text-slate-500">
                {reports.length} report(s) for the selected patient.
              </p>

              {reports.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                  No blood reports recorded yet.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {reports.map((report) => (
                    <article
                      key={report.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold">
                            {displayDate(report.report_date)}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {report.lab_name || "Laboratory not specified"}
                          </p>
                          {report.treatment_cycle !== null && (
                            <p className="mt-1 text-sm text-slate-500">
                              Treatment cycle {report.treatment_cycle}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void deleteReport(report)}
                          disabled={deletingId === report.id}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === report.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>

                      {report.notes && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {report.notes}
                        </p>
                      )}

                      <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[650px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-3 font-medium">Test</th>
                              <th className="px-2 py-3 font-medium">Result</th>
                              <th className="px-2 py-3 font-medium">Unit</th>
                              <th className="px-2 py-3 font-medium">
                                Lab reference
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(resultsByReport[report.id] ?? []).map(
                              (result) => (
                                <tr
                                  key={result.id}
                                  className="border-b border-slate-100 last:border-0"
                                >
                                  <td className="px-2 py-3 font-medium">
                                    {result.test_name}
                                  </td>
                                  <td className="px-2 py-3">
                                    {result.result_value}
                                  </td>
                                  <td className="px-2 py-3 text-slate-600">
                                    {result.unit}
                                  </td>
                                  <td className="px-2 py-3 text-slate-600">
                                    {result.reference_text ||
                                      (result.reference_low !== null ||
                                      result.reference_high !== null
                                        ? `${result.reference_low ?? "—"} to ${result.reference_high ?? "—"}`
                                        : "—")}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>

                        {(resultsByReport[report.id] ?? []).length === 0 && (
                          <p className="py-4 text-sm text-slate-500">
                            No results are associated with this report.
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
          <h2 className="font-semibold">Medical safety</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Imported results are unverified until you compare them with the
            original report. ChemoCare does not diagnose conditions or
            determine treatment eligibility. Discuss results with the oncology
            team.
          </p>
        </section>
      </div>
    </main>
  );
}