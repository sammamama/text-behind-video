import { requireAuth } from "@/lib/auth-helper";
import { getVideoById } from "@/lib/videos-db";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET(req, {params}){
    const auth = await requireAuth();

    if(!auth){
        redirect('/api/auth/signin')
    }
    
    const {videoId} = await params;

    const videoResponse =  await getVideoById({userId: auth.userId, videoId});

    if(!videoResponse){
        return NextResponse({
            message: "Video not found"
        }, {status: 400})
    }

    return NextResponse.json(videoResponse)
}