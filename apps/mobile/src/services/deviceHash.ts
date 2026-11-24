import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_UUID_STORAGE_KEY = 'golisafe:device_install_uuid:v1';
const HASH_SALT = 'golisafe-dhaka-zero-pii-salt-v1::';

let cachedDeviceHash: string | null = null;

function generateFallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getOrCreateInstallUuid(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_UUID_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
  } catch {
    // Fall through to generate a fresh UUID
  }

  let freshUuid: string;
  try {
    freshUuid =
      typeof Crypto.randomUUID === 'function'
        ? Crypto.randomUUID()
        : generateFallbackUuid();
  } catch {
    freshUuid = generateFallbackUuid();
  }

  try {
    await AsyncStorage.setItem(DEVICE_UUID_STORAGE_KEY, freshUuid);
  } catch {
    // Non-fatal if storage is unavailable
  }

  return freshUuid;
}

/**
 * FR-02: Computes a non-reversible salted SHA-256 hash of the persisted
 * random installation UUID (zero PII — no IMEI, MAC, phone, or name).
 */
export async function getDeviceHash(): Promise<string> {
  if (cachedDeviceHash) {
    return cachedDeviceHash;
  }

  const installUuid = await getOrCreateInstallUuid();
  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${HASH_SALT}${installUuid}`,
    );
    cachedDeviceHash = digest;
    return digest;
  } catch {
    cachedDeviceHash = installUuid;
    return installUuid;
  }
}
