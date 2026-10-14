"use client";

import { useState } from "react";
import { parseBloodReportText } from "@/lib/blood-report-parser";

type PageDiagnostic = {
  page: number;
  characters: number;
  textItems: number;
  status: "text-found" | "possible-scan" | "empty";
};

export default function ParserTestPage() {
  const [status, setStatus] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [pageDiagnostics, setPageDiagnostics] = useState<PageDiagnostic[]>([]);
  const [showRawText, setShowRawText] = useState(true);

  async function testPdf(file?: File) {
    if (!file) return;

    setStatus("");
    setRawText("");
    setFileName(file.name);
    setPageCount(0);
    setPageDiagnostics([]);

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setStatus("Please select a PDF file.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatus("Choose a PDF smaller than 15 MB.");
      return;
    }

    setBusy(true);

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" +
        pdfjs.version +
        "/pdf.worker.min.mjs";

      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      }).promise;

      if (pdf.numPages > 8) {
        throw new Error("This test page supports PDFs up to 8 pages.");
      }

      setPageCount(pdf.numPages);

      const allLines: string[] = [];
      const diagnostics: PageDiagnostic[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        // Narrow PDF.js union types without a custom type predicate.
        // TextMarkedContent items do not contain regular text coordinates.
        const positioned = content.items
          .flatMap((item) => {
            if (!("str" in item) || typeof item.str !== "string") {
              return [];
            }

            if (!("transform" in item) || !Array.isArray(item.transform)) {
              return [];
            }

            if (item.transform.length < 6 || !item.str.trim()) {
              return [];
            }

            return [
              {
                text: item.str.trim(),
                x: item.transform[4],
                y: item.transform[5],
              },
            ];
          })
          .sort((a, b) => {
            if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
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

          row.cells.push({ x: item.x, text: item.text });
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

          if (line) {
            pageLines.push(line);
          }
        }

        const characters = pageLines.join("\n").replace(/\s/g, "").length;

        const diagnosticStatus: PageDiagnostic["status"] =
          characters === 0
            ? "empty"
            : characters < 80
              ? "possible-scan"
              : "text-found";

        diagnostics.push({
          page: pageNumber,
          characters,
          textItems: positioned.length,
          status: diagnosticStatus,
        });

        allLines.push("--- Page " + pageNumber + " ---");

        if (pageLines.length > 0) {
          allLines.push(...pageLines);
        } else {
          allLines.push(
            "[No selectable text extracted. This page may be scanned or image-based.]"
          );
        }
      }

      const text = allLines.join("\n");
      const results = parseBloodReportText(text);

      setRawText(text);
      setPageDiagnostics(diagnostics);

      const possibleScans = diagnostics.filter(
        (page) => page.status !== "text-found"
      ).length;

      const reviewCount = results.filter(
        (result) => result.needsReview || result.duplicate
      ).length;

      setStatus(
        [
          "Extraction completed: " +
            pdf.numPages +
            " page(s), " +
            results.length +
            " proposed result(s).",
          possibleScans > 0
            ? possibleScans +
              " page(s) may need OCR or manual inspection. This test page does not run OCR."
            : "Selectable text was found on every page.",
          reviewCount > 0
            ? reviewCount +
              " proposed result(s) are flagged for review or duplication."
            : "No duplicate or review flags were reported by the parser.",
          "Verify every proposed value against the original PDF.",
        ].join(" ")
      );
    } catch (error) {
      console.error("Blood report parser test failed:", error);

      setStatus(
        error instanceof Error ? error.message : "PDF extraction failed."
      );
    } finally {
      setBusy(false);
    }
  }

  const parsedResults = parseBloodReportText(rawText);

  function formatReference(result: (typeof parsedResults)[number]) {
    if (result.referenceText?.trim()) {
      return result.referenceText;
    }

    if (result.referenceLow !== null && result.referenceHigh !== null) {
      return result.referenceLow + " to " + result.referenceHigh;
    }

    if (result.referenceLow !== null) {
      return ">= " + result.referenceLow;
    }

    if (result.referenceHigh !== null) {
      return "<= " + result.referenceHigh;
    }

    return "Not extracted";
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-8 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <a
          href="/reports"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Return to Blood Reports
        </a>

        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            ChemoCare · Developer tools
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Blood report parser test
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Test selectable text extraction and the results proposed by the
            parser. Nothing is saved to Supabase on this page.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label
            htmlFor="test-pdf"
            className="block text-sm font-semibold"
          >
            Select an Apollo Hospitals or Tata 1mg PDF
          </label>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            PDF only, maximum 15 MB and 8 pages. This test page does not run OCR.
          </p>

          <input
            id="test-pdf"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void testPdf(file);
            }}
            className="mt-3 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-800"
          />

          {fileName && (
            <p className="mt-3 break-all text-xs text-slate-500">
              File: {fileName}
            </p>
          )}

          {busy && (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              Extracting PDF text and testing the parser…
            </p>
          )}

          {status && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-slate-700"
            >
              {status}
            </div>
          )}
        </section>

        {pageCount > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Page diagnostics</h2>

            <p className="mt-1 text-sm text-slate-500">
              Low text counts can indicate a scanned page, but do not prove
              that OCR is required.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-3 py-3">Page</th>
                    <th className="px-3 py-3">Text characters</th>
                    <th className="px-3 py-3">Text items</th>
                    <th className="px-3 py-3">Assessment</th>
                  </tr>
                </thead>

                <tbody>
                  {pageDiagnostics.map((page) => (
                    <tr
                      key={page.page}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-3 font-medium">{page.page}</td>
                      <td className="px-3 py-3">{page.characters}</td>
                      <td className="px-3 py-3">{page.textItems}</td>
                      <td className="px-3 py-3">
                        {page.status === "text-found"
                          ? "Text found"
                          : page.status === "possible-scan"
                            ? "Check for scan"
                            : "No text"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">
            Proposed results ({parsedResults.length})
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Parser suggestions are not medically validated results.
          </p>

          {parsedResults.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              No rows met the parser requirements. Inspect the extracted text
              below.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-3 py-3">Test</th>
                    <th className="px-3 py-3">Result</th>
                    <th className="px-3 py-3">Unit</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3">Review</th>
                    <th className="px-3 py-3">Original source line</th>
                  </tr>
                </thead>

                <tbody>
                  {parsedResults.map((result, index) => {
                    const flagged = result.needsReview || result.duplicate;

                    return (
                      <tr
                        key={result.testCode + "-" + index}
                        className="border-b border-slate-100 align-top last:border-0"
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold">{result.testName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {result.testCode}
                          </div>
                        </td>

                        <td className="px-3 py-3 font-semibold tabular-nums">
                          {result.result}
                        </td>

                        <td className="px-3 py-3">{result.unit || "—"}</td>

                        <td className="px-3 py-3">
                          {formatReference(result)}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1">
                            {result.needsReview && (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                                Verify value
                              </span>
                            )}

                            {result.duplicate && (
                              <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
                                Duplicate code
                              </span>
                            )}

                            {!flagged && (
                              <span className="text-xs text-slate-500">
                                Check original
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="max-w-md whitespace-pre-wrap break-words px-3 py-3 text-xs leading-5 text-slate-600">
                          {result.sourceLine || "No source line recorded"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Extracted text</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                This text may contain personal information.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowRawText((current) => !current)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {showRawText ? "Hide text" : "Show text"}
            </button>
          </div>

          {showRawText && (
            <pre className="mt-4 max-h-[600px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700">
              {rawText || "Choose a PDF to inspect its extracted text."}
            </pre>
          )}
        </section>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Do not rely on parser output for treatment decisions. Verify values,
          units, and reference ranges against the original report and consult
          the treating clinical team.
        </p>
      </div>
    </main>
  );
}