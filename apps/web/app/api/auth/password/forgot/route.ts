export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../../../../../lib/prisma";
import { emailLayout, sendTransactionalEmail } from "../../../../../lib/email";
export async function POST(request:Request){const parsed=z.object({email:z.string().email()}).safeParse(await request.json());if(!parsed.success)return Response.json({ok:true});const email=parsed.data.email.toLowerCase();const user=await getPrisma().user.findUnique({where:{email}});if(user){const token=randomBytes(32).toString("base64url");await getPrisma().passwordResetToken.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+30*60*1000)}});const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;const url=`${base}/recuperar/${token}`;await sendTransactionalEmail({to:email,subject:"Recupera tu acceso a TrajetixERP",html:emailLayout("Recupera tu contraseña","Recibimos una solicitud para crear una nueva contraseña.","Crear nueva contraseña",url)});}return Response.json({ok:true});}
