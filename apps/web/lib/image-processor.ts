/**
 * Mandatory Image Processor Utility per AGENTS.md Rule 4
 * Converts any image file to WebP format, limits size to 2MB, quality between 0.6 and 0.8.
 */
export async function processImageToWebP(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeBytes?: number;
  } = {}
): Promise<{ file: File; dataUrl: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.75,
    maxSizeBytes = 2 * 1024 * 1024, // 2MB
  } = options;

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("El archivo original excede el tamaño máximo permitido de 10MB");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
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

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto de renderizado de imagen"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/webp", quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Error al convertir la imagen a formato WebP"));
              return;
            }

            if (blob.size > maxSizeBytes) {
              reject(new Error("La imagen procesada excede el límite de 2MB. Por favor elige una imagen más pequeña."));
              return;
            }

            const webpFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const webpFile = new File([blob], webpFileName, { type: "image/webp" });
            resolve({ file: webpFile, dataUrl });
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Error al cargar la imagen seleccionada"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.readAsDataURL(file);
  });
}
