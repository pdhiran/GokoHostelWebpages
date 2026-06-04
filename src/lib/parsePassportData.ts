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
  D: "GERMANY", DEU: "GERMANY", DEUTSCH: "GERMANY", DEUTSCHE: "GERMANY",
  GBR: "UNITED KINGDOM", GB: "UNITED KINGDOM", BRITISH: "UNITED KINGDOM",
  USA: "UNITED STATES", US: "UNITED STATES", FRA: "FRANCE", F: "FRANCE",
  ITA: "ITALY", I: "ITALY", ESP: "SPAIN", E: "SPAIN", NLD: "NETHERLANDS",
  NL: "NETHERLANDS", BEL: "BELGIUM", AUT: "AUSTRIA", CHE: "SWITZERLAND",
  CH: "SWITZERLAND", SWE: "SWEDEN", NOR: "NORWAY", DNK: "DENMARK",
  FIN: "FINLAND", PRT: "PORTUGAL", IRL: "IRELAND", POL: "POLAND",
  CZE: "CZECH REPUBLIC", ROU: "ROMANIA", HUN: "HUNGARY", GRC: "GREECE",
  AUS: "AUSTRALIA", NZL: "NEW ZEALAND", CAN: "CANADA", JPN: "JAPAN",
  KOR: "SOUTH KOREA", CHN: "CHINA", IND: "INDIA", BRA: "BRAZIL",
  MEX: "MEXICO", ARG: "ARGENTINA", ZAF: "SOUTH AFRICA", RUS: "RUSSIA",
  TUR: "TURKEY", ISR: "ISRAEL", THA: "THAILAND", MYS: "MALAYSIA",
  SGP: "SINGAPORE", IDN: "INDONESIA", PHL: "PHILIPPINES", VNM: "VIETNAM",
  COL: "COLOMBIA", PER: "PERU", CHL: "CHILE", ARE: "UNITED ARAB EMIRATES",
  SAU: "SAUDI ARABIA", EGY: "EGYPT", NPL: "NEPAL", LKA: "SRI LANKA",
  BGD: "BANGLADESH", PAK: "PAKISTAN", UKR: "UKRAINE", ISL: "ICELAND",
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

  return {
    surname,
    givenName,
    passportNumber,
    nationality,
    dateOfBirth: dob,
    sex,
    expiryDate: expiry,
  };
}

const DATE_PATTERN = /(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}|\d{1,2}\s+[A-Z]{3}\s+\d{4})/i;

function matchDate(text: string, ...prefixes: string[]): string | undefined {
  for (const prefix of prefixes) {
    const regex = new RegExp(`${prefix}[\\s:]*${DATE_PATTERN.source}`, "i");
    const m = text.match(regex);
    if (m) return m[1];
  }
  return undefined;
}

function parsePassportFromFreeText(text: string): Partial<PassportData> {
  const result: Partial<PassportData> = {};

  const passportNoMatch = text.match(/(?:passport\s*(?:no|number|#)|pass[\s-]*n[or][\s.:]*|no[.:]\s*)[\s:]*([A-Z0-9]{6,12})/i);
  if (passportNoMatch) result.passportNumber = passportNoMatch[1];

  const nameMatch = text.match(/(?:given\s*names?|first\s*names?|vorname[n]?)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (nameMatch) result.givenName = nameMatch[1].trim();

  const surnameMatch = text.match(/(?:surname|family\s*name|last\s*name|name)[\s/:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (surnameMatch) result.surname = surnameMatch[1].trim();

  const sexMatch = text.match(/(?:sex|gender|geschlecht)[\s/:]*([MF]|Male|Female)/i);
  if (sexMatch) result.sex = sexMatch[1].length === 1 ? (sexMatch[1] === "M" ? "Male" : "Female") : sexMatch[1];

  const dob = matchDate(text, "date\\s*of\\s*birth", "d\\.?o\\.?b\\.?", "born", "geburtsdatum", "geburtst");
  if (dob) result.dateOfBirth = dob;

  const expiry = matchDate(text, "expiry", "valid\\s*(?:till|until|thru)", "date\\s*of\\s*expiry", "gültig\\s*bis");
  if (expiry) result.expiryDate = expiry;

  const issue = matchDate(text, "date\\s*of\\s*issue", "issued", "ausstellungsdatum");
  if (issue) result.dateOfIssue = issue;

  const placeMatch = text.match(/(?:place\s*of\s*issue|authority|behörde)[\s/:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (placeMatch) result.placeOfIssue = placeMatch[1].trim();

  const nationalityMatch = text.match(/(?:nationality|citizen|staatsangehörigkeit)[\s/:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (nationalityMatch) {
    const raw = nationalityMatch[1].trim();
    result.nationality = resolveCountryCode(raw) || raw;
  }

  return result;
}

export function parseVisaFromText(text: string): Partial<VisaData> {
  const result: Partial<VisaData> = {};

  const visaNoMatch = text.match(/visa\s*no[.:]*[\s]*([A-Z0-9]{4,20})/i);
  if (visaNoMatch) result.visaNumber = visaNoMatch[1];

  const typeMatch = text.match(/visa\s*type[.:]*[\s]*([A-Za-z\s\-]+?)(?:\n|$)/i);
  if (typeMatch) result.type = typeMatch[1].trim();

  const issueDate = matchDate(text, "issue\\s*date", "date\\s*of\\s*issue", "issued");
  if (issueDate) result.dateOfIssue = issueDate;

  const expiryDate = matchDate(text, "expiry\\s*date", "valid\\s*(?:till|until|thru)", "expiry");
  if (expiryDate) result.validTill = expiryDate;

  const placeMatch = text.match(/(?:place\s*of\s*issue|airport|port)[\s:,.]*([A-Za-z\s,]+?)(?:\n|$)/i);
  if (placeMatch) result.placeOfIssue = placeMatch[1].trim();

  return result;
}

export function extractFormCData(passportOcrText: string, visaOcrText: string): FormCExtractedData {
  return {
    passport: parsePassportMRZ(passportOcrText),
    visa: parseVisaFromText(visaOcrText),
  };
}
