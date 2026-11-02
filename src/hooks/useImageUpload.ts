/** Upload một ảnh theo mục đích, trả về URL Cloudinary. Mutation không tự thử lại. */

import { useMutation } from '@tanstack/react-query';

import { requestUploadSignature, uploadToCloudinary } from '../services/uploadService';
import type { PickedImage, UploadPurpose } from '../types/uploadApi';

export function useImageUpload(purpose: UploadPurpose) {
  return useMutation<string, Error, PickedImage>({
    mutationFn: async (image) => {
      const signature = await requestUploadSignature(purpose);
      return uploadToCloudinary(signature, image);
    },
  });
}
