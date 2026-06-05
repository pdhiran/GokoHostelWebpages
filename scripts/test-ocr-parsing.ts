import { parsePassportMRZ, parseVisaFromText } from "../src/lib/parsePassportData";

let passed = 0;
let failed = 0;

function assert(label: string, actual: unknown, expected: unknown, compareFn?: (a: string, b: string) => boolean) {
  const a = String(actual ?? "");
  const e = String(expected ?? "");
  const ok = compareFn ? compareFn(a, e) : a === e;
  if (ok) {
    console.log(`  ✅ PASS: ${label}  (got "${a}")`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    console.log(`         expected: "${e}"`);
    console.log(`         actual:   "${a}"`);
    failed++;
  }
}

const contains = (a: string, b: string) => a.toUpperCase().includes(b.toUpperCase());

// ── Passport MRZ test ──────────────────────────────────────────────
const passportOcr = `11 Wohnort/Reside\nKONSTANZ\n11 Wohnort/Residence/Domicile\n11 Wohnort/Residence/Domicile\nBUNDESREPUBLIK DEUTSCHLAND\nFEDERAL REPUBLIC OF GERMANY REPUBLIQUE FEDERALE D'ALLEMAGNE\nTyp/Type/Type\nP\nKode/Code/Code:\nD\nREISEPASS\nPASSPORT PASSEPORT\nPass-Nr./Passport No./ Passeport No.\nC1WPVX5CF\n1[o] Name/Surname / Nom [b] Geburtsname/Name at birth? Nom de naissance\n(a) BAUER\n2 Vornamen / Given names/Prénoms\nAXEL ANDREAS\n3 Geburtstag/Date of birth/ 4. Geschlecht/Sex/\nDate de naissance\n21.06.2002\nSexe\nM\n6 Geburtsort/Place of birth/Lieu de naissance\nCOLCHESTER\n7.\nAusstellungsdatum/Date\nof issue/Date de délivrance\n5. Staatsangehörigkeit/Nationality/\n8. Gültig bis/Date of expiry /\nDate d'expiration\n16.05.2029\nNationalité\nDEUTSCH\nD\n10. Unterschrift der Inhaberin\ndes Inhabers/Signature of bearer/\nSignature de la titulaire, du titulaire\nAdi\nBo\n17.05.2023\n9. Behörde/Authority/Autorité\nSTADT KONSTANZ\nGABIT UND RECHT UND FRENET BUCUR\nDEUTSCHLAND NIGREIT UND RECHT L\nP<D<<BAUER<<AXEL<ANDREAS<<<<<<<<<<<<<<<<<<<<\nC1WPVX5CF6D<<0206215M29051652101<<<<<<<<<<40\n12. Größe/Height/Taille\n178 cm\n13. Augenfarbe / Colour of eyes / Couleur des yeux\nBLAU\n14. Ordens- oder Künstlername/Religious name or pseudonym/\nNom de religion ou pseudonyme\n►Zugangsnummer (CAN)\n973756`;

console.log("═══ Passport MRZ Parsing ═══");
const passport = parsePassportMRZ(passportOcr);
console.log("\nParsed passport:", JSON.stringify(passport, null, 2));
console.log();

assert("surname", passport.surname, "BAUER");
assert("givenName", passport.givenName, "AXEL ANDREAS");
assert("passportNumber", passport.passportNumber, "C1WPVX5CF");
assert("nationality", passport.nationality, "GERMANY");
assert("sex", passport.sex, "Male");
assert("dateOfBirth", passport.dateOfBirth, "21/06/2002");
assert("expiryDate", passport.expiryDate, "16/05/2029");
assert("dateOfIssue", passport.dateOfIssue, "17/05/2023");
assert("placeOfIssue", passport.placeOfIssue, "STADT KONSTANZ");

// ── Visa test ──────────────────────────────────────────────────────
const visaOcr = `14\nIMMIGRATION INDIA\n22 APR 2026\nNEW DELHI\nBUREAU OF IMMIGRATION, INDIA\nVisa Type\nVisa No.\nIssue\nDate\nTOURYST\n900FC5B14 B\n22 APR 2026\nExpiry Date 22 MAK 20214\nEntries Permitted\nEnines availed 1st\n1/2/3/MULTIPLE\n2nd\n3rd\n4th\nEach stay not to exceed 30/60/90/160 days.\n*Conditions mentioned in ETA Apply\nIGI AIRPORT NEW CELHI`;

console.log("\n═══ Visa Parsing ═══");
const visa = parseVisaFromText(visaOcr);
console.log("\nParsed visa:", JSON.stringify(visa, null, 2));
console.log();

assert("type", visa.type, "Tourist");
assert("dateOfIssue", visa.dateOfIssue, "22/04/2026");
assert("placeOfIssue contains NEW DELHI", visa.placeOfIssue, "NEW DELHI", contains);

// ── Summary ────────────────────────────────────────────────────────
console.log(`\n═══ Summary: ${passed} passed, ${failed} failed ═══`);
process.exit(failed > 0 ? 1 : 0);
