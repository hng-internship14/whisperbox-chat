/**
 * Helper to convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Helper to convert String to ArrayBuffer (UTF-8)
 */
export function stringToArrayBuffer(str) {
  return new TextEncoder().encode(str);
}

/**
 * Helper to convert ArrayBuffer to String (UTF-8)
 */
export function arrayBufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}
