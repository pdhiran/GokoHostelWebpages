/**
 * Parse passport and visa details from OCR text.
 * Extracts MRZ (Machine Readable Zone) data from passports and visa fields.
 */

export type PassportData = {
  surname: string;
  givenName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  expiryDate: string;
  placeOfIssue: string;
  dateOfIssue: string;
  country: string;
};

export type VisaData = {
  visaNumber: string;
  type: string;
  placeOfIssue: string;
  dateOfIssue: string;
  validTill: string;
  country: string;
};

export type FormCExtractedData = {
  passport?: Partial<PassportData>;
  visa?: Partial<VisaData>;
};

const COUNTRY_CODES: Record<string, string> = {
  // ISO alpha-3 and common MRZ codes
  D: "GERMANY", DEU: "GERMANY", DEUTSCH: "GERMANY", DEUTSCHE: "GERMANY", ALLEMAGNE: "GERMANY", DUITSLAND: "GERMANY", ALEMANIA: "GERMANY", GERMANIA: "GERMANY",
  GBR: "UNITED KINGDOM", GB: "UNITED KINGDOM", BRITISH: "UNITED KINGDOM", BRITANNIQUE: "UNITED KINGDOM",
  USA: "UNITED STATES", US: "UNITED STATES", AMERICAN: "UNITED STATES", AMÉRICAIN: "UNITED STATES",
  FRA: "FRANCE", F: "FRANCE", FRANÇAIS: "FRANCE", FRANÇAISE: "FRANCE", FRENCH: "FRANCE", FRANCIA: "FRANCE", FRANKRIJK: "FRANCE",
  ITA: "ITALY", I: "ITALY", ITALIEN: "ITALY", ITALIENNE: "ITALY", ITALIANA: "ITALY", ITALIANO: "ITALY", ITALIE: "ITALY",
  ESP: "SPAIN", E: "SPAIN", ESPAGNE: "SPAIN", SPANJE: "SPAIN", ESPAÑOLA: "SPAIN", SPANIEN: "SPAIN",
  NLD: "NETHERLANDS", NL: "NETHERLANDS", NÉERLANDAIS: "NETHERLANDS", NÉERLANDAISE: "NETHERLANDS", NEDERLANDS: "NETHERLANDS", NIEDERLÄNDISCH: "NETHERLANDS", HOLLANDAIS: "NETHERLANDS", PAYS: "NETHERLANDS",
  BEL: "BELGIUM", BELGIQUE: "BELGIUM", BELGE: "BELGIUM", BELGISCH: "BELGIUM", BELGIEN: "BELGIUM", BÉLGICA: "BELGIUM",
  AUT: "AUSTRIA", ÖSTERREICH: "AUSTRIA", AUTRICHIEN: "AUSTRIA", AUTRICHE: "AUSTRIA", OOSTENRIJK: "AUSTRIA",
  CHE: "SWITZERLAND", CH: "SWITZERLAND", SUISSE: "SWITZERLAND", SCHWEIZ: "SWITZERLAND", SVIZZERA: "SWITZERLAND", ZWITSERLAND: "SWITZERLAND",
  SWE: "SWEDEN", SUÈDE: "SWEDEN", SCHWEDEN: "SWEDEN", ZWEDEN: "SWEDEN", SUECIA: "SWEDEN",
  NOR: "NORWAY", NORVÈGE: "NORWAY", NORWEGEN: "NORWAY", NOORWEGEN: "NORWAY", NORUEGA: "NORWAY",
  DNK: "DENMARK", DANEMARK: "DENMARK", DÄNEMARK: "DENMARK", DENEMARKEN: "DENMARK", DINAMARCA: "DENMARK",
  FIN: "FINLAND", FINLANDE: "FINLAND", FINNLAND: "FINLAND",
  PRT: "PORTUGAL", PORTUGAIS: "PORTUGAL", PORTUGUESA: "PORTUGAL",
  IRL: "IRELAND", IRLANDE: "IRELAND", IRLAND: "IRELAND", IERLAND: "IRELAND", IRLANDA: "IRELAND",
  POL: "POLAND", POLOGNE: "POLAND", POLEN: "POLAND", POLSKA: "POLAND", POLONIA: "POLAND",
  CZE: "CZECH REPUBLIC", TCHÈQUE: "CZECH REPUBLIC", TSCHECHIEN: "CZECH REPUBLIC",
  ROU: "ROMANIA", ROUMANIE: "ROMANIA", RUMÄNIEN: "ROMANIA",
  HUN: "HUNGARY", HONGRIE: "HUNGARY", UNGARN: "HUNGARY", HONGARIJE: "HUNGARY",
  GRC: "GREECE", GRÈCE: "GREECE", GRIECHENLAND: "GREECE", GRIEKENLAND: "GREECE", GRECIA: "GREECE",
  AUS: "AUSTRALIA", NZL: "NEW ZEALAND", CAN: "CANADA", JPN: "JAPAN", JAPON: "JAPAN",
  KOR: "SOUTH KOREA", CHN: "CHINA", CHINE: "CHINA", IND: "INDIA", INDE: "INDIA", INDIEN: "INDIA",
  BRA: "BRAZIL", BRÉSIL: "BRAZIL", BRASILIEN: "BRAZIL", BRASILE: "BRAZIL", BRASIL: "BRAZIL",
  MEX: "MEXICO", MEXIQUE: "MEXICO", MEXIKO: "MEXICO", ARG: "ARGENTINA", ARGENTINE: "ARGENTINA",
  ZAF: "SOUTH AFRICA", RUS: "RUSSIA", RUSSIE: "RUSSIA", RUSSLAND: "RUSSIA",
  TUR: "TURKEY", TURQUIE: "TURKEY", TÜRKEI: "TURKEY", TURKIJE: "TURKEY",
  ISR: "ISRAEL", ISRAËL: "ISRAEL", ISRAELISCH: "ISRAEL", ISRAÉLIEN: "ISRAEL",
  THA: "THAILAND", THAÏLANDE: "THAILAND", MYS: "MALAYSIA", MALAISIE: "MALAYSIA",
  SGP: "SINGAPORE", SINGAPOUR: "SINGAPORE", IDN: "INDONESIA", INDONÉSIE: "INDONESIA",
  PHL: "PHILIPPINES", VNM: "VIETNAM", COL: "COLOMBIA", COLOMBIE: "COLOMBIA",
  PER: "PERU", PÉROU: "PERU", CHL: "CHILE", CHILI: "CHILE",
  ARE: "UNITED ARAB EMIRATES", SAU: "SAUDI ARABIA", EGY: "EGYPT", ÉGYPTE: "EGYPT", ÄGYPTEN: "EGYPT",
  NPL: "NEPAL", NÉPAL: "NEPAL", LKA: "SRI LANKA",
  BGD: "BANGLADESH", PAK: "PAKISTAN", UKR: "UKRAINE", ISL: "ICELAND", ISLANDE: "ICELAND",
  LTU: "LITHUANIA", LVA: "LATVIA", EST: "ESTONIA", SVK: "SLOVAKIA", SVN: "SLOVENIA",
  HRV: "CROATIA", SRB: "SERBIA", BGR: "BULGARIA", CYP: "CYPRUS", MLT: "MALTA", LUX: "LUXEMBOURG",
};

