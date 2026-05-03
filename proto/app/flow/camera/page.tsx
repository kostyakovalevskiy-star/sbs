"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  Zap,
  Sun,
  ZoomIn,
  Ruler,
  Info,
  AlertTriangle,
  Smartphone,
  Flashlight,
  FlashlightOff,
} from "lucide-react";
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
const BLUR_WARN = 40;
const MAX_PHOTOS = 10;

const SBER_GREEN = "#21A038";
const SBER_GREEN_DARK = "#1c8a30";

interface PhotoItem {
  base64: string;
  variance: number;
  sceneId?: string;
}

type IndicatorState = "good" | "bad" | "unknown";

// ---------- Scenario definitions ----------
// 4 universal scenes. Later can branch on event_type from the survey.
interface Scene {
  id: string;
  index: number;
  title: string;
  hint: string;
  description: string;
  // Path to the illustration (PNG in /public/scenes).
  illustrationSrc: string;
}

// Per-room scene template. The actual scene list is built dynamically
// inside the component: we multiply the template by the rooms captured in
// chat (if any), then append a single "extras" stage for movable property /
// receipts / overflow shots. When no rooms were captured the template runs
// once as a single-room legacy flow.
type SceneKind = "wide" | "close_scale" | "source" | "act_document" | "extras";

interface SceneTemplate {
  kind: SceneKind;
  titleSuffix: string;
  hint: string;
  description: string;
  illustrationSrc: string;
}

const ROOM_SCENE_TEMPLATE: SceneTemplate[] = [
  {
    kind: "wide",
    titleSuffix: "общий план",
    hint: "Пройдите подальше — должна быть видна вся стена",
    description:
      "Сделайте фото всего помещения, чтобы было видно повреждённую зону",
    illustrationSrc: "/scenes/1_full_scene.svg",
  },
  {
    kind: "close_scale",
    titleSuffix: "крупный план с масштабом",
    hint: "Подойдите ближе и положите карту или линейку рядом с повреждением",
    description:
      "Сделайте крупный кадр повреждения, рядом положите карту или линейку — AI точно определит размер",
    illustrationSrc: "/scenes/3_measure_scale.svg",
  },
  {
    kind: "source",
    titleSuffix: "источник проблемы",
    hint: "Снимите место, откуда пошла вода / поднялся огонь",
    description: "Снимите источник: трубы, окно, потолок — место, откуда пошла проблема",
    illustrationSrc: "/scenes/4_source.svg",
  },
];

const ACT_DOCUMENT_SCENE: SceneTemplate = {
  kind: "act_document",
  titleSuffix: "акт от УК / компетентного органа",
  hint: "Документ должен быть читаемым: AI распознает текст для подтверждения события",
  description:
    "Сфотографируйте акт от управляющей компании, МЧС, полиции или другого компетентного органа. Если AI распознает в нём факт события — кейс получит высокую надёжность и сможет быть выплачен без независимой экспертизы.",
  illustrationSrc: "/scenes/4_source.svg",
};

const EXTRAS_SCENE: SceneTemplate = {
  kind: "extras",
  titleSuffix: "дополнительные фото",
  hint: "Имущество, чеки, любые ракурсы повреждений",
  description:
    "Сфотографируйте пострадавшее имущество (бытовую технику, мебель), чеки на покупку и любые дополнительные ракурсы.",
  illustrationSrc: "/scenes/1_full_scene.svg",
};

