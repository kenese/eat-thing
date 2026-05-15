const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const RECIPE_PHOTO_MAX_EDGE = 1600;
export const RECIPE_PHOTO_RESIZE_THRESHOLD_BYTES = 1_500_000;
export const RECIPE_PHOTO_JPEG_QUALITY = 0.72;
export const RECIPE_PHOTO_TARGET_JSON_BYTES = 3_800_000;

export interface RecipePhotoUpload {
  base64: string;
  mimeType: string;
}

export function getRecipePhotoMimeType(mimeType: string): string {
  return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : 'image/jpeg';
}

export function getRecipePhotoUploadMimeType(_mimeType: string): string {
  return 'image/jpeg';
}

export function shouldResizeRecipePhoto(file: File): boolean {
  return file.size > RECIPE_PHOTO_RESIZE_THRESHOLD_BYTES || getRecipePhotoUploadMimeType(file.type) !== file.type;
}

export function calculateRecipePhotoSize(
  width: number,
  height: number,
  maxEdge = 1280,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function prepareRecipePhotoUpload(file: File): Promise<RecipePhotoUpload> {
  debugger;
  const mimeType = getRecipePhotoUploadMimeType(file.type);
  let uploadFile = shouldResizeRecipePhoto(file)
    ? await resizeRecipePhoto(file, mimeType, RECIPE_PHOTO_MAX_EDGE, RECIPE_PHOTO_JPEG_QUALITY)
    : file;
  let base64 = await blobToBase64(uploadFile);

  for (
    let maxEdge = 1280, quality = 0.68;
    estimateJsonPhotoPayloadBytes(base64, mimeType) > RECIPE_PHOTO_TARGET_JSON_BYTES && maxEdge >= 720;
    maxEdge = Math.round(maxEdge * 0.85), quality = Math.max(0.58, quality - 0.04)
  ) {
    uploadFile = await resizeRecipePhoto(file, mimeType, maxEdge, quality);
    base64 = await blobToBase64(uploadFile);
  }

  return {
    base64,
    mimeType,
  };
}

export function estimateJsonPhotoPayloadBytes(base64: string, mimeType: string): number {
  return new TextEncoder().encode(JSON.stringify({ imageBase64: base64, mimeType })).byteLength;
}

async function resizeRecipePhoto(
  file: File,
  mimeType: string,
  maxEdge: number,
  quality: number,
): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const size = calculateRecipePhotoSize(image.naturalWidth, image.naturalHeight, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.drawImage(image, 0, 0, size.width, size.height);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        mimeType,
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
