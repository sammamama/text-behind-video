import { writeFile } from "fs/promises";

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";

import Replicate from "replicate";

export async function GET(){
  const response = await fetch("https://replicate.delivery/xezq/wQdLAM1wTjLdOxUpKdoPIR3Ho0iP28LwlSRnMzMTpWNQjZXF/green-screen.mp4");

  console.log(response);

  return new NextResponse(JSON.stringify(response))

}

export async function POST(req) {
  const auth = await requireAuth();

  if (!auth.authorized)
    return NextResponse.json(
      {
        message: "User is not authorized",
      },
      { status: 401 }
    );

  const { videoId, s3Url } = await req.json();

  if (!videoId || !s3Url)
    return NextResponse.json(
      { message: "User ID and S3 URL are required" },
      { status: 400 }
    );

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      userId: auth.userId,
    },
  });

  if (!video)
    return NextResponse.json(
      { message: "Video cannot be found" },
      { status: 404 }
    );

  if (video.status !== "READY")
    return NextResponse.json(
      { message: "Video should be successfully uploaded first" },
      { status: 400 }
    );
9
  const videoPath = s3Url.split(".amazonaws.com/")[1];

  if (!videoPath)
    return NextResponse.json({ message: "Invalid S3 path" }, { status: 400 });

  const cloudfrontUrl = process.env.CLOUDFRONT_URL + "/" + videoPath;

  const replicate = new Replicate();

  const input = {
    input_video: cloudfrontUrl,
  };

  const bgVideo = await prisma.video.upsert({
    where: {id: videoId},
    data: {
      noBgStatus: "PROCESSING"
    }
  })

  const output = await replicate.run(
    "arielreplicate/robust_video_matting:73d2128a371922d5d1abf0712a1d974be0e4e2358cc1218e4e34714767232bac",
    { input }
  );

  if(!output){
    await prisma.video.upsert({
      where: {id: videoId},
      data: {
        noBgStatus: "FAILED"
      }
    })
  }

  await prisma.video.upsert({
    where: {id: videoId}
  })

  // To access the file URL:
  console.log(output.url());
  //=> "https://replicate.delivery/.../output.mp4"

  // To write the file to disk:
  await writeFile("output.mp4", output);
  //=> output.mp4 written to disk
}
