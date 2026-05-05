import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringToArrayBuffer,
  arrayBufferToString,
} from './utils';

const RSA_PARAMS = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const AES_GCM_PARAMS = {
  name: 'AES-GCM',
  length: 256,
};

const PBKDF2_PARAMS = {
  name: 'PBKDF2',
  iterations: 100000,
  hash: 'SHA-256',
};

/**
 * Generate a new RSA-OAEP key pair
 */
export async function generateIdentityKeys() {
  const keyPair = await window.crypto.subtle.generateKey(
    RSA_PARAMS,
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicKey),
    privateKey: arrayBufferToBase64(privateKey),
  };
}

/**
 * Derive a wrapping key from a password and salt
 */
export async function deriveWrappingKey(password, saltBase64) {
  const passwordBuffer = stringToArrayBuffer(password);
  const salt = base64ToArrayBuffer(saltBase64);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      ...PBKDF2_PARAMS,
      salt: salt,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap the private key using the derived wrapping key (using AES-GCM)
 */
export async function wrapPrivateKey(privateKeyBase64, wrappingKey) {
  const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    privateKeyBuffer
  );

  // Combine IV + Encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Import a base64 private key into a CryptoKey object
 */
export async function importPrivateKey(privateKeyBase64) {
  return await window.crypto.subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(privateKeyBase64),
    RSA_PARAMS,
    false,
    ['decrypt']
  );
}

/**
 * Unwrap the private key using the derived wrapping key (using AES-GCM)
 */
export async function unwrapPrivateKey(wrappedKeyBase64, wrappingKey) {
  const combinedBuffer = base64ToArrayBuffer(wrappedKeyBase64);
  const combined = new Uint8Array(combinedBuffer);
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    encrypted
  );

  return arrayBufferToBase64(decrypted);
}

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessage(plaintext, recipientPublicKeyBase64, senderPublicKeyBase64) {
  // 1. Generate a random AES-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    AES_GCM_PARAMS,
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt the plaintext
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    stringToArrayBuffer(plaintext)
  );

  // 3. Export the AES key
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 4. Import public keys
  const recipientPublicKey = await window.crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(recipientPublicKeyBase64),
    RSA_PARAMS,
    false,
    ['encrypt']
  );

  const senderPublicKey = await window.crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(senderPublicKeyBase64),
    RSA_PARAMS,
    false,
    ['encrypt']
  );

  // 5. Wrap the AES key for both recipient and sender
  const encryptedKey = await window.crypto.subtle.encrypt(
    RSA_PARAMS,
    recipientPublicKey,
    exportedAesKey
  );

  const encryptedKeyForSelf = await window.crypto.subtle.encrypt(
    RSA_PARAMS,
    senderPublicKey,
    exportedAesKey
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    encryptedKey: arrayBufferToBase64(encryptedKey),
    encryptedKeyForSelf: arrayBufferToBase64(encryptedKeyForSelf),
  };
}

/**
 * Decrypt a message using the private key (accepts base64 or CryptoKey)
 */
export async function decryptMessage(payload, privateKeyInput) {
  const { ciphertext, iv, encryptedKey, encryptedKeyForSelf } = payload;

  // 1. Get the private key object
  let privateKey;
  if (typeof privateKeyInput === 'string') {
    privateKey = await importPrivateKey(privateKeyInput);
  } else {
    privateKey = privateKeyInput;
  }

  // 2. Try to decrypt the AES key
  let wrappedAesKey;
  try {
    wrappedAesKey = await window.crypto.subtle.decrypt(
      RSA_PARAMS,
      privateKey,
      base64ToArrayBuffer(encryptedKey)
    );
  } catch (e) {
    // If recipient decrypt fails, try self decrypt (useful for history)
    wrappedAesKey = await window.crypto.subtle.decrypt(
      RSA_PARAMS,
      privateKey,
      base64ToArrayBuffer(encryptedKeyForSelf)
    );
  }

  // 3. Import the AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    wrappedAesKey,
    AES_GCM_PARAMS,
    false,
    ['decrypt']
  );

  // 4. Decrypt the ciphertext
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
    aesKey,
    base64ToArrayBuffer(ciphertext)
  );

  return arrayBufferToString(decrypted);
}

/**
 * Generate a random salt for PBKDF2
 */
export function generateSalt() {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt);
}