function buildScenes(rooms?: { id: string; name: string }[]): Scene[] {
  const list: Scene[] = [];
  let index = 1;
  if (rooms && rooms.length > 0) {
    for (const r of rooms) {
      for (const t of ROOM_SCENE_TEMPLATE) {
        list.push({
          id: `${r.id}::${t.kind}`,
          index: index++,
          title: `${r.name} — ${t.titleSuffix}`,
          hint: t.hint,
          description: t.description,
          illustrationSrc: t.illustrationSrc,
        });
      }
    }
  } else {
    // Legacy single-room flow.
    for (const t of ROOM_SCENE_TEMPLATE) {
      list.push({
        id: t.kind,
        index: index++,
        title: t.titleSuffix.charAt(0).toUpperCase() + t.titleSuffix.slice(1),
        hint: t.hint,
        description: t.description,
        illustrationSrc: t.illustrationSrc,
      });
    }
  }
  // act_document — обязательный этап перед extras. Один на весь кейс.
  list.push({
    id: "act_document",
    index: index++,
    title: "Акт от УК",
    hint: ACT_DOCUMENT_SCENE.hint,
    description: ACT_DOCUMENT_SCENE.description,
    illustrationSrc: ACT_DOCUMENT_SCENE.illustrationSrc,
  });
  list.push({
    id: "extras",
    index: index,
    title: "Дополнительные фото",
    hint: EXTRAS_SCENE.hint,
    description: EXTRAS_SCENE.description,
    illustrationSrc: EXTRAS_SCENE.illustrationSrc,
  });
  return list;
}

// 5 seconds matches the toast hint dwell time the user asked for. Earlier
// the intro had a "seen-once → 1500ms" shortcut which made the overlay
// flash by too fast on return visits — pulled out so every scene gets the
// full 5 seconds (or until the user taps / starts moving the phone).
const INTRO_DURATION_MS = 5000;
const INTRO_MOTION_THRESHOLD = 1.5; // m/s² — accel above this = user moving

