/** Public GET /api/checkin/lookup payload. Returning guests need every key. */
export const CHECKIN_LOOKUP_DATA_KEYS = [
  "name",
  "contactNumber",
  "comingFrom",
  "nationality",
  "emergencyName",
  "emergencyPhone",
  "idType",
  "idCardLink",
  "visaLink",
  "formCData",
] as const;

export type CheckinLookupRecord = {
  name: string;
  contact: string;
  comingFrom?: string | null;
  nationality?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  idType?: string | null;
  idCardLink?: string | null;
  visaLink?: string | null;
  formCData?: string | null;
};

export function checkinLookupData(record: CheckinLookupRecord) {
  return {
    name: record.name,
    contactNumber: record.contact,
    comingFrom: record.comingFrom || "",
    nationality: record.nationality || "India",
    emergencyName: record.emergencyName || "",
    emergencyPhone: record.emergencyPhone || "",
    idType: record.idType || "",
    idCardLink: record.idCardLink || "",
    visaLink: record.visaLink || "",
    formCData: record.formCData || "",
  };
}
