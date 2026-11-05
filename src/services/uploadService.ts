/**
 * Two-step image upload: request a signature from the backend, then send the file straight to Cloudinary.
 * Step two uses plain axios instead of apiClient so the Bearer token is not sent to Cloudinary.
 * Not using fetch: Expo replaces the global fetch with expo/fetch, which does not accept a file in the shape { uri, name, type }.
 */

import axios from 'axios';

import { apiClient, unwrapData } from '../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../api/errors';
import type { ApiResponse } from '../types/api';
import type { PickedImage, UploadPurpose, UploadSignature } from '../types/uploadApi';

const UPLOAD_FAILED_CODE = 'UPLOAD_FAILED';
const UPLOAD_TIMEOUT_MS = 60_000;

/** POST /uploads/signature - request a signature for one upload. */
export async function requestUploadSignature(purpose: UploadPurpose): Promise<UploadSignature> {
  const response = await apiClient.post<ApiResponse<UploadSignature>>('/uploads/signature', { purpose });
  return unwrapData(response);
}

/** Send the file to Cloudinary and return secure_url to store on a product or message. */
export async function uploadToCloudinary(signature: UploadSignature, image: PickedImage): Promise<string> {
  const form = new FormData();
  // Parameters must match the values the backend signed, otherwise Cloudinary rejects the signature.
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('public_id', signature.publicId);
  form.append('allowed_formats', signature.allowedFormats);
  form.append('overwrite', String(signature.overwrite));
  form.append('signature', signature.signature);
  // React Native accepts a file in the shape { uri, name, type }; the TypeScript FormData type does not know this shape.
  form.append('file', image as unknown as Blob);

  try {
    const response = await axios.post<{ secure_url?: string }>(signature.uploadUrl, form, {
      timeout: UPLOAD_TIMEOUT_MS,
    });
    if (response.data.secure_url == null) {
      throw new ApiError('Could not upload the image. Please try again.', UPLOAD_FAILED_CODE, response.status);
    }
    return response.data.secure_url;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Having a response means Cloudinary rejected it; only no response is a connection error.
    if (axios.isAxiosError(error) && error.response != null) {
      throw new ApiError('Could not upload the image. Please try again.', UPLOAD_FAILED_CODE, error.response.status);
    }
    throw new ApiError('Could not upload the image. Check your connection.', NETWORK_ERROR_CODE, null);
  }
}
