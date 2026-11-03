/** Upload one image for a purpose and return the Cloudinary URL. The mutation does not retry automatically. */

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
