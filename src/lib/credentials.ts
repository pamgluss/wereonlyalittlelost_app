import * as SecureStore from 'expo-secure-store';

export type CredentialKey =
  | 'github_pat'
  | 'r2_access_key_id'
  | 'r2_secret_access_key'
  | 'google_places_key';

export const CREDENTIAL_KEYS: readonly CredentialKey[] = [
  'github_pat',
  'r2_access_key_id',
  'r2_secret_access_key',
  'google_places_key',
] as const;

export const CREDENTIAL_LABELS: Record<CredentialKey, string> = {
  github_pat: 'GitHub Personal Access Token',
  r2_access_key_id: 'Cloudflare R2 Access Key ID',
  r2_secret_access_key: 'Cloudflare R2 Secret Access Key',
  google_places_key: 'Google Places API Key',
};

export async function getCredential(key: CredentialKey): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setCredential(key: CredentialKey, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, trimmed);
}

export async function clearAllCredentials(): Promise<void> {
  await Promise.all(CREDENTIAL_KEYS.map((k) => SecureStore.deleteItemAsync(k)));
}

export async function getAllCredentials(): Promise<Record<CredentialKey, string>> {
  const entries = await Promise.all(
    CREDENTIAL_KEYS.map(async (k) => [k, (await getCredential(k)) ?? ''] as const),
  );
  return Object.fromEntries(entries) as Record<CredentialKey, string>;
}
