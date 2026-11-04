/** Types for the direct image upload flow to Cloudinary (features/upload/API_CONTRACT.md). */

/** Upload purpose: the backend uses it to check permissions and choose the folder. */
export type UploadPurpose = 'PRODUCT' | 'CHAT';

/** Body of POST /uploads/signature. */
export type UploadSignatureRequest = {
  purpose: UploadPurpose;
};

/** UploadSignatureResponse: everything the client needs to send the file straight to Cloudinary. */
export type UploadSignature = {
  uploadUrl: string;
  apiKey: string;
  /** Unix seconds used by the signature; this exact value must be sent back. */
  timestamp: number;
  publicId: string;
  allowedFormats: string;
  overwrite: boolean;
  signature: string;
};

/** Image picked on the device, ready to upload. */
export type PickedImage = {
  uri: string;
  name: string;
  /** MIME type, e.g. image/jpeg. */
  type: string;
};
