"use client"

import VideoUploadDropbox from "@/components/VideoUploadDropbox"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation";

export default function Home() {
  const {data: session, status} = useSession();

  if(status === "loading"){return <p>Loading...</p>}

  if(!session) redirect('/api/auth/signin')

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4 text-balance">Upload Your Videos</h1>
          <p className="text-lg text-muted-foreground text-pretty">
            Upload videos and GIFs up to 10 seconds and 100MB. Your files will be securely stored and processed.
          </p>
        </div>

        <VideoUploadDropbox />
      </div>
    </main>
  )
}
