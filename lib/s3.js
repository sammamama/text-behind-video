import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import uuid4 from "uuid4";

export async function getPresignedUrl(userId) {
  const uniqueId = uuid4();
  const randomSubstring = Math.random().toString(36).substring(2, 8);

  const s3Client = new S3Client({
    credentials: {
      accessKeyId: process.env.PRESIGNED_ACCESS_KEY,
      secretAccessKey: process.env.PRESIGNED_SECRET_KEY,
    },
    region: "ap-southeast-2",
  }); 

  const videoPresign = new PutObjectCommand({
    Bucket: "text-behind-video",
    Key: `${userId}/${randomSubstring}/${uniqueId}`,
  });

  const thumnailPresign = new PutObjectCommand({
    Bucket: "text-behind-video",
    Key: `${userId}/${randomSubstring}/${uniqueId}/thumbnail.jpg`,
    ContentType: 'image/jpeg'
  })

  const videoPresignedUrl = await getSignedUrl(s3Client, videoPresign, {
    expiresIn: 3600,
  });

  const thumbnailPresignedUrl = await getSignedUrl(s3Client, thumnailPresign, {
    expiresIn: 3600,
  });
  
  return NextResponse.json({videoPresignedUrl, thumbnailPresignedUrl})
}

export async function getVideoPresignedUrl(userId){
  const uniqueId = uuid4();
  const randomSubstring = Math.random().toString(36).substring(2, 8);

  const s3Client = new S3Client({
    credentials: {
      accessKeyId: process.env.PRESIGNED_ACCESS_KEY,
      secretAccessKey: process.env.PRESIGNED_SECRET_KEY,
    },
    region: "ap-southeast-2",
  }); 

  const videoPresign = new PutObjectCommand({
    Bucket: "text-behind-video",
    Key: `${userId}/${randomSubstring}/${uniqueId}`,
  });

  const videoPresignedUrl = await getSignedUrl(s3Client, videoPresign, {
    expiresIn: 3600,
  })

  return NextResponse.json({videoPresignedUrl})
}