/**
 * Upload ảnh: xin chữ ký qua apiClient, gửi file lên Cloudinary bằng axios gốc (không kèm Bearer token).
 */

import axios, { AxiosError, type AxiosResponse } from 'axios';

import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { PickedImage, UploadSignature } from '../../types/uploadApi';
import { requestUploadSignature, uploadToCloudinary } from '../uploadService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return { ...actual, apiClient: { post: jest.fn() } };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const signature: UploadSignature = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  apiKey: 'key',
  timestamp: 1700000000,
  publicId: 'marketplace/products/u1/abc',
  allowedFormats: 'jpg,png,webp',
  overwrite: false,
  signature: 'sig',
};
const image: PickedImage = { uri: 'file:///photo.jpg', name: 'image.jpg', type: 'image/jpeg' };

describe('uploadService', () => {
  let post: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    post = jest.spyOn(axios, 'post');
  });

  afterEach(() => {
    post.mockRestore();
  });

  it('asks the backend for a signature', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { success: true, data: signature, error: null }, status: 200 });

    await expect(requestUploadSignature('CHAT')).resolves.toEqual(signature);
    expect(mockedClient.post).toHaveBeenCalledWith('/uploads/signature', { purpose: 'CHAT' });
  });

  it('posts exactly the signed fields through axios, not fetch, with no Authorization header', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as never);
    post.mockResolvedValueOnce({ status: 200, data: { secure_url: 'https://img/a.jpg' } });

    await expect(uploadToCloudinary(signature, image)).resolves.toBe('https://img/a.jpg');

    expect(append.mock.calls).toEqual([
      ['api_key', 'key'],
      ['timestamp', '1700000000'],
      ['public_id', 'marketplace/products/u1/abc'],
      ['allowed_formats', 'jpg,png,webp'],
      ['overwrite', 'false'],
      ['signature', 'sig'],
      ['file', image],
    ]);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe(signature.uploadUrl);
    expect(body).toBeInstanceOf(FormData);
    expect(config.headers).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    append.mockRestore();
    fetchSpy.mockRestore();
  });

  it('turns a Cloudinary rejection into an ApiError', async () => {
    const response = { status: 401, data: { error: { message: 'Bad signature' } } } as AxiosResponse;
    post.mockRejectedValueOnce(new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response));

    await expect(uploadToCloudinary(signature, image)).rejects.toMatchObject({ code: 'UPLOAD_FAILED', status: 401 });
  });

  it('rejects a success response without a secure_url', async () => {
    post.mockResolvedValueOnce({ status: 200, data: {} });

    await expect(uploadToCloudinary(signature, image)).rejects.toMatchObject({ code: 'UPLOAD_FAILED', status: 200 });
  });

  it('turns a network failure into an ApiError', async () => {
    post.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));

    const failure = uploadToCloudinary(signature, image);
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: null });
  });
});
