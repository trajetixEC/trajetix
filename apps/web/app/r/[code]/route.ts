import { NextResponse } from "next/server";
import { normalizeReferralCode, REFERRAL_COOKIE } from "../../../lib/referrals";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = normalizeReferralCode(rawCode);
  const destination = new URL(
    `/registro${code ? `?ref=${code}` : ""}`,
    request.url,
  );
  const response = NextResponse.redirect(destination);
  if (code) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
