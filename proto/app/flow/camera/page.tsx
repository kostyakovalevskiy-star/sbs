"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Upload, X, Zap, Sun, ZoomIn } from "lucide-react";
import type { DraftState } from "@/types";
import {
  startCamera,
  stopCamera,
  captureAndProcess,
  processFileToPhoto,
  getBrightness,
  captureSnapshot,
} from "@/lib/camera";

const BLUR_BLOCK = 10;
const BLUR_WARN  = 40;
const MAX_PHOTOS = 10;

interface PhotoItem { base64: string; variance: number; }

type IndicatorState = "good" | "bad" | "unknown";

// Hysteresis: only flip state when value crosses threshold with buffer
function hysteresis(value: number, goodThreshold: number, buffer: number, prev: IndicatorState): IndicatorState {
  if (prev === "good" && value < goodThreshold - buffer) return "bad";
  if (prev !== "good" && value >= goodThreshold + buffer) return "good";
  return prev === "unknown" ? (value >= goodThreshold ? "good" : "bad") : prev;
}

// Extended constraint types for MediaStreamTrack capabilities — not in lib.dom.d.ts
interface ExtendedCapabilities extends MediaTrackCapabilities {
  zoom?: { min: number; max: number; step: number };
  exposureCompensation?: { min: number; max: number; step: number };
  torch?: boolean;
}
export default function CameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const [brightnessState, setBrightnessState] = useState<IndicatorState>("unknown");
  const [tiltState, setTiltState] = useState<IndicatorState>("unknown");
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroNeedsPermission, setGyroNeedsPermission] = useState(false);

  // Camera adjustments
  const [zoomCap, setZoomCap] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [brightnessAdjust, setBrightnessAdjust] = useState(0); // -5..+5 slider value, maps to CSS filter

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Load saved photos
  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const draft = JSON.parse(raw) as DraftState;
      if (draft.photos?.length) {
        setPhotos(draft.photos.map((p) => ({ base64: p.base64, variance: p.laplacianVariance })));
      }
    }
  }, []);

  // Camera init + probe for zoom / exposure capabilities
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    startCamera(video)
      .then((stream) => {
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        const caps = track.getCapabilities?.() as ExtendedCapabilities | undefined;
        if (caps?.zoom) {
          setZoomCap({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
        }

        // Check if iOS needs explicit permission for DeviceOrientation
        type IOSDeviceOrientationEvent = { requestPermission?: () => Promise<"granted" | "denied"> };
        const IOSDOEvent = DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent;
        if (typeof IOSDOEvent.requestPermission === "function") {
          setGyroNeedsPermission(true);
        } else {
          attachGyroListener();
        }
      })
      .catch((err) => {
        setCameraError("Нет доступа к камере. Проверьте разрешения браузера.");
        console.error(err);
      });

    return () => { if (streamRef.current) stopCamera(streamRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brightness sampling — sparse, avoid flicker via hysteresis
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !streamRef.current) return;
      try {
        const imageData = captureSnapshot(video, canvas);
        const b = getBrightness(imageData);
        setBrightnessState((prev) => hysteresis(b, 60, 15, prev));
      } catch {}
    }, 800);
    return () => clearInterval(interval);
  }, []);

  function attachGyroListener() {
    function onOrientation(e: DeviceOrientationEvent) {
      if (e.beta === null) return;
      setGyroAvailable(true);
      const tilt = Math.abs(e.beta - 90);
      setTiltState((prev) => hysteresis(-tilt, -25, 5, prev)); // "good" when tilt small
    }
    window.addEventListener("deviceorientation", onOrientation);
  }

  async function requestGyroPermission() {
    try {
      type IOSDeviceOrientationEvent = { requestPermission?: () => Promise<"granted" | "denied"> };
      const IOSDOEvent = DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent;
      if (IOSDOEvent.requestPermission) {
        const result = await IOSDOEvent.requestPermission();
        if (result === "granted") {
          attachGyroListener();
          setGyroNeedsPermission(false);
        }
      }
    } catch {
      setGyroNeedsPermission(false);
    }
  }

  // Apply zoom to camera track
  async function applyZoom(value: number) {
    setZoomValue(value);
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: value } as unknown as MediaTrackConstraintSet] });
    } catch (err) {
      console.warn("Zoom not applied:", err);
    }
  }

  // Brightness: CSS filter multiplier, -5…+5 slider → 0.5…1.8 multiplier
  const brightnessMultiplier = 1 + (brightnessAdjust / 5) * 0.8;

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

  const brightnessLabel =
    brightnessState === "good" ? "☀️ Свет OK"
    : brightnessState === "bad" ? "🌑 Темно"
    : "☀️ Оценка…";
  const tiltLabel =
    tiltState === "good" ? "📱 Ровно ✓"
    : tiltState === "bad" ? "📱 Наклон"
    : "📱 Проверка…";

  return (
    <main className="bg-black flex flex-col overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-black/80 z-10"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))' }}
      >
        <button onClick={() => router.back()} className="text-white/70 p-1 flex items-center gap-0.5">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs">Назад</span>
        </button>
        <span className="text-white text-sm font-medium">
          {photos.length} / {MAX_PHOTOS} фото
        </span>
        <button
          onClick={() => router.push("/thank-you")}
          className="text-xs text-[#21A038] font-medium whitespace-nowrap"
        >
          Завершить
        </button>
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
              style={{ filter: `brightness(${brightnessMultiplier})` }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-6 pointer-events-none">
              {/* Target frame */}
              <div className="flex-1 flex items-center justify-center w-full">
                <div className="border-2 border-white/60 rounded-lg w-4/5 aspect-video" />
              </div>

              {/* Gyro permission prompt */}
              {gyroNeedsPermission && (
                <div className="bg-black/70 text-white text-xs rounded-full px-3 py-1.5 pointer-events-auto">
                  <button onClick={requestGyroPermission}>
                    📱 Включить индикатор наклона
                  </button>
                </div>
              )}

              {/* Indicators */}
              <div className="space-y-1.5 w-full px-6">
                {photos.length < 3 && (
                  <div className="bg-black/60 text-white text-xs rounded-full px-3 py-1.5 w-fit mx-auto">
                    💳 Положите банковскую карту для масштаба
                  </div>
                )}
                <div className="flex justify-center gap-2 flex-wrap">
                  <span className={`text-xs rounded-full px-2.5 py-1 transition-colors ${
                    brightnessState === "good" ? "bg-green-600/80 text-white"
                    : brightnessState === "bad" ? "bg-red-600/80 text-white"
                    : "bg-black/50 text-white/80"
                  }`}>
                    {brightnessLabel}
                  </span>
                  {gyroAvailable && (
                    <span className={`text-xs rounded-full px-2.5 py-1 transition-colors ${
                      tiltState === "good" ? "bg-green-600/80 text-white"
                      : tiltState === "bad" ? "bg-yellow-500/80 text-white"
                      : "bg-black/50 text-white/80"
                    }`}>
                      {tiltLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Sliders: zoom (if hardware supported) + brightness (always available via CSS filter) */}
      {!cameraError && (
        <div className="bg-black/90 px-4 py-2 space-y-2">
          {zoomCap && (
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-white/70 shrink-0" />
              <input
                type="range"
                min={zoomCap.min}
                max={zoomCap.max}
                step={zoomCap.step}
                value={zoomValue}
                onChange={(e) => applyZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[#21A038]"
              />
              <span className="text-xs text-white/70 w-10 text-right">{zoomValue.toFixed(1)}x</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-white/70 shrink-0" />
            <input
              type="range"
              min={-5}
              max={5}
              step={1}
              value={brightnessAdjust}
              onChange={(e) => setBrightnessAdjust(parseInt(e.target.value))}
              className="flex-1 accent-[#21A038]"
            />
            <span className="text-xs text-white/70 w-10 text-right">
              {brightnessAdjust > 0 ? `+${brightnessAdjust}` : brightnessAdjust}
            </span>
          </div>
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

      {/* Controls */}
      <div
        className="bg-black px-6 flex items-center justify-between gap-4"
        style={{ paddingTop: '1.25rem', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 2.5rem))' }}
      >
        <label className="flex flex-col items-center gap-1 cursor-pointer">
          <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-white/50">Галерея</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
        </label>

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
