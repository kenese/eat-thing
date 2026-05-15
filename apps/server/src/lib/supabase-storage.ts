import { randomUUID } from 'node:crypto';

const BUCKET = 'eat-thing';

function storageUrl(path: string): string {
  const base = process.env.SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/${BUCKET}/${path}`;
}

export async function uploadPhoto(
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `recipe-photos/${randomUUID()}.${ext}`;
  const body = Buffer.from(imageBase64, 'base64');

  const res = await fetch(storageUrl(path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY ?? ''}`,
      'Content-Type': mimeType,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed: ${res.status} ${text}`);
  }

  return publicUrl(path);
}

export function publicUrl(storagePath: string): string {
  const base = process.env.SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}
