import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "../../../../../lib/prisma";
export async function POST(request:Request){const parsed=z.object({token:z.string().min(32),password:z.string().min(12).max(128)}).safeParse(await request.json());if(!parsed.success)return Response.json({error:"Solicitud inválida"},{status:400});const tokenHash=createHash("sha256").update(parsed.data.token).digest("hex");const record=await getPrisma().passwordResetToken.findUnique({where:{tokenHash}});if(!record||record.usedAt||record.expiresAt<new Date())return Response.json({error:"Token inválido"},{status:400});await getPrisma().$transaction([getPrisma().user.update({where:{id:record.userId},data:{passwordHash:await hash(parsed.data.password,12)}}),getPrisma().passwordResetToken.update({where:{id:record.id},data:{usedAt:new Date()}})]);return Response.json({ok:true});}
