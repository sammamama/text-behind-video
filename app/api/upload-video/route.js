import { MAX_VIDEO_DURATION, MAX_VIDEO_SIZE } from "@/global/constants";
import { requireAuth } from "@/lib/auth-helper";

import { NextResponse } from "next/server";

import { replicate } from "@/lib/replicate";
import { transferVideoToS3 } from "@/lib/video-storage";
import { getPresignedUrl } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const auth = await requireAuth();

    if (!auth.authorized) {
      return auth.response;
    }

    const userId = auth.session.user.id;

    // Get form data
    const form = await req.formData();
    const duration = form.get("duration");
    const video = form.get("video");
    const thumbnailBlob = form.get("thumbnailBlob");

    if (!video) {
      return NextResponse.json(
        { message: "No video file provided" },
        { status: 400 }
      );
    }

    // Validate the length of the video
    if (duration > MAX_VIDEO_DURATION)
      return NextResponse.json(
        { message: `Video cannot be longer than ${MAX_VIDEO_DURATION}sec` },
        { status: 400 }
      );

    // Validate the video size
    if (video.size > MAX_VIDEO_SIZE)
      return NextResponse.json(
        {
          message: `Exceeded file size: File cannot be larger than ${
            MAX_VIDEO_SIZE / (1024 * 1024)
          }MB`,
        },
        { status: 400 }
      );

    // Get presigned URL to upload to S3
    const presignedResponse = await getPresignedUrl(auth.userId);

    const presignedJs = await presignedResponse.json();

    const videoPresignedUrl = presignedJs.videoPresignedUrl;
    const thumbnailPresignedUrl = presignedJs.thumbnailPresignedUrl;

    // Get the s3 url
    const s3VideotUrl = videoPresignedUrl.split("?")[0];
    const s3ThumbnailUrl = thumbnailPresignedUrl.split("?")[0];

    const videoPath = s3VideotUrl.split(".amazonaws.com/")[1];
    const thumbnailPath = s3ThumbnailUrl.split(".amazonaws.com/")[1];

    if (!videoPath)
      return NextResponse.json({ message: "Invalid S3 path" }, { status: 400 });

    const cloudfrontVideoUrl = process.env.CLOUDFRONT_URL + "/" + videoPath;
    const cloudfrontThumbnailUrl = process.env.CLOUDFRONT_URL + "/" + thumbnailPath;

    if (!videoPresignedUrl) {
      return NextResponse.json(
        { message: "Failed to create presigned url" },
        { status: 400 }
      );
    }

    if (!thumbnailPresignedUrl) {
      return NextResponse.json(
        { message: "Failed to create presigned url" },
        { status: 400 }
      );
    }

    // Populate video table in DB
    const videoRecord = await prisma.video.create({
      data: {
        userId: userId,
        url: cloudfrontVideoUrl,
        duration: duration,
        status: "PROCESSING",
      },
    });

    const videoBuffer = await video.arrayBuffer();

    // Upload video to S3 using presigned URL's
    const uploadVideo = await fetch(videoPresignedUrl, {
      method: "PUT",
      body: videoBuffer,
      duration: duration,
      headers: {
        Name: video.name || "",
        "Content-Type": video.type,
        "Content-Length": video.size,
      },
    });

    if (!uploadVideo.ok) {
      const errorText = await uploadVideo.text();
      console.error("S3 upload error:", errorText);

      await prisma.video.update({
        where: { id: videoRecord.id },
        data: {
          status: "FAILED",
        },
      });

      return NextResponse.json(
        {
          message: "Video upload failed",
          error: errorText,
        },
        { status: 500 }
      );
    }

    const uploadThumbnail = await fetch(thumbnailPresignedUrl, {
      method: "PUT",
      body: thumbnailBlob,
    });

    if (!uploadThumbnail.ok) {
      const errorText = await uploadThumbnail.text();
      console.error("S3 upload error:", errorText);
      return NextResponse.json(
        {
          message: "Thumbnail upload failed",
          error: errorText,
        },
        { status: 500 }
      );
    }

    await prisma.video.update({
      where: { id: videoRecord.id },
      data: {
        status: "READY",
        thumbnailUrl: cloudfrontThumbnailUrl
      },
    });

    const bgVideo = await prisma.video.update({
      where: { id: videoRecord.id },
      data: {
        noBgStatus: "PROCESSING",
      },
    });

    const input = {
      input_video: `${process.env.CLOUDFRONT_URL}/${videoPath}`,
    };

    const prediction = await replicate.predictions.create({
      version:
        "73d2128a371922d5d1abf0712a1d974be0e4e2358cc1218e4e34714767232bac",
      input: input,
      // webhook: webhookUrl,
      // webhook_events_filter: ["completed", "failed"],
    });

    if (!prediction) {
      await prisma.video.update({
        where: { id: 11 },
        data: {
          noBgStatus: "FAILED",
        },
      });
    }

    // Poll for completion (max 5 minutes)
    const maxAttempts = 100; // 100 * 3 seconds = 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Wait 3 seconds between checks
      await new Promise((resolve) => setTimeout(resolve, 3000));
      attempts++;

      // Get latest prediction status
      const currentPrediction = await replicate.predictions.get(prediction.id);

      console.log(`Attempt ${attempts}: Status = ${currentPrediction.status}`);
      console.log("Prediction:", currentPrediction);

      if (currentPrediction.status === "succeeded") {
        // Extract output URL
        let outputUrl;

        if (typeof currentPrediction.output === "string") {
          outputUrl = currentPrediction.output;
        } else if (currentPrediction.output && currentPrediction.output.url) {
          outputUrl = currentPrediction.output.url;
        } else if (
          Array.isArray(currentPrediction.output) &&
          currentPrediction.output.length > 0
        ) {
          outputUrl =
            typeof currentPrediction.output[0] === "string"
              ? currentPrediction.output[0]
              : currentPrediction.output[0]?.url;
        }

        if (!outputUrl) {
          throw new Error("No output URL in prediction result");
        }

        console.log("Processing completed successfully");

        const { cloudfrontUrl, success, error } = await transferVideoToS3(
          outputUrl,
          auth.userId
        );

        if (!success) {
          await prisma.video.update({
            where: {id: videoRecord.id},
            data: {
              noBgStatus: "FAILED"
            }
          })

          throw new Error(`S3 transfer failed ${error}`);
        }

        // Update database with completed status
        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            noBgStatus: "COMPLETED",
            noBgUrl: cloudfrontUrl,
          },
        });

        return NextResponse.json({
          success: true,
          status: "COMPLETED",
          noBgUrl: cloudfrontUrl,
          videoId: videoRecord.id,
          message: "Background removed successfully",
        });
      } else if (
        prediction.status === "failed" ||
        prediction.status === "canceled"
      ) {
        // Update database with failed status
        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            noBgStatus: "FAILED",
          }
        });

        console.error("Processing failed:", prediction.error);

        return NextResponse.json(
          {
            success: false,
            status: "FAILED",
            error: prediction.error || `Processing ${prediction.status}`,
          },
          { status: 500 }
        );
      }
      // If status is "starting" or "processing", continue polling
    }

    // Timeout - took too long
    await prisma.video.update({
      where: { id: videoRecord.id },
      data: {
        bgRemovalStatus: "FAILED",
        bgRemovalError: "Processing timeout after 5 minutes",
      },
    });

    return NextResponse.json(
      {
        success: false,
        status: "FAILED",
        error: "Processing timeout",
      },
      { status: 408 }
    );
  } catch (error) {
    console.error("Error:", error);
  }
  
  return NextResponse.json(
    {
      message: "Successfully uploaded",
    },
    { status: 200 }
  );
}
