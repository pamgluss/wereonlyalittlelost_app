import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TripCard } from "@/components/trip-card";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Trip, createTrip, listTrips } from "@/lib/db";
import { styles } from "@/styles/styles";

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formSlug, setFormSlug] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listTrips();
    setTrips(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function openForm() {
    setFormSlug("");
    setFormDisplayName("");
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setFormError(null);
  }

  async function saveTrip() {
    const slug = formSlug.trim().toLowerCase();
    const displayName = formDisplayName.trim();
    if (!slug || !displayName) {
      setFormError("Both fields are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createTrip({ slug, display_name: displayName });
      setShowForm(false);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE")) {
        setFormError(`A trip with slug "${slug}" already exists.`);
      } else {
        setFormError(msg);
      }
    } finally {
      setSaving(false);
    }
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
        <ThemedView style={styles.headerRow}>
          <ThemedText type="subtitle">Trips</ThemedText>
          {!showForm && (
            <Pressable
              onPress={openForm}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <ThemedText type="link">+ New trip</ThemedText>
            </Pressable>
          )}
        </ThemedView>

        {showForm && (
          <ThemedView type="backgroundElement" style={styles.formCard}>
            <ThemedView style={styles.field}>
              <ThemedText type="smallBold">Slug</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Lowercase folder name, matches{" "}
                <ThemedText type="code">content/trips/</ThemedText> in the blog
                (e.g. <ThemedText type="code">vermont</ThemedText>).
              </ThemedText>
              <TextInput
                value={formSlug}
                onChangeText={setFormSlug}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                placeholder="vermont"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.background,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
              />
            </ThemedView>

            <ThemedView style={styles.field}>
              <ThemedText type="smallBold">Display name</ThemedText>
              <TextInput
                value={formDisplayName}
                onChangeText={setFormDisplayName}
                placeholder="Vermont"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.background,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
              />
            </ThemedView>

            {formError && (
              <ThemedText type="small" style={styles.errorText}>
                {formError}
              </ThemedText>
            )}

            <ThemedView style={styles.buttonRow}>
              <Pressable
                onPress={saveTrip}
                disabled={saving}
                style={({ pressed }) => [
                  styles.button,
                  styles.saveButton,
                  pressed && styles.pressed,
                  saving && styles.disabled,
                ]}
              >
                <ThemedText type="smallBold" style={styles.saveButtonLabel}>
                  {saving ? "Saving…" : "Save"}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={cancelForm}
                disabled={saving}
                style={({ pressed }) => [
                  styles.button,
                  styles.cancelButton,
                  { borderColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        )}

        {loading ? (
          <ThemedText type="small" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : trips.length === 0 ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.emptyState}
          >
            No trips yet. Tap + New trip to start.
          </ThemedText>
        ) : (
          <ThemedView style={styles.list}>
            {trips.map((trip) => (
              <TripCard trip={trip} key={trip.slug} />
            ))}
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}
