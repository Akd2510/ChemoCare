export type ParsedBloodResult = {
  testCode: string;
  testName: string;
  result: number;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
  sourceLine: string;
  needsReview: true;
  duplicate: boolean;
};

type TestDefinition = {
  code: string;
  name: string;
  aliases: string[];
};

const TESTS: TestDefinition[] = [
  { code: "hemoglobin", name: "Haemoglobin", aliases: ["haemoglobin", "hemoglobin", "hb"] },
  { code: "wbc", name: "WBC Count", aliases: ["total leukocyte count", "total leucocyte count", "white blood cell count", "wbc count", "tlc"] },
  { code: "anc", name: "Absolute neutrophil count", aliases: ["absolute neutrophil count", "absolute neutrophils", "anc"] },
  { code: "platelets", name: "Platelet Count", aliases: ["platelet count", "platelets"] },
  { code: "rbc", name: "RBC Count", aliases: ["red blood cell count", "rbc count"] },
  { code: "hematocrit", name: "Haematocrit", aliases: ["haematocrit", "hematocrit", "packed cell volume", "pcv"] },
  { code: "mcv", name: "MCV", aliases: ["mean corpuscular volume", "mcv"] },
  { code: "mch", name: "MCH", aliases: ["mean corpuscular haemoglobin", "mean corpuscular hemoglobin", "mch"] },
  { code: "mchc", name: "MCHC", aliases: ["mean corpuscular haemoglobin concentration", "mean corpuscular hemoglobin concentration", "mchc"] },
  { code: "rdw", name: "RDW", aliases: ["red cell distribution width", "rdw-cv", "rdw"] },
  { code: "mpv", name: "Mean Platelet Volume", aliases: ["mean platelet volume", "mpv"] },
  { code: "esr", name: "ESR", aliases: ["erythrocyte sedimentation rate", "esr"] },
  { code: "neutrophils", name: "Neutrophils", aliases: ["neutrophils", "neutrophil percent", "neutrophil percentage"] },
  { code: "lymphocytes", name: "Lymphocytes", aliases: ["lymphocytes", "lymphocyte percent", "lymphocyte percentage"] },
  { code: "monocytes", name: "Monocytes", aliases: ["monocytes", "monocyte percent", "monocyte percentage"] },
  { code: "eosinophils", name: "Eosinophils", aliases: ["eosinophils", "eosinophil percent", "eosinophil percentage"] },
  { code: "basophils", name: "Basophils", aliases: ["basophils", "basophil percent", "basophil percentage"] },
  { code: "creatinine", name: "Creatinine", aliases: ["serum creatinine", "creatinine"] },
  { code: "urea", name: "Urea", aliases: ["blood urea", "serum urea", "urea"] },
  { code: "egfr", name: "eGFR", aliases: ["estimated glomerular filtration rate", "estimated gfr", "egfr"] },
  { code: "alt", name: "ALT (SGPT)", aliases: ["alanine aminotransferase", "alt (sgpt)", "alt", "sgpt"] },
  { code: "ast", name: "AST (SGOT)", aliases: ["aspartate aminotransferase", "ast (sgot)", "ast", "sgot"] },
  { code: "bilirubin", name: "Total bilirubin", aliases: ["bilirubin total", "total bilirubin"] },
  { code: "direct_bilirubin", name: "Direct bilirubin", aliases: ["bilirubin conjugated (direct)", "bilirubin conjugated", "direct bilirubin", "bilirubin direct"] },
  { code: "albumin", name: "Albumin", aliases: ["albumin"] },
  { code: "potassium", name: "Potassium", aliases: ["potassium", "serum potassium"] },
  { code: "sodium", name: "Sodium", aliases: ["sodium", "serum sodium"] },
  { code: "chloride", name: "Chloride", aliases: ["chloride", "serum chloride"] },
  { code: "calcium", name: "Calcium", aliases: ["calcium", "serum calcium"] },
  { code: "phosphorus", name: "Phosphorus", aliases: ["phosphorus inorganic", "inorganic phosphorus", "phosphorus", "phosphate"] },
  { code: "uric_acid", name: "Uric acid", aliases: ["uric acid"] },
  { code: "alkaline_phosphatase", name: "Alkaline phosphatase", aliases: ["alkaline phosphatase", "alp"] },
  { code: "ggtp", name: "GGT", aliases: ["gamma glutamyl transpeptidase", "gamma glutamyl transferase", "ggtp", "ggt"] },
  { code: "protein_total", name: "Total protein", aliases: ["protein total", "total protein"] },
  { code: "fsh", name: "FSH", aliases: ["follicle stimulating hormone", "fsh"] },
  { code: "estradiol", name: "Estradiol", aliases: ["oestradiol", "estradiol"] },
  { code: "lh", name: "LH", aliases: ["luteinizing hormone", "luteinising hormone", "leutinizing hormone", "lh"] },
  { code: "inr", name: "INR", aliases: ["international normalized ratio", "international normalised ratio", "inr"] },
];

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(value: string): string {
  return normalise(value).replace(/\t/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORTED_ALIASES = TESTS.flatMap((test) =>
  test.aliases.map((alias) => ({ test, alias: normalise(alias).toLowerCase() }))
).sort((a, b) => b.alias.length - a.alias.length);

function identifyTest(line: string) {
  const value = normalise(line).toLowerCase();

  for (const candidate of SORTED_ALIASES) {
    const pattern = new RegExp(
      `^${escapeRegExp(candidate.alias)}(?=\\s|[:\\-()]|$)`,
      "i"
    );

    const match = value.match(pattern);

    if (match) {
      return {
        test: candidate.test,
        remainder: value.slice(match[0].length).trim(),
      };
    }
  }

  return null;
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function buildResult(
  test: TestDefinition,
  result: number,
  unit: string,
  referenceLow: number | null,
  referenceHigh: number | null,
  referenceText: string | null,
  sourceLine: string
): Omit<ParsedBloodResult, "duplicate"> {
  return {
    testCode: test.code,
    testName: test.name,
    result,
    unit,
    referenceLow,
    referenceHigh,
    referenceText,
    sourceLine,
    needsReview: true,
  };
}

/**
 * Recognizes common laboratory units, including OCR variations such as
 * mlU/mL, mIU/ml, and MUI/ML.
 */
function extractHormoneUnit(tail: string): string {
  const match = tail.match(
    /\b(?:m\s*[il1]\s*u\s*\/\s*m\s*l|m\s*u\s*i\s*\/\s*m\s*l|p\s*g\s*\/\s*m\s*l|p\s*m\s*o\s*l\s*\/\s*l|n\s*g\s*\/\s*m\s*l|i\s*u\s*\/\s*m\s*l)\b/i
  );

  if (!match) return "";

  const unit = match[0].replace(/\s+/g, "");

  if (/^m[il1]u\/ml$/i.test(unit) || /^mui\/ml$/i.test(unit)) {
    return "mIU/mL";
  }

  if (/^pg\/ml$/i.test(unit)) return "pg/mL";
  if (/^pmol\/l$/i.test(unit)) return "pmol/L";
  if (/^ng\/ml$/i.test(unit)) return "ng/mL";
  if (/^iu\/ml$/i.test(unit)) return "IU/mL";

  return unit;
}

function parseHormoneLine(
  line: string,
  test: TestDefinition
): Omit<ParsedBloodResult, "duplicate"> | null {
  const value = normalise(line);

  const namePatterns: Record<string, RegExp> = {
    fsh: /(?:^|\b)follicle\s+stimulating\s+hormone\b/i,
    lh: /(?:^|\b)(?:leutinizing|luteinizing|luteinising)\s+hormone\b/i,
    estradiol: /(?:^|\b)(?:oestradiol|estradiol)\b/i,
  };

  const prefixPatterns: Record<string, RegExp> = {
    fsh: /^(?:fsh\b|follicle\s+stimulating\s+hormone\b)/i,
    lh: /^(?:lh\b|leutinizing\s+hormone\b|luteinizing\s+hormone\b|luteinising\s+hormone\b)/i,
    estradiol: /^(?:estradiol\b|oestradiol\b)/i,
  };

  const prefix = prefixPatterns[test.code];

  if (!prefix || !prefix.test(value)) return null;

  const nameMatch = value.match(namePatterns[test.code]);

  let remainder: string;

  if (nameMatch && nameMatch.index !== undefined) {
    remainder = value
      .slice(nameMatch.index + nameMatch[0].length)
      .replace(/^\s*[-:]\s*/, "")
      .replace(/^(?:serum|blood|plasma)\b\s*/i, "")
      .replace(/^\s*[-:]\s*/, "")
      .trim();
  } else {
    remainder = value
      .replace(prefix, "")
      .replace(/^\s*[-:]\s*/, "")
      .replace(/^(?:serum|blood|plasma)\b\s*/i, "")
      .trim();
  }

  const resultMatch = remainder.match(
    /^[*#]?\s*([+-]?\d+(?:\.\d+)?)(?=\s|$)/
  );

  if (!resultMatch) return null;

  const result = parseNumber(resultMatch[1]);

  if (result === null) return null;

  const tail = remainder.slice(resultMatch[0].length).trim();
  const unit = extractHormoneUnit(tail);

  const referenceText =
    tail
      .replace(
        /\b(?:m\s*[il1]\s*u\s*\/\s*m\s*l|m\s*u\s*i\s*\/\s*m\s*l|p\s*g\s*\/\s*m\s*l|p\s*m\s*o\s*l\s*\/\s*l|n\s*g\s*\/\s*m\s*l|i\s*u\s*\/\s*m\s*l)\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim() || null;

  return buildResult(
    test,
    result,
    unit,
    null,
    null,
    referenceText,
    line
  );
}

function parseLine(
  originalLine: string
): Omit<ParsedBloodResult, "duplicate"> | null {
  const line = cleanLine(originalLine);

  if (!line) return null;

  // Handle hormone reports whose names and results appear on one line.
  for (const code of ["fsh", "lh", "estradiol"]) {
    const test = TESTS.find((item) => item.code === code);

    if (test) {
      const hormoneResult = parseHormoneLine(line, test);
      if (hormoneResult) return hormoneResult;
    }
  }

  const found = identifyTest(line);
  if (!found) return null;

  let remainder = found.remainder
    .replace(/^\s*[:*-]\s*/, "")
    .replace(/^\s*\(?\s*(?:serum|blood|plasma)\s*\)?\s*/i, "")
    .replace(/^\s*-\s*(?:serum|blood|plasma)\b\s*/i, "")
    .replace(/^\s*(?:serum|blood|plasma)\s*[:*-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // INR is a ratio and is commonly reported without a unit.
  if (found.test.code === "inr") {
    const inrMatch = remainder.match(
      /^[*#]?\s*([+-]?\d+(?:\.\d+)?)(?:\s+(.*))?$/i
    );

    if (inrMatch) {
      const result = parseNumber(inrMatch[1]);

      if (result !== null) {
        return buildResult(
          found.test,
          result,
          "",
          null,
          null,
          inrMatch[2]?.trim() || null,
          originalLine
        );
      }
    }
  }

  // Format: result low-high unit
  const standard = remainder.match(
    /^[*#]?\s*[<>]?\s*([+-]?\d[\d,]*(?:\.\d+)?)\s+([+-]?\d[\d,]*(?:\.\d+)?)\s*-\s*([+-]?\d[\d,]*(?:\.\d+)?)\s+(.+)$/i
  );

  if (standard) {
    const result = parseNumber(standard[1]);
    const low = parseNumber(standard[2]);
    const high = parseNumber(standard[3]);
    const unit = standard[4].trim();

    if (
      result !== null &&
      low !== null &&
      high !== null &&
      low <= high &&
      unit.length <= 40 &&
      !/\d{5,}/.test(unit)
    ) {
      return buildResult(
        found.test,
        result,
        unit,
        low,
        high,
        `${low} - ${high}`,
        originalLine
      );
    }
  }

  // Format: result < bound unit, or result > bound unit
  const oneSided = remainder.match(
    /^[*#]?\s*([+-]?\d[\d,]*(?:\.\d+)?)\s+([<>]=?)\s*([+-]?\d[\d,]*(?:\.\d+)?)\s+(.+)$/i
  );

  if (oneSided) {
    const result = parseNumber(oneSided[1]);
    const operator = oneSided[2];
    const bound = parseNumber(oneSided[3]);
    const unit = oneSided[4].trim();

    if (
      result !== null &&
      bound !== null &&
      unit.length <= 40 &&
      !/\d{5,}/.test(unit)
    ) {
      return buildResult(
        found.test,
        result,
        unit,
        operator.startsWith(">") ? bound : null,
        operator.startsWith("<") ? bound : null,
        `${operator} ${bound}`,
        originalLine
      );
    }
  }

  // Format: result unit < bound, or result unit > bound
  const trailingLimit = remainder.match(
    /^[*#]?\s*([+-]?\d[\d,]*(?:\.\d+)?)\s+(.+?)\s+([<>]=?)\s*([+-]?\d[\d,]*(?:\.\d+)?)$/i
  );

  if (trailingLimit) {
    const result = parseNumber(trailingLimit[1]);
    const unit = trailingLimit[2].trim();
    const operator = trailingLimit[3];
    const bound = parseNumber(trailingLimit[4]);

    if (
      result !== null &&
      bound !== null &&
      unit.length <= 40 &&
      !/\d{5,}/.test(unit)
    ) {
      return buildResult(
        found.test,
        result,
        unit,
        operator.startsWith(">") ? bound : null,
        operator.startsWith("<") ? bound : null,
        `${operator} ${bound}`,
        originalLine
      );
    }
  }

  // Format: result unit low-high
  const resultThenUnit = remainder.match(
    /^[*#]?\s*([+-]?\d[\d,]*(?:\.\d+)?)\s+([a-zA-Z%µμ/³0-9.]+)\s+([+-]?\d[\d,]*(?:\.\d+)?)\s*-\s*([+-]?\d[\d,]*(?:\.\d+)?)$/i
  );

  if (resultThenUnit) {
    const result = parseNumber(resultThenUnit[1]);
    const unit = resultThenUnit[2].trim();
    const low = parseNumber(resultThenUnit[3]);
    const high = parseNumber(resultThenUnit[4]);

    if (
      result !== null &&
      low !== null &&
      high !== null &&
      low <= high
    ) {
      return buildResult(
        found.test,
        result,
        unit,
        low,
        high,
        `${low} - ${high}`,
        originalLine
      );
    }
  }

  // Safe fallback: retain a clearly identified result even when its
  // unit or reference interval could not be confidently parsed.
  const fallback = remainder.match(
    /^[*#]?\s*([+-]?\d[\d,]*(?:\.\d+)?)(?=\s|$)(.*)$/
  );

  if (fallback) {
    const result = parseNumber(fallback[1]);

    if (result !== null) {
      const tail = fallback[2].trim();

      return buildResult(
        found.test,
        result,
        "",
        null,
        null,
        tail || null,
        originalLine
      );
    }
  }

  return null;
}

export function parseBloodReportText(text: string): ParsedBloodResult[] {
  const lines = text
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const parsed = lines
    .map(parseLine)
    .filter(
      (
        value
      ): value is Omit<ParsedBloodResult, "duplicate"> => value !== null
    );

  const counts = new Map<string, number>();

  for (const result of parsed) {
    counts.set(
      result.testCode,
      (counts.get(result.testCode) ?? 0) + 1
    );
  }

  return parsed.map((result) => ({
    ...result,
    duplicate: (counts.get(result.testCode) ?? 0) > 1,
  }));
}