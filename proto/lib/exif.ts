"use client";

import type { ExifData } from "@/types";

export async function parseExif(file: File | Blob): Promise<ExifData | null> {
  try {
    const exifr = await import("exifr");
    const result = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
    });

    if (!result) return null;

    const exif: ExifData = {};

    if (result.DateTimeOriginal) {
      exif.date = result.DateTimeOriginal.toISOString?.() ?? String(result.DateTimeOriginal);
    } else if (result.DateTime) {
      exif.date = result.DateTime.toISOString?.() ?? String(result.DateTime);
    }

    if (result.latitude != null && result.longitude != null) {
      exif.gps = { lat: result.latitude, lon: result.longitude };
    }

    if (result.Model) {
      exif.model = String(result.Model).trim();
    }

    return Object.keys(exif).length > 0 ? exif : null;
  } catch {
    return null;
  }
}
