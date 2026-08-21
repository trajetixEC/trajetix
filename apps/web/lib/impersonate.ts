import { createHmac } from "crypto";

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "trajetix-impersonate-secret-key-2026";
}

export function generateImpersonateToken(targetUserId: string, adminUserId: string): string {
  const expiresAt = Date.now() + 60 * 1000; // Token válido por 60 segundos
  const payload = `${targetUserId}:${adminUserId}:${expiresAt}`;
  const secret = getAuthSecret();
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  
  return Buffer.from(
    JSON.stringify({ targetUserId, adminUserId, expiresAt, signature })
  ).toString("base64url");
}

export function verifyImpersonateToken(tokenStr: string): { targetUserId: string; adminUserId: string } | null {
  try {
    const rawJson = Buffer.from(tokenStr, "base64url").toString("utf-8");
    const parsed = JSON.parse(rawJson);
    const { targetUserId, adminUserId, expiresAt, signature } = parsed;

    if (
      typeof targetUserId !== "string" ||
      typeof adminUserId !== "string" ||
      typeof expiresAt !== "number" ||
      typeof signature !== "string"
    ) {
      return null;
    }

    if (Date.now() > expiresAt) {
      return null; // Expired token
    }

    const payload = `${targetUserId}:${adminUserId}:${expiresAt}`;
    const secret = getAuthSecret();
    const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");

    if (signature !== expectedSignature) {
      return null; // Invalid signature
    }

    return { targetUserId, adminUserId };
  } catch {
    return null;
  }
}
