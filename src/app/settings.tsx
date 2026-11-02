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
import { styles } from "@/styles/settings";
import YAML from "yaml";

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
    // name and github url
    // so make a list of promises for fetch
    const results = await Promise.all(getIndexHTMLPromises);
    titles = results.map((result) => {
      const content = atob(result.content);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch === null) return "";
      const frontmatter = YAML.parse(frontmatterMatch[1]);
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
    setSyncing(false);
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
        styles.contentContainer,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: contentPaddingBottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Admin
        </ThemedText>
        <ThemedView style={styles.buttonRow}>
          <Button
            label={syncing ? "Sync In Progress.." : "Sync Trips"}
            onPress={handleSyncTrips}
            disabled={loading}
            style={styles.rowButton}
          />
        </ThemedView>
        <ThemedText type="subtitle" style={styles.title}>
          Credentials
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.helpText}
        >
          Stored locally in secure storage (Android Keystore). Nothing is
          bundled with the app.
        </ThemedText>

        {CREDENTIAL_KEYS.map((key) => (
          <ThemedView key={key} style={styles.field}>
            <ThemedView style={styles.fieldHeader}>
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
          <Button
            label="Save"
            onPress={handleSave}
            disabled={loading}
            style={styles.rowButton}
          />
          <Button
            label="Clear all"
            variant="secondary"
            onPress={handleClearAll}
            disabled={loading}
            style={styles.rowButton}
          />
        </ThemedView>

        {status && (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.status}
          >
            {status}
          </ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
}
