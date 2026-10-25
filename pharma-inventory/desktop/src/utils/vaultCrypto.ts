/**
 * Cloud Vault Cryptography Utility.
 * 
 * Provides End-to-End Encryption (E2EE) for the local SQLite database snapshots
 * using Web Crypto API (AES-256-GCM + PBKDF2-SHA256).
 * 
 * Guarantees that neither the cloud storage provider nor network intermediaries
 * can inspect or access customer inventory, pricing, or billing data.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12; // Standard for AES-GCM

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Derives an AES-GCM 256-bit CryptoKey from a secret passphrase and random salt */
async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKeyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    rawKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts SQLite database bytes into a self-contained base64 string.
 * Format: [16 bytes Salt] + [12 bytes IV] + [AES-GCM Ciphertext + Auth Tag]
 */
export async function encryptVaultData(
  plainBytes: Uint8Array,
  secretPassphrase: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const aesKey = await deriveAesKey(secretPassphrase, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    aesKey,
    plainBytes as unknown as BufferSource
  );

  const cipherBytes = new Uint8Array(cipherBuffer);

  // Combined payload: Salt (16) + IV (12) + Ciphertext
  const totalLength = salt.length + iv.length + cipherBytes.length;
  const combined = new Uint8Array(totalLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);

  return bufferToBase64(combined);
}

/**
 * Decrypts a Cloud Vault base64 payload back to raw SQLite database bytes.
 */
export async function decryptVaultData(
  encryptedBase64: string,
  secretPassphrase: string
): Promise<Uint8Array> {
  const combined = base64ToUint8Array(encryptedBase64);

  if (combined.length < SALT_LENGTH_BYTES + IV_LENGTH_BYTES) {
    throw new Error("Corrupted cloud vault payload: data is too short.");
  }

  const salt = combined.slice(0, SALT_LENGTH_BYTES);
  const iv = combined.slice(SALT_LENGTH_BYTES, SALT_LENGTH_BYTES + IV_LENGTH_BYTES);
  const cipherBytes = combined.slice(SALT_LENGTH_BYTES + IV_LENGTH_BYTES);

  const aesKey = await deriveAesKey(secretPassphrase, salt);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      aesKey,
      cipherBytes as unknown as BufferSource
    );
    return new Uint8Array(plainBuffer);
  } catch {
    throw new Error(
      "Failed to decrypt vault backup. The password or subscription secret key may be incorrect or the data was corrupted."
    );
  }
}

/** Computes SHA-256 hex checksum of byte array */
export async function computeSha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
