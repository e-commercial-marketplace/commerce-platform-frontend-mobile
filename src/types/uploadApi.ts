/** Kiểu dữ liệu của luồng upload ảnh trực tiếp lên Cloudinary (features/upload/API_CONTRACT.md). */

/** Mục đích upload: backend dựa vào đây để kiểm tra quyền và chọn thư mục. */
export type UploadPurpose = 'PRODUCT' | 'CHAT';

/** Body của POST /uploads/signature. */
export type UploadSignatureRequest = {
  purpose: UploadPurpose;
};

/** UploadSignatureResponse: mọi thứ client cần để gửi file thẳng lên Cloudinary. */
export type UploadSignature = {
  uploadUrl: string;
  apiKey: string;
  /** Giây Unix mà chữ ký đã dùng; phải gửi lại đúng giá trị này. */
  timestamp: number;
  publicId: string;
  allowedFormats: string;
  overwrite: boolean;
  signature: string;
};

/** Ảnh đã chọn trên máy, sẵn sàng để upload. */
export type PickedImage = {
  uri: string;
  name: string;
  /** MIME type, ví dụ image/jpeg. */
  type: string;
};
