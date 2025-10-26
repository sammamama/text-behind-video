import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export async function getUserVideos(userId) {
  try {
    const videos = await prisma.video.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        url: true,
        noBgUrl: true,
        noBgStatus: true,
        duration: true,
        uploadDate: true,
      },
      orderBy: {
        uploadDate: "desc",
      },
    });

    return {
        sucess: true,
        videos,
      }
  } catch (e) {
    return {
        success: false,
        message: e.message,
      };
  }
}
