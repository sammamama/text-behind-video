"use client"

import { useSession } from "next-auth/react";
import Image from "next/image";

export default function Home() {
  const {data: session, status} = useSession();

  if(status === "loading"){ return (<p>Loading</p>)}

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    

    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);

    // Create FormData to send the file
    const formData = new FormData();
    formData.append('video', file);


    try {
      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        // Handle success (e.g., show success message, update UI)
      } else {
        console.error('Upload failed:', response.statusText);
        // Handle error (e.g., show error message)
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      // Handle network error
    }
  };

  return (
    <div className="">
      <input 
        type="file" 
        name="video" 
        accept="video/mp4*"
        onChange={handleFileUpload}
      />
    </div>
  );
}