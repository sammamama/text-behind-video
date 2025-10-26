import { requireAuth } from "@/lib/auth-helper";
import { getUserVideos } from "@/lib/videos-db";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAuth();

  if (!auth.authorized) {
    console.log("unauthorized");
    return auth.response;
  }

  const videosResponse = await getUserVideos(auth.userId);

  return NextResponse.json(videosResponse);
}
