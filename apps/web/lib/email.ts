export async function sendTransactionalEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY no está configurada");
    console.info(`[email preview] ${subject} -> ${to}`);
    return { id: "development-preview" };
  }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM ?? "TrajetixERP <onboarding@resend.dev>", to, subject, html }) });
  if (!response.ok) throw new Error("No se pudo enviar el correo");
  return response.json() as Promise<{ id: string }>;
}

export function emailLayout(title: string, copy: string, action: string, url: string) {
  return `<div style="background:#0b0b0b;padding:40px;font-family:Arial;color:#f5f5f5"><div style="max-width:560px;margin:auto;background:#171717;border:1px solid #2b2b2b;border-radius:14px;padding:32px"><h1 style="font-size:24px">${title}</h1><p style="color:#aaa;line-height:1.6">${copy}</p><a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 18px;background:#ed1822;color:white;text-decoration:none;border-radius:8px;font-weight:bold">${action}</a><p style="color:#666;font-size:12px;margin-top:24px">Este enlace caduca automáticamente. Si no solicitaste esta acción, ignora el mensaje.</p></div></div>`;
}
