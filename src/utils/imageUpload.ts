/**
 * Image upload & compression utility
 * Supports PNG, JPEG, WEBP, and SVG with automatic downscaling for Firestore documents
 */

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSizeMb?: number;
}

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
];

export async function processImageFile(
  file: File,
  options: ProcessImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.88,
    maxFileSizeMb = 4,
  } = options;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported file format. Please upload a PNG, JPG, WEBP, or SVG image.');
  }

  if (file.size > maxFileSizeMb * 1024 * 1024) {
    throw new Error(`File size exceeds maximum allowed limit of ${maxFileSizeMb}MB.`);
  }

  // Preserve vector SVG as pure data URI
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read SVG file.'));
      reader.readAsDataURL(file);
    });
  }

  // For bitmap images, downscale via canvas to keep Base64 compact for Firestore documents
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to raw base64 if canvas is unavailable
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Maintain transparency for PNG / WEBP
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let dataUrl = canvas.toDataURL(outputMime, quality);

        // If dataUrl exceeds 350KB, scale down slightly to guarantee it fits safely in Firestore
        if (dataUrl.length > 350000) {
          const scaledW = Math.round(width * 0.7);
          const scaledH = Math.round(height * 0.7);
          const sCanvas = document.createElement('canvas');
          sCanvas.width = scaledW;
          sCanvas.height = scaledH;
          const sCtx = sCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(img, 0, 0, scaledW, scaledH);
            dataUrl = sCanvas.toDataURL(outputMime, 0.85);
          }
        }

        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to decode image data.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}