function resolveCountryCode(code: string): string {
  if (!code) return "";
  const upper = code.toUpperCase().trim();
  return COUNTRY_CODES[upper] || upper;
}

const MRZ_LINE_REGEX = /^[A-Z0-9<]{30,44}$/;

function parseMRZDate(raw: string): string {
  if (raw.length !== 6) return "";
  const yy = raw.slice(0, 2);
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
  return `${dd}/${mm}/${year}`;
}

function cleanMRZName(raw: string): string {
  return raw.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

export function parsePassportMRZ(ocrText: string): Partial<PassportData> {
  const lines = ocrText.split("\n").map((l) => l.trim().replace(/\s/g, ""));
  const mrzLines = lines.filter((l) => MRZ_LINE_REGEX.test(l) && l.length >= 30);

  if (mrzLines.length < 2) {
    return parsePassportFromFreeText(ocrText);
  }

  const line1 = mrzLines[mrzLines.length - 2];
  const line2 = mrzLines[mrzLines.length - 1];

  if (line1.length < 44 || line2.length < 44) {
    return parsePassportFromFreeText(ocrText);
  }

  const nameSection = line1.slice(5);
  const nameParts = nameSection.split("<<");
  const surname = cleanMRZName(nameParts[0] || "");
  const givenName = cleanMRZName(nameParts.slice(1).join(" ") || "");

  const passportNumber = line2.slice(0, 9).replace(/</g, "");
  const rawNationality = line1.slice(2, 5).replace(/</g, "");
  const nationality = resolveCountryCode(rawNationality);
  const dob = parseMRZDate(line2.slice(13, 19));
  const sex = line2[20] === "F" ? "Female" : line2[20] === "M" ? "Male" : "";
  const expiry = parseMRZDate(line2.slice(21, 27));

  // dateOfIssue and placeOfIssue are NOT in the MRZ — extract from visual zone text
  const freeTextExtras = parsePassportFromFreeText(ocrText);

  let dateOfIssue = freeTextExtras.dateOfIssue;
  // If the free-text parser captured a date that matches the MRZ expiry, discard it —
  // German passports interleave issue/expiry labels so the wrong date can be grabbed.
  if (dateOfIssue && normalizeDate(dateOfIssue) === normalizeDate(expiry)) {
    dateOfIssue = undefined;
  }
  if (!dateOfIssue) {
    dateOfIssue = findDateOfIssueByElimination(ocrText, dob, expiry);
  }

  return {
    surname,
    givenName,
    passportNumber,
    nationality,
    dateOfBirth: dob,
    sex,
    expiryDate: expiry,
    ...(dateOfIssue && { dateOfIssue: normalizeDate(dateOfIssue) || dateOfIssue }),
    ...(freeTextExtras.placeOfIssue && { placeOfIssue: freeTextExtras.placeOfIssue }),
  };
}

// Matches: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, DD MM YYYY, D/M/YY,
// DD MON YYYY, DD MON/MON YYYY (bilingual), DD MONTH YYYY
const DATE_PATTERN = /(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}|\d{1,2}\s+[A-Z]{3,9}(?:\/[A-Z]{3,9})?\s+\d{4})/i;

