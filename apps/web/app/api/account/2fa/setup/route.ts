import { TOTP } from "otpauth";
import { auth } from "../../../../../auth";
import { encryptSecret } from "../../../../../lib/secrets";
import { getPrisma } from "../../../../../lib/prisma";
export async function POST(){const session=await auth();if(!session?.user)return Response.json({error:"No autorizado"},{status:401});const totp=new TOTP({issuer:"TrajetixERP",label:session.user.email??session.user.id,algorithm:"SHA1",digits:6,period:30});await getPrisma().user.update({where:{id:session.user.id},data:{twoFactorSecret:encryptSecret(totp.secret.base32),twoFactorReady:false}});return Response.json({secret:totp.secret.base32,uri:totp.toString()});}
