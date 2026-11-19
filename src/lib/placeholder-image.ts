export const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR4nGP4z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const PLACEHOLDER_PNG_BYTES = base64ToBytes(PLACEHOLDER_PNG_BASE64);