function matchDate(text: string, ...prefixes: string[]): string | undefined {
  for (const prefix of prefixes) {
    // Allow up to 120 non-digit chars between the label and the date value
    // (EU passports: "Date of issue / Date de délivrance / Ausstellungsdatum\n22.09.2022")
    const regex = new RegExp(`${prefix}[^\\d]{0,120}?${DATE_PATTERN.source}`, "i");
    const m = text.match(regex);
    if (m) return m[1];
  }
  return undefined;
}

// Try to find a date on the lines FOLLOWING a label line
function matchDateNextLine(text: string, ...labelPatterns: string[]): string | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    for (const pattern of labelPatterns) {
      if (new RegExp(pattern, "i").test(line)) {
        // Check the next 6 lines for a date (OCR may interleave columns)
        for (let j = 1; j <= 6 && i + j < lines.length; j++) {
          const nextLine = lines[i + j].trim();
          const dateMatch = nextLine.match(DATE_PATTERN);
          if (dateMatch) return dateMatch[1];
        }
      }
    }
  }
  return undefined;
}

// Find ALL dates in text, return as array
function findAllDates(text: string): string[] {
  const dates: string[] = [];
  const globalPattern = new RegExp(DATE_PATTERN.source, "gi");
  let match;
  while ((match = globalPattern.exec(text)) !== null) {
    dates.push(match[1]);
  }
  return dates;
}

