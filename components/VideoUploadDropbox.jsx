"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { MAX_VIDEO_DURATION, MAX_VIDEO_SIZE } from "@/global/constants";
import { useRouter } from "next/navigation";

export default function VideoUploadDropbox() {
  const [currentFile, setCurrentFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  const router = useRouter();

  const validateFile = (file) => {
    // Check file type
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/gif")) {
      return { valid: false, error: "Only video files and GIFs are allowed" };
    }

    // Check file size (100MB)
    if (file.size > MAX_VIDEO_SIZE) {
      return { valid: false, error: "File size must be less than 100MB" };
    }

    return { valid: true };
  };

  const checkVideoProperties = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);

        resolve({duration: video.duration, height: video.videoHeight, width: video.videoWidth});
      };

      video.onerror = () => {
        reject(new Error("Could not load video metadata"));
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const createPreview = (file) => {
    return URL.createObjectURL(file);
  };

  const generateThumbnail = (file) => {
    try {
      console.log("asdasd");
      return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        
        video.preload = 'metadata';
        video.muted = true;
        video.crossOrigin = "anonymous";
        
        const videoUrl = URL.createObjectURL(file)
        video.src = videoUrl;
        
        video.addEventListener('loadedmetadata', () => {
          const seekTime = Math.min(1, video.duration/2)
          video.currentTime = seekTime;
        })

        video.addEventListener("seeked", () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else {
                reject("Thumbnail could not be created");
              }
              URL.revokeObjectURL(videoUrl);
            },
            "image/jpeg",
            0.8
          );

          console.log("asd");
        }),
          video.addEventListener("error", (err) => reject(err));
      });
    } catch (e) {
      console.log(e);
    }
  };

  const processFiles = async (fileList) => {
    if (fileList.length === 0) return;

    const file = fileList[0];
    const validation = validateFile(file);

    if (!validation.valid) {
      const errorFile = {
        file,
        id: Math.random().toString(36).substring(2, 9),
        progress: 0,
        status: "error",
        error: validation.error,
      };
      setCurrentFile(errorFile);
      setShowPreview(true);
      return;
    }

    try {
      const {duration, height, width} = await checkVideoProperties(file);

      if (duration > MAX_VIDEO_DURATION) {
        const errorFile = {
          file,
          id: Math.random().toString(36).substr(2, 9),
          progress: 0,
          status: "error",
          error: "Video duration must be 10 seconds or less",
        };
        setCurrentFile(errorFile);
        setShowPreview(true);
        return;
      }

      const thumbnailBlob = await generateThumbnail(file);

      const newFile = {
        file,
        thumbnailBlob,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: "pending",
        preview: createPreview(file),
        duration,
      };

      setCurrentFile(newFile);
      setShowPreview(true);

      setTimeout(() => uploadToS3(newFile), 100);
    } catch (error) {
      const errorFile = {
        file,
        id: Math.random().toString(36).substring(2, 9),
        progress: 0,
        status: "error",
        error: "Could not process video file"+error.message,
      };
      setCurrentFile(errorFile);
      setShowPreview(true);
    }
  };

  const uploadToS3 = async (uploadFile) => {
    setCurrentFile((prev) => (prev ? { ...prev, status: "uploading" } : null));

    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setCurrentFile((prev) => (prev ? { ...prev, progress } : null));
    }

    setCurrentFile((prev) =>
      prev ? { ...prev, status: "success", progress: 100 } : null
    );
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  }, []);

  const handleFileSelect = (file) => {
    e.preventDefault();
    const selectedFiles = file.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  const formatDuration = (seconds) => {
    return `${seconds.toFixed(1)}s`;
  };

  const handleClose = () => {
    if (currentFile?.preview) {
      URL.revokeObjectURL(currentFile.preview);
    }
    setCurrentFile(null);
    setShowPreview(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!currentFile?.file) {
      toast.error("Please select a video file first");
      return;
    }

    setCurrentFile((prev) => ({ ...prev, status: "uploading" }));

    try {
      const form = new FormData();
      form.append("video", currentFile.file);
      form.append("duration", currentFile.duration);
      form.append("height", currentFile.height);
      form.append("width", currentFile.width);
      form.append("size", currentFile.size);
      form.append("thumbnailBlob", currentFile.thumbnailBlob);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setCurrentFile((prev) => ({ ...prev, progress }));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            setCurrentFile((prev) => ({
              ...prev,
              status: "success",
              progress: 100,
            }));
            resolve(result);

            router.push("/videos");
          } else {
            reject(new Error("Upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        xhr.open("POST", "/api/upload-video");
        xhr.send(form);
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error: " + error.message);
      setCurrentFile((prev) => ({ ...prev, status: "failed" }));
      alert(`Upload failed: ${error.message}`);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {showPreview && currentFile ? (
        <Card className="border-2 border-primary">
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Video Preview
                </h3>
                <p className="text-muted-foreground">{currentFile.file.name}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="mb-6">
              <div className="w-full max-w-xs mx-auto bg-secondary rounded-lg overflow-hidden">
                {currentFile.preview &&
                  (currentFile.file.type.startsWith("video/") ? (
                    <video
                      src={currentFile.preview}
                      className="w-full h-auto"
                      controls
                      muted
                    />
                  ) : (
                    <img
                      src={currentFile.preview || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full h-auto"
                    />
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-6">
              <span>{formatFileSize(currentFile.file.size)}</span>
              {currentFile.duration && (
                <span>{formatDuration(currentFile.duration)}</span>
              )}
              <span className="capitalize">{currentFile.file.type}</span>
            </div>

            <div className="text-center space-y-4">
              {currentFile?.status === "uploading" && (
                <div className="max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">
                      Processing... {currentFile.progress}%
                    </span>
                  </div>
                  <Progress value={currentFile.progress} className="h-2" />
                </div>
              )}

              {
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span>Video processed successfully</span>
                  </div>
                  <Button
                    onClick={handleUpload}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8"
                  >
                    Upload to S3
                  </Button>
                </div>
              }

              {currentFile?.status === "error" && (
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span>{currentFile.error}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-2 border-primary">
          <div
            className={cn(
              "relative p-12 text-center transition-colors duration-200",
              isDragOver ? "bg-secondary" : "bg-card"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.gif"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-secondary rounded-lg flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Drag & Drop a file here
                </h3>
                <p className="text-muted-foreground mb-4">
                  Upload videos and GIFs up to 10 seconds and 100MB
                </p>
              </div>

              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium px-8"
              >
                Upload file
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
