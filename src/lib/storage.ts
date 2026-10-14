import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadedDocumentResult {
  name: string;
  url: string;
  dataUrl: string;
  type: string;
  size: number;
}

/**
 * Converts a browser File into a base64 Data URL.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a document to Firebase Storage with automatic fallback to Data URL storage.
 * Completely eliminates the 0 document upload limitation.
 */
export async function uploadDocument(
  file: File,
  folder: 'payments' | 'receipts' | 'attachments' = 'attachments'
): Promise<UploadedDocumentResult> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${folder}/${timestamp}_${sanitizedName}`;

  // Read base64 data url first to guarantee offline availability & preview
  const dataUrl = await fileToDataUrl(file);

  let downloadUrl = dataUrl;

  try {
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
    downloadUrl = await getDownloadURL(snapshot.ref);
  } catch (storageError) {
    console.warn('Firebase Storage upload failed or not configured, utilizing inline storage payload:', storageError);
    // Fall back to dataUrl so user never loses their uploaded file
    downloadUrl = dataUrl;
  }

  return {
    name: file.name,
    url: downloadUrl,
    dataUrl,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };
}
