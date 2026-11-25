import { PLACEHOLDER_PNG_BASE64, PLACEHOLDER_PNG_BYTES } from '@/lib/placeholder-image';

describe('placeholder-image', () => {
  test('decodes the base64 placeholder into PNG bytes', () => {
    // Every PNG starts with the same 8-byte signature.
    expect(Array.from(PLACEHOLDER_PNG_BYTES.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(PLACEHOLDER_PNG_BYTES.length).toBe(atob(PLACEHOLDER_PNG_BASE64).length);
  });
});
