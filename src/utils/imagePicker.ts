/** Chọn một ảnh từ thư viện và thu nhỏ trước khi upload. Không dùng camera. */

import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';

import { ApiError } from '../api/errors';
import type { PickedImage } from '../types/uploadApi';

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

/** Trả về ảnh đã chọn, hoặc null khi người dùng huỷ (huỷ không phải là lỗi). */
export async function pickImage(): Promise<PickedImage | null> {
  const permission = await requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new ApiError('Photo access is needed to choose an image.', 'PHOTO_PERMISSION_DENIED', null);
  }

  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset == null) {
    return null;
  }

  // Chỉ thu nhỏ ảnh rộng hơn giới hạn; luôn lưu JPEG để khớp định dạng backend cho phép.
  const resize = asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
  const output = await manipulateAsync(asset.uri, resize, { compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: output.uri, name: 'image.jpg', type: 'image/jpeg' };
}
