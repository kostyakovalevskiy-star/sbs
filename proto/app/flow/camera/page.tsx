"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Upload, X, Zap } from "lucide-react";
import type { DraftState } from "@/types";
import {
  startCamera,
  stopCamera,
  captureAndProcess,
  processFileToPhoto,
  getBrightness,
  captureSnapshot,
} from "@/lib/camera";

const BLUR_BLOCK = 10;   // only block completely solid/black frames
const BLUR_WARN  = 40;   // warn but allow
const MAX_PHOTOS = 10;

interface PhotoItem {
  base64: string;
  variance: number;
}

export default function CameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(128);
  const [tilt, setTilt] = useState<number | null>(null);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Load saved photos from draft
  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const draft = JSON.parse(raw) as DraftState;
      if (draft.photos?.length) {
        setPhotos(draft.photos.map((p) => ({ base64: p.base64, variance: p.laplacianVariance })));
      }
    }
  }, []);

  // Camera init
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    startCamera(video)
      .then((stream) => { streamRef.current = stream; })
      .catch((err) => {
        setCameraError("Нет доступа к камере. Проверьте разрешения браузера.");
        console.error(err);
      });

    return () => { if (streamRef.current) stopCamera(streamRef.current); };
  }, []);

  // Brightness update loop
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !streamRef.current) return;
      try {
        const imageData = captureSnapshot(video, canvas);
        setBrightness(getBrightness(imageData));
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Gyroscope — beta=90 when phone held upright (portrait)
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.beta !== null) {
        setTilt(Math.abs(e.beta - 90));
        setGyroAvailable(true);
      }
    }
    if (typeof DeviceOrientationEvent !== "undefined") {
      window.addEventListener("deviceorientation", handleOrientation);
      return () => window.removeEventListener("deviceorientation", handleOrientation);
    }
  }, []);

  function saveDraft(updated: PhotoItem[]) {
    const raw = localStorage.getItem("claim_draft");
    const draft: DraftState = raw ? JSON.parse(raw) : { id: "", created_at: "", current_step: "camera" };
    draft.current_step = "camera";
    draft.photos = updated.map((p) => ({ base64: p.base64, laplacianVariance: p.variance, exif: null }));
    localStorage.setItem("claim_draft", JSON.stringify(draft));
  }

  const handleCapture = useCallback(async () => {
    if (capturing || photos.length >= MAX_PHOTOS) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCapturing(true);
    try {
      const { base64, laplacianVariance: variance } = await captureAndProcess(video, canvas);
      if (variance < BLUR_BLOCK) {
        showToast("Не удалось сделать фото — наведите камеру");
        return;
      }
      if (variance < BLUR_WARN) {
        showToast("Фото немного размыто, но сохранено");
      }
      const updated = [...photos, { base64, variance }];
      setPhotos(updated);
      saveDraft(updated);
    } catch (err) {
      showToast("Ошибка захвата фото");
      console.error(err);
    } finally {
      setCapturing(false);
    }
  }, [capturing, photos]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - photos.length;
    const toProcess = files.slice(0, remaining);

    for (const file of toProcess) {
      try {
        const { base64, laplacianVariance: variance } = await processFileToPhoto(file);
        if (variance < BLUR_BLOCK) {
          showToast(`${file.name}: не удалось обработать`);
          continue;
        }
        setPhotos((prev) => {
          const updated = [...prev, { base64, variance }];
          saveDraft(updated);
          return updated;
        });
      } catch {
        showToast(`Ошибка при обработке ${file.name}`);
      }
    }
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    saveDraft(updated);
  }

  const brightnessGood = brightness >= 60;
  const tiltGood = tilt === null || tilt <= 25;

  return (
    <main className="min-h-screen bg-black flex flex-col">
      {/* Header — safe area top so Dynamic Island doesn't cover it */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10 pt-safe">
        <button onClick={() => router.back()} className="text-white/70 p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-white text-sm font-medium">
          {photos.length} / {MAX_PHOTOS} фото
        </span>
        <div className="w-8" />
      </div>

      {/* Camera view */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {cameraError ? (
          <div className="text-center text-white p-8">
            <p className="text-lg mb-2">⚠️</p>
            <p className="text-sm">{cameraError}</p>
            <p className="text-xs text-white/50 mt-2">Используйте загрузку из галереи</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-6 pointer-events-none">
              {/* Target frame */}
              <div className="flex-1 flex items-center justify-center w-full">
                <div className="border-2 border-white/60 rounded-lg w-4/5 aspect-video" />
              </div>

              {/* Indicators */}
              <div className="space-y-1.5 w-full px-6">
                {photos.length < 3 && (
                  <div className="bg-black/60 text-white text-xs rounded-full px-3 py-1.5 w-fit mx-auto">
                    💳 Положите банковскую карту для масштаба
                  </div>
                )}
                <div className="flex justify-center gap-2 flex-wrap">
                  <span className={`text-xs rounded-full px-2.5 py-1 ${
                    brightnessGood ? "bg-green-600/80 text-white" : "bg-red-600/80 text-white"
                  }`}>
                    {brightnessGood ? "☀️ Свет OK" : "🌑 Темно"}
                  </span>
                  {gyroAvailable ? (
                    <span className={`text-xs rounded-full px-2.5 py-1 ${
                      tiltGood ? "bg-green-600/80 text-white" : "bg-yellow-500/80 text-white"
                    }`}>
                      {tiltGood ? "📱 Вертикально ✓" : `📱 Наклон ${Math.round(tilt ?? 0)}°`}
                    </span>
                  ) : (
                    <span className="text-xs rounded-full px-2.5 py-1 bg-black/60 text-white/80">
                      📱 Держите вертикально
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Hidden canvases */}
        <canvas ref={canvasRef} className="hidden" />
        <canvas ref={overlayRef} className="hidden" />
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="bg-black/90 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <div key={i} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${p.base64}`}
                  alt={`Фото ${i + 1}`}
                  className="w-14 h-14 object-cover rounded-md"
                />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls — safe area bottom so home indicator doesn't cover buttons */}
      <div className="bg-black px-6 pt-4 pb-safe flex items-center justify-between gap-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
        {/* Upload from gallery */}
        <label className="flex flex-col items-center gap-1 cursor-pointer">
          <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-white/50">Галерея</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>

        {/* Shutter */}
        <button
          onClick={handleCapture}
          disabled={capturing || photos.length >= MAX_PHOTOS || !!cameraError}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          {capturing ? (
            <Zap className="w-8 h-8 text-white animate-pulse" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white" />
          )}
        </button>

        {/* Next — arrow right, enabled when ≥1 photo */}
        <button
          onClick={() => router.push("/flow/review")}
          disabled={photos.length === 0}
          className="flex flex-col items-center gap-1 disabled:opacity-40"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            photos.length > 0 ? "bg-[#21A038]" : "border border-white/30"
          }`}>
            <ChevronRight className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-white/50">Далее</span>
        </button>
      </div>
    </main>
  );
}
