import { NextRequest, NextResponse } from "next/server";
import { getLatestCheckinByContact } from "@/db/queries";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone")?.replace(/[\s\-]/g, "") || "";

  if (!phone || phone.length < 7) {
    return NextResponse.json({ found: false });
  }

  try {
    const record = await getLatestCheckinByContact(phone);

    if (!record) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      data: {
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
      },
    });
  } catch (error: any) {
    console.error("Lookup error:", error?.message || error);
    return NextResponse.json({ found: false });
  }
}
