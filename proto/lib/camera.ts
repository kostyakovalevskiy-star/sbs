"use client";

import type { ExifData } from "@/types";

export async function startCamera(videoEl: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export function captureSnapshot(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement
): ImageData {
  const ctx = canvasEl.getContext("2d")!;
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  ctx.drawImage(videoEl, 0, 0);
  return ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
}

export function laplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Laplacian kernel: 0 1 0 / 1 -4 1 / 0 1 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      // Grayscale
      const gray =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const up = (y - 1) * width + x;
      const down = (y + 1) * width + x;
      const left = y * width + (x - 1);
      const right = y * width + (x + 1);

      const gUp = 0.299 * data[up * 4] + 0.587 * data[up * 4 + 1] + 0.114 * data[up * 4 + 2];
      const gDown = 0.299 * data[down * 4] + 0.587 * data[down * 4 + 1] + 0.114 * data[down * 4 + 2];
      const gLeft = 0.299 * data[left * 4] + 0.587 * data[left * 4 + 1] + 0.114 * data[left * 4 + 2];
      const gRight = 0.299 * data[right * 4] + 0.587 * data[right * 4 + 1] + 0.114 * data[right * 4 + 2];

      const laplacian = gUp + gDown + gLeft + gRight - 4 * gray;
      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, variance);
}

export function getBrightness(imageData: ImageData): number {
  const { data } = imageData;
  let total = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / pixelCount;
}

export async function resizeTo1600(
  source: HTMLCanvasElement | HTMLImageElement | ImageBitmap
): Promise<Blob> {
  const MAX_SIDE = 1600;

  let srcWidth: number;
  let srcHeight: number;

  if (source instanceof HTMLCanvasElement) {
    srcWidth = source.width;
    srcHeight = source.height;
  } else if (source instanceof HTMLImageElement) {
    srcWidth = source.naturalWidth;
    srcHeight = source.naturalHeight;
  } else {
    srcWidth = source.width;
    srcHeight = source.height;
  }

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (srcWidth > MAX_SIDE || srcHeight > MAX_SIDE) {
    if (srcWidth > srcHeight) {
      targetWidth = MAX_SIDE;
      targetHeight = Math.round((srcHeight * MAX_SIDE) / srcWidth);
    } else {
      targetHeight = MAX_SIDE;
      targetWidth = Math.round((srcWidth * MAX_SIDE) / srcHeight);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.85
    );
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix, return only base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function captureAndProcess(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement
): Promise<{ base64: string; laplacianVariance: number; blob: Blob }> {
  const imageData = captureSnapshot(videoEl, canvasEl);
  const variance = laplacianVariance(imageData);
  const blob = await resizeTo1600(canvasEl);
  const base64 = await blobToBase64(blob);
  return { base64, laplacianVariance: variance, blob };
}

export async function processFileToPhoto(
  file: File
): Promise<{ base64: string; laplacianVariance: number; exif: ExifData | null }> {
  const bitmap = await createImageBitmap(file);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const variance = laplacianVariance(imageData);

  const blob = await resizeTo1600(bitmap);
  const base64 = await blobToBase64(blob);
  bitmap.close();

  const { parseExif } = await import("./exif");
  const exif = await parseExif(file);

  return { base64, laplacianVariance: variance, exif };
}
