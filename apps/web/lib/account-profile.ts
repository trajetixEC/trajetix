import { z } from "zod";

export const appearanceValues = ["LIGHT", "DARK", "SYSTEM"] as const;
export type Appearance = (typeof appearanceValues)[number];

export const profileUpdateInput = z.object({
  action: z.literal("profile"),
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().max(40),
  identificationType: z.string().trim().max(30),
  identificationNumber: z.string().trim().max(30),
  company: z
    .object({
      displayName: z.string().trim().min(2).max(120),
      legalName: z.string().trim().min(2).max(200),
      phone: z.string().trim().max(40),
      email: z.string().trim().email().max(320).or(z.literal("")),
      address: z.string().trim().max(300),
    })
    .optional(),
  billing: z
    .object({
      identificationType: z.string().trim().max(30),
      identificationNumber: z.string().trim().max(30),
      legalName: z.string().trim().max(200),
      fiscalAddress: z.string().trim().max(300),
      phone: z.string().trim().max(40),
      email: z.string().trim().email().max(320).or(z.literal("")),
    })
    .optional(),
});

export const appearanceInput = z.object({
  action: z.literal("appearance"),
  appearance: z.enum(appearanceValues),
});

export const passwordUpdateInput = z
  .object({
    action: z.literal("password"),
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Las contraseñas nuevas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "La nueva contraseña debe ser diferente",
    path: ["newPassword"],
  });

export function formatUserId(id: string) {
  return `TJX-${id.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
