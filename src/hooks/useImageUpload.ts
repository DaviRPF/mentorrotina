'use client';

import { useState, useCallback } from 'react';

export interface AttachedImage {
  id: string;
  base64: string;
  mimeType: string;
  name: string;
}

export function useImageUpload(maxImages: number = 5) {
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(async (file: File): Promise<AttachedImage | null> => {
    if (!file.type.startsWith('image/')) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          base64,
          mimeType: file.type,
          name: file.name,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const addImage = useCallback(async (file: File) => {
    if (images.length >= maxImages) return false;

    setIsProcessing(true);
    const image = await processFile(file);
    setIsProcessing(false);

    if (image) {
      setImages((prev) => [...prev, image].slice(0, maxImages));
      return true;
    }
    return false;
  }, [images.length, maxImages, processFile]);

  const addImagesFromClipboard = useCallback(async (items: DataTransferItemList) => {
    setIsProcessing(true);
    const newImages: AttachedImage[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const image = await processFile(file);
          if (image) {
            newImages.push(image);
          }
        }
      }
    }

    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages].slice(0, maxImages));
    }
    setIsProcessing(false);
    return newImages.length > 0;
  }, [maxImages, processFile]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    isProcessing,
    addImage,
    addImagesFromClipboard,
    removeImage,
    clearImages,
  };
}
