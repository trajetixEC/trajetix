import { TOTP } from "otpauth";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { decryptSecret } from "../../../../../lib/secrets";
import { getPrisma } from "../../../../../lib/prisma";
export async function POST(request:Request){const session=await auth();if(!session?.user)return Response.json({error:"No autorizado"},{status:401});const parsed=z.object({token:z.string().regex(/^\d{6}$/)}).safeParse(await request.json());if(!parsed.success)return Response.json({error:"Código inválido"},{status:400});const user=await getPrisma().user.findUnique({where:{id:session.user.id}});if(!user?.twoFactorSecret)return Response.json({error:"Configura 2FA primero"},{status:400});const totp=new TOTP({secret:decryptSecret(user.twoFactorSecret)});if(totp.validate({token:parsed.data.token,window:1})===null)return Response.json({error:"Código inválido"},{status:400});await getPrisma().user.update({where:{id:user.id},data:{twoFactorReady:true}});return Response.json({ok:true});}
