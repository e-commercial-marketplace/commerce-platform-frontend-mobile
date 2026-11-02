/**
 * Upload ảnh hai bước: xin chữ ký từ backend, rồi gửi file thẳng lên Cloudinary.
 * Bước hai dùng axios gốc, không dùng apiClient, để Bearer token không bị gửi sang Cloudinary.
 * Không dùng fetch: Expo thay fetch toàn cục bằng expo/fetch, bản này không nhận file dạng { uri, name, type }.
 */

import axios from 'axios';

import { apiClient, unwrapData } from '../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../api/errors';
import type { ApiResponse } from '../types/api';
import type { PickedImage, UploadPurpose, UploadSignature } from '../types/uploadApi';

const UPLOAD_FAILED_CODE = 'UPLOAD_FAILED';
const UPLOAD_TIMEOUT_MS = 60_000;

/** POST /uploads/signature — xin chữ ký cho một lần upload. */
export async function requestUploadSignature(purpose: UploadPurpose): Promise<UploadSignature> {
  const response = await apiClient.post<ApiResponse<UploadSignature>>('/uploads/signature', { purpose });
  return unwrapData(response);
}

/** Gửi file lên Cloudinary, trả về secure_url để lưu vào sản phẩm hoặc tin nhắn. */
export async function uploadToCloudinary(signature: UploadSignature, image: PickedImage): Promise<string> {
  const form = new FormData();
  // Tham số phải đúng các giá trị backend đã ký, nếu không Cloudinary từ chối chữ ký.
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('public_id', signature.publicId);
  form.append('allowed_formats', signature.allowedFormats);
  form.append('overwrite', String(signature.overwrite));
  form.append('signature', signature.signature);
  // React Native nhận file dạng { uri, name, type }; kiểu FormData của TypeScript chưa biết dạng này.
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
    // Có response nghĩa là Cloudinary từ chối; không có response mới là lỗi kết nối.
    if (axios.isAxiosError(error) && error.response != null) {
      throw new ApiError('Could not upload the image. Please try again.', UPLOAD_FAILED_CODE, error.response.status);
    }
    throw new ApiError('Could not upload the image. Check your connection.', NETWORK_ERROR_CODE, null);
  }
}
