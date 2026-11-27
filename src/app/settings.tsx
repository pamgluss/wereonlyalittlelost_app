import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TRIPS_LIST_PATH } from "@/constants/blog";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  clearAllCredentials,
  CREDENTIAL_KEYS,
  CREDENTIAL_LABELS,
  CredentialKey,
  getAllCredentials,
  getCredential,
  setCredential,
} from "@/lib/credentials";
import { createTrip, getTripBySlug, Trip } from "@/lib/db";
import {
  fetchFileContentsFromRepo,
  fetchTripsFromRepo,
  GithubContentsAPIResp,
} from "@/lib/github";
import { parseMarkdownHeading } from "@/lib/markdown-helpers";
import { settingsStyles } from "@/styles/settings";

type Values = Record<CredentialKey, string>;

const EMPTY_VALUES: Values = {
  github_pat: "",
  r2_access_key_id: "",
  r2_secret_access_key: "",
  google_places_key: "",
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
  const [syncing, setSyncing] = useState(false);

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
    await Promise.all(CREDENTIAL_KEYS.map((k) => setCredential(k, values[k])));
    setStatus("Saved");
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleSyncTrips() {
    setStatus(null);
    const pat = await getCredential("github_pat");
    if (!pat) {
      setStatus("No GitHub PAT in storage. Set it in the Settings tab first.");
      setTimeout(() => setStatus(null), 2000);
      return;
    }

    setSyncing(true);

    try {
      const tripsList = await fetchTripsFromRepo({ pat });

      const slugs: string[] = [];
      const getIndexHTMLPromises: Promise<GithubContentsAPIResp>[] = [];
      let titles: string[] = [];

      tripsList.forEach((trip) => {
        slugs.push(trip.name);
        getIndexHTMLPromises.push(
          fetchFileContentsFromRepo({
            pat,
            path: `${TRIPS_LIST_PATH}/${trip.name}/_index.html`,
          }),
        );
      });

      const results = await Promise.all(getIndexHTMLPromises);
      titles = results.map((result) => {
        const frontmatter = parseMarkdownHeading(result.content);

        return frontmatter.title;
      });

      // Now sync
      const createTripPromises: Promise<Trip>[] = [];
      slugs.forEach(async (slug, index) => {
        const existingTrip = await getTripBySlug(slug);
        if (existingTrip === null) {
          createTripPromises.push(
            createTrip({
              slug,
              display_name: titles[index],
            }),
          );
        }
      });

      await Promise.all(createTripPromises);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
      setTimeout(() => setStatus(null), 2000);
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearAll() {
    await clearAllCredentials();
    setValues(EMPTY_VALUES);
    setStatus("Cleared");
    setTimeout(() => setStatus(null), 2000);
  }

  const contentPaddingBottom = insets.bottom + BottomTabInset + Spacing.four;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        settingsStyles.contentContainer,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: contentPaddingBottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedView style={settingsStyles.container}>
        <ThemedText type="subtitle" style={settingsStyles.title}>
          Admin
        </ThemedText>
        <ThemedView style={settingsStyles.buttonRow}>
          <Button
            label={syncing ? "Sync In Progress.." : "Sync Trips"}
            onPress={handleSyncTrips}
            disabled={loading}
            style={settingsStyles.rowButton}
          />
        </ThemedView>
        <ThemedText type="subtitle" style={settingsStyles.title}>
          Credentials
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={settingsStyles.helpText}
        >
          Stored locally in secure storage (Android Keystore). Nothing is
          bundled with the app.
        </ThemedText>

        {CREDENTIAL_KEYS.map((key) => (
          <ThemedView key={key} style={settingsStyles.field}>
            <ThemedView style={settingsStyles.fieldHeader}>
              <ThemedText type="smallBold">{CREDENTIAL_LABELS[key]}</ThemedText>
              {values[key].length > 0 && (
                <Pressable
                  onPress={() => setHidden((h) => ({ ...h, [key]: !h[key] }))}
                  hitSlop={8}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    {hidden[key] ? "Show" : "Hide"}
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
              placeholder={loading ? "Loading…" : "paste value"}
              placeholderTextColor={theme.textSecondary}
              style={[
                settingsStyles.input,
                {
                  borderColor: theme.backgroundElement,
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
          </ThemedView>
        ))}

        <ThemedView style={settingsStyles.buttonRow}>
          <Button
            label="Save"
            onPress={handleSave}
            disabled={loading}
            style={settingsStyles.rowButton}
          />
          <Button
            label="Clear all"
            variant="secondary"
            onPress={handleClearAll}
            disabled={loading}
            style={settingsStyles.rowButton}
          />
        </ThemedView>

        {status && (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={settingsStyles.status}
          >
            {status}
          </ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
}
