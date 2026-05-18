
/**
 * Compresses an image file and returns a base64 string.
 * Resizes the image to a maximum dimension while maintaining aspect ratio.
 */
export async function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to base64 with quality adjustment
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // If still too large (rare with quality=0.6 and 800px), recursivly lower quality or size
        if (dataUrl.length > 900000) { // Keep below 1MB (string length is ~1.33x bytes)
           resolve(compressImage(file, maxWidth * 0.7, maxHeight * 0.7, quality * 0.7));
        } else {
           resolve(dataUrl);
        }
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

/**
 * Checks if a file is within size limits.
 */
export function isFileSizeValid(file: File, maxSizeMB: number): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}