// Normalize a date to DD/MM/YYYY for comparison
function normalizeDate(d: string): string {
  if (!d) return "";
  // DD.MM.YYYY or DD/MM/YYYY
  const numMatch = d.match(/^(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{2,4})$/);
  if (numMatch) {
    const yr = numMatch[3].length === 2 ? (parseInt(numMatch[3]) > 50 ? `19${numMatch[3]}` : `20${numMatch[3]}`) : numMatch[3];
    return `${numMatch[1].padStart(2, "0")}/${numMatch[2].padStart(2, "0")}/${yr}`;
  }
  // DD MON YYYY (supports EN, FR, DE, NL, ES, IT, PT month abbreviations)
  const monthMap: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
    // French
    JANV: "01", FEVR: "02", FÉV: "02", MARS: "03", AVR: "04", AVRI: "04",
    MAI: "05", JUIN: "06", JUIL: "07", AOÛT: "08", AOUT: "08", SEPT: "09",
    // German
    MÄR: "03", MARZ: "03", MRZ: "03", DEZ: "12", OKT: "10",
    // Dutch
    MEI: "05", MRT: "03", // Spanish/Italian/Portuguese
    ENE: "01", ABR: "04", AGO: "08", SET: "09", DIC: "12", GEN: "01", LUG: "07", OTT: "10",
  };
  const textMatch = d.match(/^(\d{1,2})\s+([A-ZÀ-ÿ]{3,9})(?:\/[A-ZÀ-ÿ]{3,9})?\s+(\d{4})$/i);
  if (textMatch) {
    const key = textMatch[2].toUpperCase().replace(/[ÉÈ]/g, "E").replace(/[Ü]/g, "U").replace(/[Ä]/g, "A").slice(0, 4);
    const mm = monthMap[key] || monthMap[key.slice(0, 3)];
    if (mm) return `${textMatch[1].padStart(2, "0")}/${mm}/${textMatch[3]}`;
  }
  return d;
}

// Find date of issue by elimination: remove known DOB and expiry, return the remaining date
function findDateOfIssueByElimination(text: string, knownDob: string, knownExpiry: string): string | undefined {
  const allDates = findAllDates(text);
  if (allDates.length === 0) return undefined;

  const normDob = normalizeDate(knownDob);
  const normExpiry = normalizeDate(knownExpiry);

  const candidates = allDates.filter((d) => {
    const norm = normalizeDate(d);
    return norm !== normDob && norm !== normExpiry && norm.length > 0;
  });

  if (candidates.length === 0) return undefined;
  // If multiple candidates, prefer the one closest to (but before) expiry — that's likely the issue date
  return candidates[0];
}