function hysteresis(
  value: number,
  goodThreshold: number,
  buffer: number,
  prev: IndicatorState
): IndicatorState {
  if (prev === "good" && value < goodThreshold - buffer) return "bad";
  if (prev !== "good" && value >= goodThreshold + buffer) return "good";
  return prev === "unknown" ? (value >= goodThreshold ? "good" : "bad") : prev;
}

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

  // Scenario flow — `scenes` is built once on mount from chat-captured rooms.
  const [scenes, setScenes] = useState<Scene[]>(() => buildScenes());
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [introFading, setIntroFading] = useState(false);

  // Quality indicators (kept from original logic)
  const [brightnessState, setBrightnessState] = useState<IndicatorState>("unknown");
  const [tiltState, setTiltState] = useState<IndicatorState>("unknown");
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroNeedsPermission, setGyroNeedsPermission] = useState(false);

  // Camera adjustments — now hidden behind a single toggle
  const [zoomCap, setZoomCap] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [brightnessAdjust, setBrightnessAdjust] = useState(0);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [showMeasureHelp, setShowMeasureHelp] = useState(false);

  const currentScene = scenes[currentSceneIdx] ?? scenes[0];
  // The "extras" scene is unbounded — it's never marked "incomplete" because
  // it serves as overflow for movable property / receipts / extra angles.
  const sceneCompleted = scenes.map((s) =>
    s.id === "extras" ? true : photos.some((p) => p.sceneId === s.id)
  );
  const allScenesCovered = sceneCompleted.every(Boolean);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  // Dismiss intro: with fade animation
  const dismissIntro = useCallback(() => {
    setIntroFading((fading) => {
      if (fading) return fading;
      setTimeout(() => {
        setShowIntro(false);
        setIntroFading(false);
      }, 280);
      return true;
    });
  }, []);

  // Show intro on every scene change; auto-dismiss after INTRO_DURATION_MS
  // unless the user taps or starts moving the phone first.
  useEffect(() => {
    setShowIntro(true);
    setIntroFading(false);
    const timeout = setTimeout(() => dismissIntro(), INTRO_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [currentSceneIdx, dismissIntro]);

  // Dismiss intro on device motion (user starts moving phone)
  useEffect(() => {
    if (!showIntro) return;
    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      // gravity baseline ~9.8; we look for deviation
      if (Math.abs(mag - 9.8) > INTRO_MOTION_THRESHOLD) {
        dismissIntro();
      }
    }
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [showIntro, dismissIntro]);

  // Load saved photos + rebuild dynamic scenes from chat-captured rooms.
  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const draft = JSON.parse(raw) as DraftState;
      const rooms = (draft.flood?.rooms ?? draft.intro?.rooms)?.map((r) => ({
        id: r.id,
        name: r.name,
      }));
      setScenes(buildScenes(rooms));

      if (draft.photos?.length) {
        setPhotos(
          draft.photos.map((p) => ({
            base64: p.base64,
            variance: p.laplacianVariance,
            sceneId: p.sceneId,
          }))
        );
      }
    }
  }, []);

  // Camera init
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
        if (caps?.torch) setTorchSupported(true);

        type IOSDOEvent = { requestPermission?: () => Promise<"granted" | "denied"> };
        const IOSDOEventCtor = DeviceOrientationEvent as unknown as IOSDOEvent;
        if (typeof IOSDOEventCtor.requestPermission === "function") {
          setGyroNeedsPermission(true);
        } else {
          attachGyroListener();
        }
      })
      .catch((err) => {
        setCameraError("Нет доступа к камере. Проверьте разрешения браузера.");
        console.error(err);
      });

    return () => {
      const track = trackRef.current;
      // Best-effort: turn the torch off before the track stops so the LED
      // doesn't stay on after unmount on some Android devices.
      if (track) {
        track
          .applyConstraints({
            advanced: [{ torch: false } as unknown as MediaTrackConstraintSet],
          })
          .catch(() => {});
      }
      if (streamRef.current) stopCamera(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  }

  // Brightness sampling
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
      setTiltState((prev) => hysteresis(-tilt, -25, 5, prev));
    }
    window.addEventListener("deviceorientation", onOrientation);
  }

  async function requestGyroPermission() {
    try {
      type IOSDOEvent = { requestPermission?: () => Promise<"granted" | "denied"> };
      const IOSDOEventCtor = DeviceOrientationEvent as unknown as IOSDOEvent;
      if (IOSDOEventCtor.requestPermission) {
        const result = await IOSDOEventCtor.requestPermission();
        if (result === "granted") {
          attachGyroListener();
          setGyroNeedsPermission(false);
        }
      }
    } catch {
      setGyroNeedsPermission(false);
    }
  }

  async function applyZoom(value: number) {
    setZoomValue(value);
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as unknown as MediaTrackConstraintSet],
      });
    } catch (err) {
      console.warn("Zoom not applied:", err);
    }
  }

  const brightnessMultiplier = 1 + (brightnessAdjust / 5) * 0.8;

  function saveDraft(updated: PhotoItem[]) {
    const raw = localStorage.getItem("claim_draft");
    const draft: DraftState = raw
      ? JSON.parse(raw)
      : { id: "", created_at: "", current_step: "camera" };
    draft.current_step = "camera";
    draft.photos = updated.map((p) => ({
      base64: p.base64,
      laplacianVariance: p.variance,
      sceneId: p.sceneId,
      exif: null,
    }));
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
        showToast("Фото слишком размыто. Удерживайте телефон ровнее");
        return;
      }
      if (variance < BLUR_WARN) {
        showToast("Фото немного размыто, но сохранено");
      }
      const updated = [...photos, { base64, variance, sceneId: currentScene.id }];
      setPhotos(updated);
      saveDraft(updated);

      // Auto-advance to next uncovered scene (skip the unbounded "extras"
      // scene — user advances it manually when they're done).
      if (currentScene.id !== "extras") {
        const nextIdx = scenes.findIndex(
          (s, i) =>
            i > currentSceneIdx &&
            s.id !== "extras" &&
            !updated.some((p) => p.sceneId === s.id)
        );
        if (nextIdx !== -1) {
          setTimeout(() => setCurrentSceneIdx(nextIdx), 600);
        }
      }
    } catch (err) {
      showToast("Ошибка захвата фото");
      console.error(err);
    } finally {
      setCapturing(false);
    }
  }, [capturing, photos, currentScene.id, currentSceneIdx]);

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
          const updated = [...prev, { base64, variance, sceneId: currentScene.id }];
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

  // Single contextual hint shown above shutter — replaces all the pill clutter
  function getContextHint(): { text: string; tone: "neutral" | "warn" | "good" } {
    if (brightnessState === "bad") {
      return { text: "Слишком темно — включите свет или вспышку", tone: "warn" };
    }
    if (gyroAvailable && tiltState === "bad") {
      return { text: "Держите телефон ровнее", tone: "warn" };
    }
    return { text: currentScene.hint, tone: "neutral" };
  }

  const hint = getContextHint();

  return (
    <main
      className="bg-black flex flex-col overflow-hidden select-none"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      {/* ============ HEADER ============ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-3 bg-black/80 z-10"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        <button
          onClick={() => router.back()}
          className="text-white/60 p-1 flex items-center gap-0.5 active:opacity-50"
          aria-label="Назад"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center min-w-0 px-2">
          <span className="text-[10px] tracking-wider text-white/50 uppercase">
            Этап {currentScene.index} из {scenes.length}
          </span>
          <span className="text-sm font-medium text-white truncate max-w-[60vw] text-center">{currentScene.title}</span>
        </div>

        <button
          onClick={() => router.push("/thank-you?abandoned=1")}
          className="text-xs text-white/40 active:opacity-50 px-1"
        >
          Завершить
        </button>
      </div>

      {/* ============ SCENE PROGRESS BAR ============ */}
      <div className="shrink-0 flex items-center gap-1 px-4 pb-2 bg-black/80 overflow-x-auto">
        {scenes.map((scene, i) => {
          const done = sceneCompleted[i];
          const active = i === currentSceneIdx;
          return (
            <button
              key={scene.id}
              onClick={() => setCurrentSceneIdx(i)}
              className="flex-1 min-w-[12px] h-1 rounded-full transition-colors"
              style={{
                background: done && !active
                  ? SBER_GREEN
                  : active
                  ? "rgba(255,255,255,0.6)"
                  : "rgba(255,255,255,0.2)",
              }}
              aria-label={`Этап ${scene.index}: ${scene.title}`}
            />
          );
        })}
      </div>

      {/* ============ CAMERA VIEW ============ */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {cameraError ? (
          <div className="text-center text-white/80 p-8 max-w-xs">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-400" strokeWidth={1.5} />
            <p className="text-sm mb-1">{cameraError}</p>
            <p className="text-xs text-white/50 mt-2">Загрузите фото из галереи ниже</p>
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

            {/* Frame corners — thin and subtle, vector-effect keeps stroke
                width constant regardless of viewport size. */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <g
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              >
                <path d="M10,20 L10,15 L15,15" strokeWidth="1" />
                <path d="M85,15 L90,15 L90,20" strokeWidth="1" />
                <path d="M10,80 L10,85 L15,85" strokeWidth="1" />
                <path d="M85,85 L90,85 L90,80" strokeWidth="1" />
              </g>
            </svg>

            {/* Single context hint above shutter */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center px-6 pointer-events-none">
              <div
                className="text-xs px-3 py-1.5 rounded-full transition-colors max-w-full"
                style={{
                  background:
                    hint.tone === "warn"
                      ? "rgba(217, 119, 6, 0.9)"
                      : hint.tone === "good"
                      ? "rgba(33, 160, 56, 0.85)"
                      : "rgba(0,0,0,0.55)",
                  color: "white",
                  backdropFilter: "blur(6px)",
                }}
              >
                {hint.text}
              </div>
            </div>

            {/* iOS gyro permission prompt — minimal */}
            {gyroNeedsPermission && (
              <button
                onClick={requestGyroPermission}
                className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs rounded-full px-3 py-1.5 flex items-center gap-1.5 active:opacity-70"
              >
                <Smartphone className="w-3 h-3" strokeWidth={1.8} />
                Включить датчик наклона
              </button>
            )}

            {/* Top-right: replay scene tip */}
            <button
              onClick={() => setShowIntro(true)}
              className="absolute top-3 right-3 bg-black/40 backdrop-blur border border-white/15 text-white/70 text-[10px] rounded-full px-2.5 py-1 flex items-center gap-1 active:opacity-70"
            >
              <Info className="w-3 h-3" strokeWidth={1.8} />
              Пример
            </button>

            {/* Top-left: adjustments toggle (zoom + brightness) */}
            <button
              onClick={() => setShowAdjustments((v) => !v)}
              className="absolute top-3 left-3 bg-black/40 backdrop-blur border border-white/15 rounded-full p-1.5 active:opacity-70"
              aria-label="Настройки камеры"
            >
              <Sun className="w-3.5 h-3.5 text-white/70" strokeWidth={1.8} />
            </button>

            {/* Top-left (next to settings): torch toggle — only if the device
                exposes the capability via MediaTrack constraints. */}
            {torchSupported && (
              <button
                onClick={toggleTorch}
                aria-label={torchOn ? "Выключить вспышку" : "Включить вспышку"}
                aria-pressed={torchOn}
                className={`absolute top-3 left-12 backdrop-blur border rounded-full p-1.5 active:opacity-70 transition-colors ${
                  torchOn
                    ? "bg-yellow-300/90 border-yellow-200 text-black"
                    : "bg-black/40 border-white/15 text-white/70"
                }`}
              >
                {torchOn ? (
                  <Flashlight className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  <FlashlightOff className="w-3.5 h-3.5" strokeWidth={1.8} />
                )}
              </button>
            )}

            {/* Adjustments panel — only when toggled */}
            {showAdjustments && (
              <div className="absolute top-12 left-3 right-3 bg-black/70 backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2.5 max-w-xs">
                {zoomCap && (
                  <div className="flex items-center gap-2">
                    <ZoomIn className="w-3.5 h-3.5 text-white/70 shrink-0" strokeWidth={1.8} />
                    <input
                      type="range"
                      min={zoomCap.min}
                      max={zoomCap.max}
                      step={zoomCap.step}
                      value={zoomValue}
                      onChange={(e) => applyZoom(parseFloat(e.target.value))}
                      className="flex-1"
                      style={{ accentColor: SBER_GREEN }}
                    />
                    <span className="text-[10px] text-white/60 w-9 text-right tabular-nums">
                      {zoomValue.toFixed(1)}x
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-white/70 shrink-0" strokeWidth={1.8} />
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={1}
                    value={brightnessAdjust}
                    onChange={(e) => setBrightnessAdjust(parseInt(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: SBER_GREEN }}
                  />
                  <span className="text-[10px] text-white/60 w-9 text-right tabular-nums">
                    {brightnessAdjust > 0 ? `+${brightnessAdjust}` : brightnessAdjust}
                  </span>
                </div>
                {currentScene.id === "close_scale" && (
                  <button
                    onClick={() => {
                      setShowAdjustments(false);
                      setShowMeasureHelp(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] text-white/80 py-1.5 border-t border-white/10 pt-2 active:opacity-70"
                  >
                    <Ruler className="w-3 h-3" strokeWidth={1.8} />
                    Нужны точные размеры?
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* ============ SCENE INTRO OVERLAY ============ */}
        {showIntro && !cameraError && (
          <div
            onClick={dismissIntro}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center px-8 cursor-pointer transition-opacity duration-300"
            style={{
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(8px)",
              opacity: introFading ? 0 : 1,
            }}
          >
            <div className="text-[10px] tracking-[1.5px] text-white/55 uppercase mb-1.5">
              Этап {currentScene.index} из {scenes.length}
            </div>
            <div className="text-xl font-medium text-white mb-1.5">{currentScene.title}</div>
            <div className="text-xs text-white/65 text-center max-w-[260px] leading-relaxed mb-7">
              {currentScene.description}
            </div>

            <div
              className="w-full max-w-[520px] mb-7 flex items-center justify-center"
              style={{
                animation: "introFloat 3s ease-in-out infinite",
                maxHeight: "60vh",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentScene.illustrationSrc}
                alt={currentScene.title}
                className="w-full h-auto max-h-[60vh] object-contain"
                style={{ opacity: 0.4 }}
                draggable={false}
              />
            </div>

            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(33,160,56,0.12)",
                border: "0.5px solid rgba(33,160,56,0.35)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: SBER_GREEN,
                  animation: "introPulse 1.4s ease-in-out infinite",
                }}
              />
              <span className="text-[10px] text-[#86E69E]">тапните или начните снимать</span>
            </div>
          </div>
        )}
      </div>

      {/* ============ TOAST ============ */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur text-white text-xs px-3.5 py-2 rounded-full z-50 whitespace-nowrap max-w-[90vw] truncate">
          {toast}
        </div>
      )}

      {/* ============ THUMBNAILS ============ */}
      {photos.length > 0 && (
        <div className="bg-black px-4 py-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {photos.map((p, i) => {
              const scene = scenes.find((s) => s.id === p.sceneId);
              return (
                <div key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/jpeg;base64,${p.base64}`}
                    alt={`Фото ${i + 1}`}
                    className="w-12 h-12 object-cover rounded-md border border-white/10"
                  />
                  {scene && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white/85 text-[8px] text-center py-0.5 rounded-b-md leading-none">
                      {scene.index}
                    </span>
                  )}
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1 -right-1 bg-white/90 rounded-full w-4 h-4 flex items-center justify-center"
                    aria-label="Удалить фото"
                  >
                    <X className="w-2.5 h-2.5 text-black" strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ BOTTOM CONTROLS ============ */}
      <div
        className="bg-black px-6 flex items-center justify-between gap-4 shrink-0"
        style={{
          paddingTop: "1rem",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))",
        }}
      >
        {/* Gallery upload */}
        <label className="flex flex-col items-center gap-1 cursor-pointer active:opacity-60">
          <div className="w-11 h-11 rounded-xl border border-white/20 flex items-center justify-center">
            <Upload className="w-4 h-4 text-white/80" strokeWidth={1.8} />
          </div>
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
          className="w-[72px] h-[72px] rounded-full border-[3px] border-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
          aria-label="Сделать снимок"
        >
          {capturing ? (
            <Zap className="w-7 h-7 text-white animate-pulse" strokeWidth={1.8} />
          ) : (
            <div className="w-[54px] h-[54px] rounded-full bg-white" />
          )}
        </button>

        {/* Next button */}
        <button
          onClick={() => router.push("/flow/review")}
          disabled={photos.length === 0}
          className="flex flex-col items-center gap-1 disabled:opacity-30 active:opacity-60"
          aria-label="Далее"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors"
            style={{
              background: allScenesCovered ? SBER_GREEN : "transparent",
              border: allScenesCovered ? "none" : "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <ChevronRight
              className="w-5 h-5 text-white"
              strokeWidth={allScenesCovered ? 2.2 : 1.8}
            />
          </div>
        </button>
      </div>

      {/* ============ MEASURE HELP MODAL ============ */}
      {showMeasureHelp && (
        <div
          className="fixed inset-0 bg-black/85 z-[60] flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowMeasureHelp(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-4"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
                <Ruler className="w-5 h-5" strokeWidth={1.8} style={{ color: SBER_GREEN }} />
                Точные размеры
              </h3>
              <button
                onClick={() => setShowMeasureHelp(false)}
                className="text-gray-400 p-1 -mr-1"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Чтобы AI использовал точные размеры вместо визуальной оценки, добавьте скриншот из
              стандартного приложения Apple <strong>«Рулетка»</strong>.
            </p>

            <ol className="space-y-2.5 text-sm text-gray-700">
              {[
                <>
                  Откройте приложение <strong>«Рулетка»</strong> (Measure) на iPhone
                </>,
                <>Замерьте повреждённую область — приложение покажет размеры в см/м</>,
                <>
                  Сделайте скриншот (<em>кнопка сна + громкость вверх</em>)
                </>,
                <>Вернитесь сюда и нажмите «Галерея» — выберите скриншот</>,
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className="shrink-0 w-5 h-5 rounded-full text-xs font-medium flex items-center justify-center"
                    style={{ background: "#e8f5ea", color: SBER_GREEN }}
                  >
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>

            <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.8} />
              <span>
                AI распознает цифры со скриншота и использует их как приоритетные при расчёте.
              </span>
            </div>

            <label className="block">
              <span
                className="w-full text-white rounded-lg py-3 text-sm font-medium cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition"
                style={{ background: SBER_GREEN }}
                onMouseEnter={(e) => (e.currentTarget.style.background = SBER_GREEN_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.background = SBER_GREEN)}
              >
                <Upload className="w-4 h-4" strokeWidth={1.8} />
                Загрузить скриншот из Рулетки
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFileUpload(e);
                  setShowMeasureHelp(false);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* ============ ANIMATIONS ============ */}
      <style jsx>{`
        @keyframes introFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes introPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      `}</style>
    </main>
  );
}
