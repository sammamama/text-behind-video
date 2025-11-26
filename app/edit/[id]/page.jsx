"use client";

import React, { useEffect, useRef, useState } from "react";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Download, PlusCircleIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_COLOR,
  DEFAULT_TEXT,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from "@/global/constants";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Slider } from "@/components/ui/slider";
import { HexColorPicker } from "react-colorful";
import { toast } from "sonner";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const page = ({ params }) => {
  const { id: videoId } = React.use(params);
  const [video, setVideo] = useState();

  const [texts, setTexts] = useState([]);

  const presets = [
    "#FFFFFF",
    "#000000",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
  ];

  const [pickerOpen, setPickerOpen] = useState({ id: 1, open: false });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickerRef = useRef();

  const bgVideoRef = useRef();
  const fgVideoRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        document.addEventListener(
          "mousedown",
          setPickerOpen((prev) => [prev, { open: false }])
        );
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  });

  const addText = () => {
    setTexts((prev) => [
      ...prev,
      {
        text: DEFAULT_TEXT,
        color: DEFAULT_COLOR,
        size: 128,
        x: 50,
        y: 50,
      },
    ]);
  };

  const updatePosition = (i, value, position) => {
    setTexts((prev) => {
      let newValue = value;

      // Parse to number and apply max limit only for size
      if (position === "size") {
        newValue = Number(value);
        newValue > MAX_FONT_SIZE
          ? (newValue = MAX_FONT_SIZE)
          : newValue < MIN_FONT_SIZE
          ? (newValue = MIN_FONT_SIZE)
          : null;
      }

      const updated = [...prev];
      updated[i] = { ...updated[i], [position]: newValue };

      return updated;
    });
  };

