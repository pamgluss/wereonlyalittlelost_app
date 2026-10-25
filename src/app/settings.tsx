import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CREDENTIAL_KEYS,
  CREDENTIAL_LABELS,
  CredentialKey,
  clearAllCredentials,
  getAllCredentials,
  setCredential,
} from '@/lib/credentials';

type Values = Record<CredentialKey, string>;

const EMPTY_VALUES: Values = {
  github_pat: '',
  r2_access_key_id: '',
  r2_secret_access_key: '',
  google_places_key: '',
};

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [hidden, setHidden] = useState<Record<CredentialKey, boolean>>({
    github_pat: false,
    r2_access_key_id: false,
    r2_secret_access_key: false,
    google_places_key: false,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getAllCredentials();
      setValues(stored);
      setHidden({
        github_pat: !!stored.github_pat,
        r2_access_key_id: !!stored.r2_access_key_id,
        r2_secret_access_key: !!stored.r2_secret_access_key,
        google_places_key: !!stored.google_places_key,
      });
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setStatus(null);
    await Promise.all(
      CREDENTIAL_KEYS.map((k) => setCredential(k, values[k])),
    );
    setStatus('Saved');
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleClearAll() {
    await clearAllCredentials();
    setValues(EMPTY_VALUES);
    setStatus('Cleared');
    setTimeout(() => setStatus(null), 2000);
  }

  const contentPaddingBottom = insets.bottom + BottomTabInset + Spacing.four;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + Spacing.four, paddingBottom: contentPaddingBottom },
      ]}
      keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Credentials
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.helpText}>
          Stored locally in secure storage (Android Keystore). Nothing is bundled with the app.
        </ThemedText>

        {CREDENTIAL_KEYS.map((key) => (
          <ThemedView key={key} style={styles.field}>
            <ThemedView style={styles.fieldHeader}>
              <ThemedText type="smallBold">{CREDENTIAL_LABELS[key]}</ThemedText>
              {values[key].length > 0 && (
                <Pressable
                  onPress={() => setHidden((h) => ({ ...h, [key]: !h[key] }))}
                  hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {hidden[key] ? 'Show' : 'Hide'}
                  </ThemedText>
                </Pressable>
              )}
            </ThemedView>
            <TextInput
              value={values[key]}
              onChangeText={(text) => setValues((v) => ({ ...v, [key]: text }))}
              editable={!loading}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              secureTextEntry={hidden[key]}
              placeholder={loading ? 'Loading…' : 'paste value'}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  borderColor: theme.backgroundElement,
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
          </ThemedView>
        ))}

        <ThemedView style={styles.buttonRow}>
          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              styles.saveButton,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={styles.saveButtonLabel}>
              Save
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleClearAll}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              styles.clearButton,
              { borderColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Clear all</ThemedText>
          </Pressable>
        </ThemedView>

        {status && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
            {status}
          </ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  helpText: {
    textAlign: 'center',
  },
  field: {
    gap: Spacing.one,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    fontFamily: 'monospace',
    minHeight: 44,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#208AEF',
  },
  saveButtonLabel: {
    color: 'white',
  },
  clearButton: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  status: {
    textAlign: 'center',
  },
});
