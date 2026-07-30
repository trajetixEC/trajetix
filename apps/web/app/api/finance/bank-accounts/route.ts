export const dynamic = "force-dynamic";

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ECUADOR_BANKS } from "../../../../lib/ecuador-banks";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const input = z.object({
  bankCode: z.string(),
  accountType: z.enum(["AHORROS", "CORRIENTE"]),
  accountNumber: z.string().regex(/^\d{6,20}$/),
  holderName: z.string().trim().min(3).max(180),
  holderId: z.string().trim().min(8).max(30),
  isDefault: z.boolean().default(false),
});
function encrypt(value: string) {
  const key = createHash("sha256")
    .update(process.env.AUTH_SECRET ?? "")
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("finance:manage");
    if (!process.env.AUTH_SECRET)
      return Response.json(
        { error: "Cifrado no configurado" },
        { status: 503 },
      );
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Cuenta bancaria inválida", details: parsed.error.flatten() },
        { status: 400 },
      );
    const bank = ECUADOR_BANKS.find(([code]) => code === parsed.data.bankCode);
    if (!bank)
      return Response.json({ error: "Banco no autorizado" }, { status: 400 });
    const prisma = getPrisma();
    const account = await prisma.$transaction(async (transaction) => {
      if (parsed.data.isDefault)
        await transaction.bankAccount.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      return transaction.bankAccount.create({
        data: {
          tenantId,
          bankCode: bank[0],
          bankName: bank[1],
          accountType: parsed.data.accountType,
          accountLast4: parsed.data.accountNumber.slice(-4),
          accountCipher: encrypt(parsed.data.accountNumber),
          holderName: parsed.data.holderName,
          holderId: parsed.data.holderId,
          isDefault: parsed.data.isDefault,
        },
      });
    });
    return Response.json({ id: account.id }, { status: 201 });
  } catch (error) {
    return tenantError(error);
  }
}