const downloadVideo = async () => {
  console.log("Download started");
  setIsProcessing(true);
  setProgress(0);

  try {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const bgVideo = bgVideoRef.current;
    const fgVideo = fgVideoRef.current;

    if (!canvas || !ctx || !bgVideo || !fgVideo) {
      console.error("Missing required elements");
      return;
    }

    // Pause display videos
    bgVideo.pause();
    fgVideo.pause();

    // Create download video elements
    const downloadBgVideo = document.createElement("video");
    const downloadFgVideo = document.createElement("video");

    downloadBgVideo.crossOrigin = "anonymous";
    downloadFgVideo.crossOrigin = "anonymous";
    downloadBgVideo.src = bgVideo.src;
    downloadFgVideo.src = fgVideo.src;
    downloadBgVideo.muted = true;
    downloadFgVideo.muted = true;
    downloadBgVideo.playsInline = true;
    downloadFgVideo.playsInline = true;

    // Set canvas to high resolution
    canvas.width = 1080;
    canvas.height = 1920;

    console.log("Loading videos for download...");

    const waitForVideo = (video, name) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`${name} loading timeout`));
        }, 15000);

        const onCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          console.log(`${name} loaded`);
          resolve();
        };

        const onError = (e) => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          console.error(`${name} error:`, e);
          reject(new Error(`${name} failed to load`));
        };

        if (video.readyState >= 3) {
          clearTimeout(timeout);
          resolve();
        } else {
          video.addEventListener("canplay", onCanPlay, { once: true });
          video.addEventListener("error", onError, { once: true });
          video.load();
        }
      });
    };

    try {
      await Promise.all([
        waitForVideo(downloadBgVideo, "BG video"),
        waitForVideo(downloadFgVideo, "FG video"),
      ]);
    } catch (corsError) {
      console.warn("CORS error, retrying without crossOrigin:", corsError);
      downloadBgVideo.removeAttribute("crossOrigin");
      downloadFgVideo.removeAttribute("crossOrigin");
      downloadBgVideo.src = bgVideo.src;
      downloadFgVideo.src = fgVideo.src;

      await Promise.all([
        waitForVideo(downloadBgVideo, "BG video (no CORS)"),
        waitForVideo(downloadFgVideo, "FG video (no CORS)"),
      ]);
    }

    // SYNC FIX: Synchronize playback rates and start times
    downloadBgVideo.currentTime = 0;
    downloadFgVideo.currentTime = 0;
    
    // Force same playback rate
    downloadBgVideo.playbackRate = 1.0;
    downloadFgVideo.playbackRate = 1.0;

    console.log("Videos loaded, creating stream...");

    const stream = canvas.captureStream(30);

    let mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 8000000,
    });

    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      console.log("Recording stopped, chunks:", chunks.length);
      const blob = new Blob(chunks, { type: "video/webm" });
      console.log("Blob created, size:", blob.size);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "composite-video.webm";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 100);

      // Resume display videos
      bgVideo.currentTime = 0;
      fgVideo.currentTime = 0;
      setTimeout(() => {
        bgVideo.play().catch(() => {});
        fgVideo.play().catch(() => {});
      }, 100);

      setIsProcessing(false);
      console.log("Download complete");
    };

    console.log("Starting recording...");
    
    // Start recording BEFORE playing videos
    mediaRecorder.start(100);
    
    // Small delay to ensure recorder is ready
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Start both videos at the exact same time
    const playPromises = [
      downloadBgVideo.play(),
      downloadFgVideo.play()
    ];
    
    await Promise.all(playPromises);
    
    console.log("Videos playing");

    const videoDuration = Math.min(downloadBgVideo.duration, downloadFgVideo.duration);
    let lastSync = 0;

    const render = () => {
      const currentTime = downloadBgVideo.currentTime;
      
      // Re-sync every 0.5 seconds if drift detected
      if (currentTime - lastSync > 0.5) {
        const drift = Math.abs(downloadBgVideo.currentTime - downloadFgVideo.currentTime);
        if (drift > 0.05) {
          console.log(`Drift detected: ${drift.toFixed(3)}s - resyncing`);
          downloadFgVideo.currentTime = downloadBgVideo.currentTime;
        }
        lastSync = currentTime;
      }

      if (downloadBgVideo.ended || downloadFgVideo.ended || currentTime >= videoDuration) {
        console.log("Video ended, stopping recording");
        mediaRecorder.stop();
        downloadBgVideo.pause();
        downloadFgVideo.pause();
        return;
      }

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(downloadBgVideo, 0, 0, canvas.width, canvas.height);

        texts.forEach((txt) => {
          const scaleFactor = canvas.width / 320;
          const fontSize = (parseInt(txt.size) || 24) * scaleFactor;
          ctx.font = `${fontSize}px Arial`;
          ctx.fillStyle = txt.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            txt.text,
            (txt.x / 100) * canvas.width,
            (txt.y / 100) * canvas.height
          );
        });

        ctx.drawImage(downloadFgVideo, 0, 0, canvas.width, canvas.height);
      } catch (drawError) {
        console.error("Canvas draw error:", drawError);
        mediaRecorder.stop();
        return;
      }

      requestAnimationFrame(render);
    };

    render();

  } catch (error) {
    console.error("Error in downloadVideo:", error);
    alert(
      "Error creating video: " +
        error.message +
        "\n\nThis may be due to CORS restrictions on the video files."
    );
    setIsProcessing(false);
  }
};

  const PROXY_PREFIX = "/api/proxy-video?url=";

  const getProxiedUrl = (originalUrl) => {
    return `${PROXY_PREFIX}${encodeURIComponent(originalUrl)}`;
  };

  // Original URLs
  const BG_VIDEO_URL =
    "https://d2ym0mcwdtattp.cloudfront.net/1/tlli0t/daa9c8cb-5874-4b59-a18b-cfdfc6819965";
  const FG_VIDEO_URL =
    "https://d2ym0mcwdtattp.cloudfront.net/1/v06vgk/ac850bb9-0d95-4357-b86e-65e6dc4fbe84";

  const removeText = (index) => {
    setTexts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full text-sm">
      <canvas ref={canvasRef} className="hidden"></canvas>
      <div className="xl:p-20 py-20 lg:mx-20">
        <div className="flex flex-col lg:items-start justify-center items-center lg:flex-row lg:gap-5 gap-2 w-full overflow-hidden">
          <div className="overflow-hidden min-w-fit">
            <div className="relative flex flex-row w-[320px] h-[640px] bg-neutral-200 items-center justify-center rounded-lg overflow-hidden">
              <video
                ref={bgVideoRef}
                src={getProxiedUrl(BG_VIDEO_URL)}
                className="absolute inset-0 w-full h-full z-10 aspect-video"
              />

              <div className="z-20">
                {texts.map((txt, i) => (
                  <div
                    className={`absolute`}
                    key={i}
                    style={{
                      fontSize: `${txt.size}px`,
                      transform: "translate(-50%, -50%)",
                      color: txt.color,
                      top: `${txt.y}%`,
                      left: `${txt.x}%`,
                    }}
                  >
                    {txt.text}
                  </div>
                ))}
              </div>

              <video
                ref={fgVideoRef}
                src={getProxiedUrl(FG_VIDEO_URL)}
                className="absolute top-0 left-0 z-50 h-full w-full object-fit"
              />
            </div>
            <button onClick={downloadVideo}>
              <Download />
            </button>
          </div>

          {/* RHS */}
          <div className="lg:max-w-full 650px] w-full max-h-[85vh] flex lg:justify-start lg:items-start justify-center items-center text-white overflow-hidden">
            <div className="w-full h-full border border-neutral-400 overflow-y-scroll no-scrollbar rounded-xl p-5">
              {texts.map((txt, i) => (
                <div
                  className="flex flex-col text-black bg-neutral-50 gap-5 px-8 py-4 my-2 rounded-lg"
                  key={i}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-lg">Text {i + 1}</div>
                    <Trash2Icon
                      onClick={() => {
                        removeText(i);
                      }}
                      size={30}
                      className="bg-red-400 cursor-pointer rounded-md p-1 text-neutral-200"
                    />
                  </div>
                  <InputGroup className={"text-primary"}>
                    <InputGroupInput
                      placeholder={DEFAULT_TEXT}
                      onChange={(e) => {
                        setTexts((prev) => {
                          const updated = [...prev];
                          updated[i].text = e.target.value;
                          return updated;
                        });
                      }}
                    />
                  </InputGroup>

                  <div className="">
                    <div className="text-base font-medium">Font Size</div>
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-11">
                        <div className="px-3 py-1 justify-center">Size</div>
                        <Slider
                          className={""}
                          onValueChange={([newValue]) => {
                            updatePosition(i, newValue, "size");
                          }}
                          value={[txt.size]}
                          max={MAX_FONT_SIZE}
                          min={MIN_FONT_SIZE}
                        />
                      </div>
                      <div className="">
                        <InputGroup>
                          <InputGroupInput
                            value={txt.size}
                            onChange={(e) => {
                              console.log(e.target.value);
                              updatePosition(i, e.target.value, "size");
                            }}
                          ></InputGroupInput>
                        </InputGroup>
                      </div>
                    </div>
                  </div>

                  <div className="">
                    <div className="font-medium text-base">Font Color</div>
                    <div className="flex justify- w-full items-center">
                      <div
                        className={`w-12 h-8 relative cursor-pointer`}
                        onClick={() => {
                          setPickerOpen({ id: i, open: true });
                        }}
                        style={{ backgroundColor: txt.color }}
                      >
                        {pickerOpen.id === i && pickerOpen.open && (
                          <div
                            ref={pickerRef}
                            className="max-w-[200px] bg-neutral-300 rounded-lg absolute top-[100%] left-[100%] z-50"
                          >
                            <HexColorPicker
                              color={txt.color}
                              onChange={(e) => {
                                setTexts((prev) => {
                                  const updated = [...prev];
                                  updated[i].color = e;
                                  return updated;
                                });
                              }}
                            />
                            <div className="p-3">
                              <div className="grid grid-cols-5 gap-2">
                                {presets.map((preset) => (
                                  <button
                                    key={preset}
                                    onClick={() => {
                                      setTexts((prev) => {
                                        const updated = [...prev];
                                        updated[i].color = preset;

                                        return updated;
                                      });
                                    }}
                                    className={`w-6 h-6 rounded-md hover:scale-110 cursor-pointer transition-transform`}
                                    style={{ backgroundColor: preset }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pl-3">
                        <InputGroup>
                          <InputGroupInput
                            value={txt.color}
                            className={"w-full bg-neutral-100"}
                            onChange={(e) => {
                              console.log(e.target.value);
                            }}
                          ></InputGroupInput>
                        </InputGroup>
                      </div>
                    </div>
                  </div>

                  {/* postition */}
                  <div className="font-medium text-base">Position</div>
                  <div className="flex gap-5 items-center justify-between">
                    <div className="w-full">
                      <div className="px-3 py-1 justify-center">
                        X axis (horizontal)
                      </div>
                      <Slider
                        className={""}
                        onValueChange={([newValue]) => {
                          updatePosition(i, newValue, "x");
                        }}
                        defaultValue={[txt.x]}
                        max={130}
                        min={-30}
                      />
                    </div>

                    <div className="w-full">
                      <div className="px-3 py-1 justify-center">
                        Y axis (vertical)
                      </div>
                      <Slider
                        className={"w"}
                        onValueChange={([newValue]) => {
                          updatePosition(i, newValue, "y");
                        }}
                        defaultValue={[txt.y]}
                        max={130}
                        min={-30}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="primary"
                className="flex cursor-pointer items-center justify-center bg-neutral-800 hover:bg-neutral-900 transition-all text-neutral-100 w-full"
                onClick={addText}
              >
                <PlusCircleIcon className="mr-1" height={20} width={20} />
                <div>add text</div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;