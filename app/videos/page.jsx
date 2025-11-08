"use client";

import { CirclePlay } from "lucide-react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

function VideoCard({ video, index }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef(null);

  const handleLoadedMetadata = (e) => {
    const videoEl = e.target;

    // Immediately show the frame if possible
    if (videoEl.readyState >= 2) {
      setIsLoaded(true);
    }

    // Try to seek to a frame for thumbnail display
    if (videoEl.duration > 0.5) {
      videoEl.currentTime = 0.5;
    } else {
      videoEl.currentTime = 0;
    }
  };

  const handleSeeked = (e) => {
    const videoEl = e.target;
    if (videoEl.readyState >= 2) {
      setIsLoaded(true);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current && isLoaded) {
      videoRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.duration > 0.5) {
        videoRef.current.currentTime = 0.5;
      } else {
        video.current.currentTime = 0;
      }
    }
  };

  function handleClick(){
    if(video.noBgStatus === 'FAILED' ){
      toast.error("Failed", {description: "Video processing failed. Credits won't be charged"})
    }

    if(video.noBgStatus === 'PROCESSING' || video.noBgStatus === 'NOT_STARTED'){
      toast.warning("Processing", {description: "Video is processing. Please wait till completion"})
    }

    if(video.noBgStatus === 'COMPLETED'){
      redirect(`/edit/${video.id}`);
    }
  }

  return (
    <div
      className="cursor-pointer"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Container */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900 border border-gray-700 hover:border-blue-500 transition-colors">
        {/* Loading indicator */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-white text-sm">Loading...</div>
          </div>
        )}

        {/* Video Element */}
        {
          <div
            className={`flex items-end justify-end px-3 absolute top-0 right-0 ${
              video.noBgStatus === "FAILED"
                ? "bg-red-500/60"
                : video.noBgStatus === "PROCESSING"
                ? "bg-yellow-500/60"
                : video.noBgStatus === "COMPLETED"
                ? "bg-green-500/60"
                : "bg-neutral-400/60"
            } text-white`}
          >
            {video.noBgStatus}
          </div>
        }
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-cover"
          preload="auto"
          muted
          playsInline
          loop
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
        />

        {/* Duration Badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {parseFloat(video.duration).toFixed(1)}s
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="mt-2">
        <p className="text-white text-sm">Video #{video.id}</p>
        {video.createdAt && (
          <p className="text-gray-500 text-xs">
            {new Date(video.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

export default function VideosPage() {
  const { data: session, status } = useSession();
  const [userVideos, setUserVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      async function fetchVideos() {
        try {
          const res = await fetch("/api/videos", {
            method: "GET",
          });

          const data = await res.json();
          console.log("videos", data);
          setUserVideos(data.videos || []);
        } catch (error) {
          console.error("Error fetching videos:", error);
          setUserVideos([]);
        } finally {
          setIsLoading(false);
        }
      }

      fetchVideos();
    }
  }, [status]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Videos</h1>
          <p className="text-gray-400">
            {userVideos.length} {userVideos.length === 1 ? "video" : "videos"}
          </p>
        </div>

        {/* Videos Grid */}
        {userVideos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No videos uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {userVideos.map((video) => (
              <VideoCard key={video.id} video={video} index={video.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