function parsePassportFromFreeText(text: string): Partial<PassportData> {
  const result: Partial<PassportData> = {};

  // Passport number — multilingual labels
  const passportNoMatch = text.match(/(?:passport\s*(?:no|number|#)|pass[\s-]*n[or][\s.:]*|no[.:]\s*|passeport\s*n|paspoort\s*n|pasaporte\s*n|passaporto\s*n|מספר\s*דרכון)[\s:]*([A-Z0-9]{6,12})/i);
  if (passportNoMatch) result.passportNumber = passportNoMatch[1];

  // Given name — EN, DE, FR, NL, ES, IT, PT, HE
  const nameMatch = text.match(/(?:given\s*names?|first\s*names?|vorname[n]?|pr[ée]nom[s]?|voornamen?|nombre[s]?|nome|שם פרטי)[\s:]*([A-Za-zÀ-ÿ\s]+?)(?:\n|$)/i);
  if (nameMatch) result.givenName = nameMatch[1].trim();

  // Surname — EN, DE, FR, NL, ES, IT, PT, HE
  const surnameMatch = text.match(/(?:surname|family\s*name|last\s*name|nom|naam|achternaam|apellido[s]?|cognome|sobrenome|שם משפחה)[\s/:]*([A-Za-zÀ-ÿ\s]+?)(?:\n|$)/i);
  if (surnameMatch) result.surname = surnameMatch[1].trim();

  // Sex — EN, DE, FR, NL, ES, IT, PT, HE
  const sexMatch = text.match(/(?:sex|gender|geschlecht|sexe|geslacht|sexo|sesso|מין)[\s/:]*([MFmf]|Male|Female|Masculin|F[ée]minin|Mannelijk|Vrouwelijk|Masculino|Feminino|Maschile|Femminile)/i);
  if (sexMatch) {
    const v = sexMatch[1].toUpperCase();
    if (v === "M" || v.startsWith("MA")) result.sex = "Male";
    else if (v === "F" || v.startsWith("FE") || v.startsWith("FÉ") || v.startsWith("VR")) result.sex = "Female";
  }

  // Date of Birth — EN, DE, FR, NL, ES, IT, PT, HE
  const dob = matchDate(text,
    "date\\s*of\\s*birth", "d\\.?o\\.?b\\.?", "born",
    "geburtsdatum", "geburtst",
    "date\\s*de\\s*naissance", "n[ée]\\s*le",
    "geboortedatum",
    "fecha\\s*de\\s*nacimiento",
    "data\\s*di\\s*nascita", "data\\s*de\\s*nascimento",
    "תאריך\\s*לידה"
  );
  if (dob) result.dateOfBirth = normalizeDate(dob) || dob;

  // Expiry / Valid till — EN, DE, FR, NL, ES, IT, PT, HE
  const expiry = matchDate(text,
    "expiry", "valid\\s*(?:till|until|thru)", "date\\s*of\\s*expiry",
    "gültig\\s*bis", "ablaufdatum",
    "date\\s*d[''']expiration", "valable\\s*jusqu",
    "geldig\\s*tot", "vervaldatum",
    "fecha\\s*de\\s*(?:expiraci[oó]n|caducidad|vencimiento)",
    "data\\s*di\\s*scadenza", "scadenza",
    "data\\s*de\\s*validade",
    "תוקף\\s*עד", "בתוקף\\s*עד"
  );
  if (expiry) result.expiryDate = normalizeDate(expiry) || expiry;

  // Date of Issue — EN, DE, FR, NL, ES, IT, PT, HE
  const issuePrefixes = [
    "date\\s*of\\s*issue", "issued",
    "ausstellungsdatum", "ausgestellt",
    "date\\s*de\\s*d[ée]livrance", "d[ée]livr[ée]\\s*le",
    "datum\\s*van\\s*(?:afgifte|uitgifte)", "afgegeven",
    "fecha\\s*de\\s*expedici[oó]n",
    "data\\s*di\\s*rilascio", "rilasciato",
    "data\\s*de\\s*emiss[aã]o",
    "תאריך\\s*הנפקה"
  ];
  const issue = matchDate(text, ...issuePrefixes);
  if (issue) {
    result.dateOfIssue = normalizeDate(issue) || issue;
  } else {
    // Fallback: look for date on the line after the label line
    const issueNextLine = matchDateNextLine(text, ...issuePrefixes);
    if (issueNextLine) result.dateOfIssue = normalizeDate(issueNextLine) || issueNextLine;
  }

  // Place of Issue / Authority — EU passports have multilingual labels on one line, value on next
  // e.g. "Authority / Autorité / Behörde\nStadt Regensburg" or "Authority Autorité Behörde\nStadt Regensburg"
  const placeLabels = "(?:place\\s*of\\s*issue|authority|issuing\\s*authority|beh[oö]rde|ausstellungsbeh[oö]rde|autorit[ée]|lieu\\s*de\\s*d[ée]livrance|afgegeven\\s*door|autoriteit|lugar\\s*de\\s*expedici[oó]n|autorit[àa]\\s*di\\s*rilascio|luogo\\s*di\\s*rilascio|local\\s*de\\s*emiss[aã]o|רשות\\s*מנפיקה)";
  // Match the label line (possibly with multiple language labels), then capture the value on the next line
  const placeNewlineMatch = text.match(new RegExp(`${placeLabels}[^\\n]*\\n\\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s\\-\\.]+?)(?:\\n|$)`, "i"));
  if (placeNewlineMatch) {
    const val = placeNewlineMatch[1].trim();
    // Skip if the captured value is just another label
    const labelWords = ["date", "valid", "expiry", "passport", "pass", "name", "given", "sex", "code", "type"];
    if (!labelWords.some((w) => val.toLowerCase().startsWith(w)) && val.length > 1) {
      result.placeOfIssue = val;
    }
  }
  if (!result.placeOfIssue) {
    // Fallback: look for common patterns like "Stadt XXX", "Ville de XXX", "Gemeente XXX"
    const cityPrefixMatch = text.match(/(?:stadt|ville\s*de|gemeente|ciudad\s*de|citt[àa]\s*di|cidade\s*de)\s+([A-Za-zÀ-ÿ\s\-]+?)(?:\n|$)/i);
    if (cityPrefixMatch) result.placeOfIssue = cityPrefixMatch[0].trim();
    else {
      // Original fallback
      const simplePlaceMatch = text.match(/(?:place\s*of\s*issue|authority|beh[oö]rde)[\s/:]*([A-Za-zÀ-ÿ\s\-]+?)(?:\n|$)/i);
      if (simplePlaceMatch) {
        const val = simplePlaceMatch[1].trim();
        const skipWords = ["autorit", "behörd", "lieu", "autoriteit", "lugar", "place", "date", "délivr"];
        if (!skipWords.some((w) => val.toLowerCase().startsWith(w)) && val.length > 2) {
          result.placeOfIssue = val;
        }
      }
    }
  }

  // Nationality — EN, DE, FR, NL, ES, IT, PT, HE
  const nationalityMatch = text.match(/(?:nationality|citizen|staatsangeh[öo]rigkeit|nationalit[ée]|nationaliteit|nacionalidad|cittadinanza|nacionalidade|אזרחות|לאום)[\s/:]*([A-Za-zÀ-ÿ\s]+?)(?:\n|$)/i);
  if (nationalityMatch) {
    const raw = nationalityMatch[1].trim();
    result.nationality = resolveCountryCode(raw) || raw;
  }

  return result;
}

export function parseVisaFromText(text: string): Partial<VisaData> {
  const result: Partial<VisaData> = {};

  // Visa number: various formats
  const visaNoMatch = text.match(/(?:visa\s*no|visa\s*number|no\s*de\s*visa|visum\s*(?:nr|nummer))[\s.:]*([A-Z0-9][A-Z0-9\-]{3,19})/i);
  if (visaNoMatch) {
    const candidate = visaNoMatch[1].trim();
    const skipWords = ["issue", "date", "type", "place", "valid", "from", "entry", "entries"];
    if (!skipWords.some((w) => candidate.toLowerCase().startsWith(w))) {
      result.visaNumber = candidate;
    }
  }
  if (!result.visaNumber) {
    // Fallback: look for standalone alphanumeric code near "visa" keyword (Indian e-Visa format)
    const altMatch = text.match(/visa[^A-Z0-9]{0,30}?([A-Z0-9]{6,20})/i);
    if (altMatch) {
      const candidate = altMatch[1];
      if (!/^(type|date|issue|valid|place|from|entry)/i.test(candidate)) {
        result.visaNumber = candidate;
      }
    }
  }

  // Type of Visa — look for explicit label first, then detect common types
  const typeMatch = text.match(/(?:visa\s*type|type\s*of\s*visa|type\s*de\s*visa|visa\s*categor|categor[iy])[\s.:]*([A-Za-z\s\-]+?)(?:\n|$)/i);
  if (typeMatch) {
    const t = typeMatch[1].trim();
    if (t.length < 30) result.type = t;
  }
  if (!result.type) {
    // Detect common visa types directly from text (handles OCR typos like "TOURYIST" for "TOURIST")
    const typePatterns = [
      { pattern: /e[\s-]*tourist/i, value: "Tourist" },
      { pattern: /tou?r[yi1l]s?t/i, value: "Tourist" },
      { pattern: /e[\s-]*business/i, value: "Business" },
      { pattern: /bus[i1l]ness/i, value: "Business" },
      { pattern: /e[\s-]*medical/i, value: "Medical" },
      { pattern: /medical/i, value: "Medical" },
      { pattern: /e[\s-]*conference/i, value: "Conference" },
      { pattern: /conference/i, value: "Conference" },
      { pattern: /student/i, value: "Student" },
      { pattern: /employment/i, value: "Employment" },
      { pattern: /research/i, value: "Research" },
      { pattern: /transit/i, value: "Transit" },
      { pattern: /journalist/i, value: "Journalist" },
      { pattern: /entry\s*visa/i, value: "Entry" },
    ];
    for (const { pattern, value } of typePatterns) {
      if (pattern.test(text)) { result.type = value; break; }
    }
  }

  // Date of Issue
  const visaIssuePrefixes = [
    "issue\\s*date", "date\\s*of\\s*issue", "issued\\s*on", "issued",
    "issue\\ndate",
    "date\\s*de\\s*d[ée]livrance", "datum\\s*van\\s*afgifte",
    "fecha\\s*de\\s*expedici[oó]n"
  ];
  const issueDate = matchDate(text, ...visaIssuePrefixes);
  if (issueDate) {
    result.dateOfIssue = normalizeDate(issueDate) || issueDate;
  } else {
    const issueDateNextLine = matchDateNextLine(text, ...visaIssuePrefixes);
    if (issueDateNextLine) result.dateOfIssue = normalizeDate(issueDateNextLine) || issueDateNextLine;
  }

  // Valid Till / Expiry
  const visaExpiryPrefixes = [
    "expiry\\s*date", "valid\\s*(?:till|until|thru|upto|up\\s*to)",
    "date\\s*of\\s*expiry", "expires?\\s*on",
    "date\\s*d[''']expiration", "geldig\\s*tot"
  ];
  const expiryDate = matchDate(text, ...visaExpiryPrefixes);
  if (expiryDate) {
    result.validTill = normalizeDate(expiryDate) || expiryDate;
  } else {
    const expiryNextLine = matchDateNextLine(text, ...visaExpiryPrefixes);
    if (expiryNextLine) result.validTill = normalizeDate(expiryNextLine) || expiryNextLine;
  }

  // Fallback: if we have one date but not the other, use elimination
  if (!result.dateOfIssue || !result.validTill) {
    const allVisaDates = findAllDates(text);
    const knownDate = result.dateOfIssue || result.validTill || "";
    const normKnown = normalizeDate(knownDate);
    const unknownDates = allVisaDates.filter((d) => normalizeDate(d) !== normKnown && normalizeDate(d).length > 0);
    if (!result.dateOfIssue && unknownDates.length > 0) {
      result.dateOfIssue = normalizeDate(unknownDates[0]) || unknownDates[0];
    }
    if (!result.validTill && unknownDates.length > 1) {
      result.validTill = normalizeDate(unknownDates[1]) || unknownDates[1];
    }
  }

  // Place of Issue — prefer a known city name found in the text (resilient to OCR noise),
  // then fall back to regex-based extraction.
  const indianCities = ["NEW DELHI", "MUMBAI", "CHENNAI", "KOLKATA", "HYDERABAD", "BANGALORE", "BENGALURU", "COCHIN", "KOCHI", "GOA", "DELHI", "AHMEDABAD", "PUNE", "JAIPUR", "LUCKNOW", "CHANDIGARH", "TRIVANDRUM", "THIRUVANANTHAPURAM"];
  for (const city of indianCities) {
    if (text.toUpperCase().includes(city)) {
      result.placeOfIssue = city;
      break;
    }
  }
  if (!result.placeOfIssue) {
    const placeMatch = text.match(/(?:place\s*of\s*issue|issued\s*at|port\s*of\s*arrival|airport)[\s.:]*([A-Za-z\s]+?)(?:\n|$)/i);
    if (placeMatch) {
      result.placeOfIssue = placeMatch[1].trim().replace(/\s+/g, " ");
    }
  }

  return result;
}

export function extractFormCData(passportOcrText: string, visaOcrText: string): FormCExtractedData {
  return {
    passport: parsePassportMRZ(passportOcrText),
    visa: parseVisaFromText(visaOcrText),
  };
}
