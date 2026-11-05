// A receipt picture or PDF on its way to /api/chat. It's held in memory for
// this visit only: never saved to localStorage, never stored or logged on the
// server. The picture is made smaller on the phone first, for slow networks.

import { z } from "zod";

export const RECEIPT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number];

const MAX_INPUT_BYTES = 25 * 1024 * 1024; // a phone photo before shrinking
const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_LONG_EDGE = 1568; // larger pictures are scaled down by the API anyway
const TARGET_IMAGE_BYTES = 1.5 * 1024 * 1024;

// A 2 MB PDF is about 2.7 million characters of base64.
export const MAX_ATTACHMENT_CHARS = 2_800_000;

export const ReceiptAttachmentSchema = z.object({
  mediaType: z.enum(RECEIPT_MEDIA_TYPES),
  data: z.string().min(16).max(MAX_ATTACHMENT_CHARS),
});
export type ReceiptAttachment = z.infer<typeof ReceiptAttachmentSchema>;

// The first base64 characters each file type must start with, so a file that
// isn't what it claims to be is turned away before it reaches the API.
const SIGNATURES: Record<ReceiptMediaType, string> = {
  "image/jpeg": "/9j/",
  "image/png": "iVBOR",
  "image/webp": "UklGR",
  "application/pdf": "JVBER",
};

export function attachmentLooksValid(attachment: ReceiptAttachment): boolean {
  return attachment.data.startsWith(SIGNATURES[attachment.mediaType]);
}

export function attachmentKind(attachment: ReceiptAttachment): "photo" | "pdf" {
  return attachment.mediaType === "application/pdf" ? "pdf" : "photo";
}

export function scaleToFit(width: number, height: number, maxEdge = MAX_LONG_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export type PrepareError = "too_big" | "wrong_type" | "unreadable";
export type PrepareResult = { ok: true; attachment: ReceiptAttachment } | { ok: false; error: PrepareError };

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Browser only: turns a chosen file into something small enough to send.
export async function prepareReceipt(file: Blob & { name?: string }): Promise<PrepareResult> {
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: "too_big" };

  const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: "too_big" };
    try {
      return { ok: true, attachment: { mediaType: "application/pdf", data: await toBase64(file) } };
    } catch {
      return { ok: false, error: "unreadable" };
    }
  }
  if (file.type && !file.type.startsWith("image/")) return { ok: false, error: "wrong_type" };

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = scaleToFit(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: "unreadable" };
    context.fillStyle = "white"; // transparent areas would turn black as JPEG
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    let blob = await canvasToJpeg(canvas, 0.82);
    if (blob && blob.size > TARGET_IMAGE_BYTES) blob = await canvasToJpeg(canvas, 0.6);
    if (!blob) return { ok: false, error: "unreadable" };
    return { ok: true, attachment: { mediaType: "image/jpeg", data: await toBase64(blob) } };
  } catch {
    return { ok: false, error: "unreadable" };
  }
}
