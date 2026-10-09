const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export async function shrinkImage(file: File, maxSide = 1024, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');
  if (file.size > MAX_INPUT_BYTES) throw new Error('image too large');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.toDataURL('image/jpeg', quality);
}
