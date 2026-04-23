import { NextResponse } from "next/server";

// TEMP: passwordless admin access for prototype/demo. Re-enable password check when env var is stable.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", "1", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
