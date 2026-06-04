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
  const nationality = line1.slice(2, 5).replace(/</g, "");
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

function parsePassportFromFreeText(text: string): Partial<PassportData> {
  const result: Partial<PassportData> = {};

  const passportNoMatch = text.match(/(?:passport\s*(?:no|number|#)[\s:]*|no[.:]\s*)([A-Z0-9]{6,12})/i);
  if (passportNoMatch) result.passportNumber = passportNoMatch[1];

  const nameMatch = text.match(/(?:given\s*name|first\s*name)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (nameMatch) result.givenName = nameMatch[1].trim();

  const surnameMatch = text.match(/(?:surname|family\s*name|last\s*name)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (surnameMatch) result.surname = surnameMatch[1].trim();

  const sexMatch = text.match(/(?:sex|gender)[\s:]*([MF]|Male|Female)/i);
  if (sexMatch) result.sex = sexMatch[1].length === 1 ? (sexMatch[1] === "M" ? "Male" : "Female") : sexMatch[1];

  const dobMatch = text.match(/(?:date\s*of\s*birth|d\.?o\.?b\.?|born)[\s:]*(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i);
  if (dobMatch) result.dateOfBirth = dobMatch[1];

  const expiryMatch = text.match(/(?:expiry|valid\s*(?:till|until|thru)|date\s*of\s*expiry)[\s:]*(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i);
  if (expiryMatch) result.expiryDate = expiryMatch[1];

  const issueMatch = text.match(/(?:date\s*of\s*issue|issued)[\s:]*(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i);
  if (issueMatch) result.dateOfIssue = issueMatch[1];

  const placeMatch = text.match(/(?:place\s*of\s*issue)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (placeMatch) result.placeOfIssue = placeMatch[1].trim();

  const nationalityMatch = text.match(/(?:nationality|citizen)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (nationalityMatch) result.nationality = nationalityMatch[1].trim();

  return result;
}

export function parseVisaFromText(text: string): Partial<VisaData> {
  const result: Partial<VisaData> = {};

  const visaNoMatch = text.match(/(?:visa\s*(?:no|number|#)|no[.:])[\s:]*([A-Z0-9]{4,20})/i);
  if (visaNoMatch) result.visaNumber = visaNoMatch[1];

  const typeMatch = text.match(/(?:type|category)[\s:]*([A-Za-z\s\-]+?)(?:\n|$)/i);
  if (typeMatch) result.type = typeMatch[1].trim();

  const issueDateMatch = text.match(/(?:date\s*of\s*issue|issued|from)[\s:]*(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i);
  if (issueDateMatch) result.dateOfIssue = issueDateMatch[1];

  const validTillMatch = text.match(/(?:valid\s*(?:till|until|thru)|expiry|to)[\s:]*(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i);
  if (validTillMatch) result.validTill = validTillMatch[1];

  const placeMatch = text.match(/(?:place\s*of\s*issue)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (placeMatch) result.placeOfIssue = placeMatch[1].trim();

  const countryMatch = text.match(/(?:country)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
  if (countryMatch) result.country = countryMatch[1].trim();

  return result;
}

export function extractFormCData(passportOcrText: string, visaOcrText: string): FormCExtractedData {
  return {
    passport: parsePassportMRZ(passportOcrText),
    visa: parseVisaFromText(visaOcrText),
  };
}
