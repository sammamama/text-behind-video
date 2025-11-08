"use client";

import React, { useEffect, useState } from "react";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const page = ({ params }) => {

  const { id: videoId } = React.use(params);
  const [video, setVideo] = useState();

  useEffect(() => {
    async function loadVideo() {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "GET",
      });

      const data = await res.json();
      console.log('data',data)

      setVideo(data);

      return;
    }

    loadVideo();
  }, []);

  const router = useRouter();

  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="w-full h-screen justify-center items-center">
        Loading...
      </div>
    );
  }

  if (!session) {
    router.push("/api/auth/signin");
  }

  console.log('video',video);

  if(!video) return <p>loading</p>

  return <div className="relative bg-black h-full w-full">

    <video src={video.videos.noBgUrl} className="absolute top-0 left-0 z-50 w-fit" ></video>
    <div className="text-[180px] text-red-500 z-20 absolute top-70 left-0">samridh</div>
    <video src={video.videos.url} className="absolute top-0 left-0 z-10"></video>
  </div>;
};

export default page;
