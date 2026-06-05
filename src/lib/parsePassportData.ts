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

  return {
    surname,
    givenName,
    passportNumber,
    nationality,
    dateOfBirth: dob,
    sex,
    expiryDate: expiry,
    ...(freeTextExtras.dateOfIssue && { dateOfIssue: freeTextExtras.dateOfIssue }),
    ...(freeTextExtras.placeOfIssue && { placeOfIssue: freeTextExtras.placeOfIssue }),
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
  if (dob) result.dateOfBirth = dob;

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
  if (expiry) result.expiryDate = expiry;

  // Date of Issue — EN, DE, FR, NL, ES, IT, PT, HE
  const issue = matchDate(text,
    "date\\s*of\\s*issue", "issued",
    "ausstellungsdatum", "ausgestellt",
    "date\\s*de\\s*d[ée]livrance", "d[ée]livr[ée]\\s*le",
    "datum\\s*van\\s*(?:afgifte|uitgifte)", "afgegeven",
    "fecha\\s*de\\s*expedici[oó]n",
    "data\\s*di\\s*rilascio", "rilasciato",
    "data\\s*de\\s*emiss[aã]o",
    "תאריך\\s*הנפקה"
  );
  if (issue) result.dateOfIssue = issue;

  // Place of Issue / Authority — EN, DE, FR, NL, ES, IT, PT, HE
  const placeMatch = text.match(/(?:place\s*of\s*issue|authority|issuing\s*authority|behörde|ausstellungsbeh[oö]rde|autorit[ée]|lieu\s*de\s*d[ée]livrance|afgegeven\s*door|autoriteit|lugar\s*de\s*expedici[oó]n|autorit[àa]\s*di\s*rilascio|luogo\s*di\s*rilascio|local\s*de\s*emiss[aã]o|רשות\s*מנפיקה)[\s/:]*([A-Za-zÀ-ÿ\s\-]+?)(?:\n|$)/i);
  if (placeMatch) result.placeOfIssue = placeMatch[1].trim();

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

  // Visa number: look for alphanumeric code after "Visa No" (skip if it matches common label words)
  const visaNoMatch = text.match(/visa\s*no[.:]*[\s]*([A-Z0-9][A-Z0-9\-]{3,19})/i);
  if (visaNoMatch) {
    const candidate = visaNoMatch[1].trim();
    const skipWords = ["issue", "date", "type", "place", "valid", "from", "entry", "entries"];
    if (!skipWords.some((w) => candidate.toLowerCase().startsWith(w))) {
      result.visaNumber = candidate;
    }
  }

  const typeMatch = text.match(/visa\s*type[.:]*[\s]*([A-Za-z\s\-]+?)(?:\n|$)/i);
  if (typeMatch) {
    const t = typeMatch[1].trim();
    if (t.length < 30) result.type = t;
  }

  const issueDate = matchDate(text, "issue\\s*date", "date\\s*of\\s*issue");
  if (issueDate) result.dateOfIssue = issueDate;

  const expiryDate = matchDate(text, "expiry\\s*date", "valid\\s*(?:till|until|thru)", "expiry\\s*[.:]");
  if (expiryDate) {
    // Sanity check: if parsed year < current year, likely OCR error — still store but note
    result.validTill = expiryDate;
  }

  // Place: look for airport/city names near bottom of visa stamp
  const placeMatch = text.match(/(?:airport|port)[,.\s]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (placeMatch) {
    result.placeOfIssue = placeMatch[1].trim().replace(/\s+/g, " ");
  } else {
    const cityMatch = text.match(/(?:NEW\s*DELHI|MUMBAI|CHENNAI|KOLKATA|HYDERABAD|BANGALORE|COCHIN|GOA|DELHI)/i);
    if (cityMatch) result.placeOfIssue = cityMatch[0].toUpperCase();
  }

  return result;
}

export function extractFormCData(passportOcrText: string, visaOcrText: string): FormCExtractedData {
  return {
    passport: parsePassportMRZ(passportOcrText),
    visa: parseVisaFromText(visaOcrText),
  };
}
