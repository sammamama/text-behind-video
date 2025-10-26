import { getPresignedUrl, getVideoPresignedUrl } from "@/lib/s3";

export async function downloadVideo(replicateUrl) {
  const maxTries = 3;
  let lastError;

  for (let i = 1; i <= maxTries; i++) {
    try {
      console.log(`Download attempt ${i}/${maxTries}`);
      const response = await fetch(replicateUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log(`Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
      return buffer; // Return buffer, not NextResponse
      
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i} failed:`, error.message);
      
      // Only wait if not the last attempt
      if (i < maxTries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // All retries failed
  throw new Error(`Failed to download after ${maxTries} attempts: ${lastError.message}`);
}

export async function uploadToS3(videoBuffer, userId) {
  // Get presigned URL (this returns NextResponse)
  const presignedResponse = await getVideoPresignedUrl(userId);
  const presignedData = await presignedResponse.json();
  const presignedUrl = presignedData.videoPresignedUrl;

  if (!presignedUrl) {
    throw new Error("Failed to get presigned URL");
  }

  // Extract S3 URL before query params
  const s3ObjectUrl = presignedUrl.split("?")[0];

  // Upload to S3
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    body: videoBuffer,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": videoBuffer.byteLength.toString(),
    },
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`S3 upload failed: ${errorText}`);
  }

  // Build CloudFront URL
  const videoPath = s3ObjectUrl.split(".amazonaws.com/")[1];
  const cloudfrontUrl = `${process.env.CLOUDFRONT_URL}/${videoPath}`;

  console.log(`Uploaded to S3: ${cloudfrontUrl}`);

  return {
    cloudfrontUrl: cloudfrontUrl
  };
}

export async function transferVideoToS3(replicateUrl, userId) {
  try {
    console.log("Starting video transfer...");
    
    // Download from Replicate
    const videoBuffer = await downloadVideo(replicateUrl);
    
    // Upload to S3
    const { cloudfrontUrl } = await uploadToS3(videoBuffer, userId);
    
    return {
      success: true,
      cloudfrontUrl: cloudfrontUrl
    };
  } catch (error) {
    console.error("Transfer failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}