import { NextRequest, NextResponse } from "next/server";
import { driveUploadFile, driveGetOrCreateFolder } from "@/lib/googleApiFetch";
import { getMonthKey, incrementStat, addSystemLog } from "@/db/queries";
import { isOfflineMode } from "@/lib/runtime";

export async function POST(req: NextRequest) {
  if (isOfflineMode()) {
    return NextResponse.json({ error: "File uploads require internet connection" }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string || "Guest";
    const type = formData.get("type") as string || "doc";
    const password = formData.get("password") as string;

    const adminPw = process.env.ADMIN_PASSWORD;
    const managerPw = process.env.MANAGER_PASSWORD;
    if (!password || (password !== adminPw && password !== managerPw)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const buffer = await file.arrayBuffer();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${name.replace(/[^a-zA-Z]/g, "_")}_${type}_${timestamp}.${ext}`;

    let targetFolderId = folderId;
    if (folderId) {
      try {
        targetFolderId = await driveGetOrCreateFolder(folderId, getMonthKey());
      } catch {}
    }

    const link = await driveUploadFile(fileName, file.type || "image/jpeg", buffer, targetFolderId);
    incrementStat("drive", 1).catch(() => {});
    addSystemLog({ level: "info", source: "admin-upload", message: `File uploaded for ${name} (${type})` }).catch(() => {});

    return NextResponse.json({ link });
  } catch (error: any) {
    console.error("Admin upload error:", error?.message);
    addSystemLog({ level: "error", source: "admin-upload", message: error?.message || "Upload failed" }).catch(() => {});
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
