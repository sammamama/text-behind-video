import { requireAuth } from "@/lib/auth-helper";
import { getPresignedUrl } from "@/lib/s3";

export async function GET(){
    const auth = await requireAuth();

    if(!auth)return({message: "FU"});

    const presigned = await getPresignedUrl(auth.userId);

    const presignedurl = await presigned.json()

    const ps = presignedurl.presigned.split(".amazonaws.com/")[1];

    console.log(ps);

    return 
}