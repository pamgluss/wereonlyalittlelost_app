import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TRIPS_LIST_PATH } from "@/constants/blog";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getCredential } from "@/lib/credentials";
import {
  createEntry,
  CreateEntryInput,
  Entry,
  getEntryByTripAndSlug,
  getTripById,
  listEntriesByTripId,
  markTripSynced,
  Trip,
  updateEntry,
} from "@/lib/db";
import {
  fetchDirectoryContentsFromRepo,
  fetchFileContentsFromRepo,
  GithubContentsAPIResp,
} from "@/lib/github";
import { parseMarkdownHeading } from "@/lib/markdown-helpers";
import { styles } from "@/styles/styles";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const id = Number(tripId);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function getAndSetEntries() {
    const rows = await listEntriesByTripId(id);
    setEntries(rows);
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    const tripDetails = await getTripById(id);
    setTrip(tripDetails);
    await getAndSetEntries();
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function handleSyncEntries(trip: Trip | null) {
    if (!trip) {
      setError("No trip");
      return;
    }

    setSyncing(true);
    setError("");

    const pat = await getCredential("github_pat");
    if (!pat) {
      setError("Missing PAT token - cannot sync");
      setSyncing(false);
      return;
    }

    try {
      // Get all the files in the trip slug directory that are NOT _index.html
      const directoryContents = await fetchDirectoryContentsFromRepo({
        pat,
        path: `${TRIPS_LIST_PATH}/${trip.slug}`,
      });

      const githubFetchPromises: Promise<GithubContentsAPIResp>[] = [];
      const dbFetchPromises: Promise<Entry | null>[] = [];
      directoryContents.forEach((file) => {
        // ignore index
        if (file.name === "_index.html") {
          return;
        }
        githubFetchPromises.push(
          fetchFileContentsFromRepo({
            pat,
            path: `${TRIPS_LIST_PATH}/${trip.slug}/${file.name}`,
          }),
        );

        const slug = file.name.replace(new RegExp(".md" + "$"), "");

        dbFetchPromises.push(getEntryByTripAndSlug(trip.id, slug));
      });

      // Either way we will read the file so we can sync or create
      const ghFiles = await Promise.all(githubFetchPromises);
      const dbEntries = await Promise.all(dbFetchPromises);

      const dbWritesPromises = [];

      for (let i = 0; i < ghFiles.length; i++) {
        const file = ghFiles[i];
        const dbEntry = dbEntries[i];
        const dbId = dbEntry?.id;

        const frontmatter = parseMarkdownHeading(file.content);

        const slug = file.name.replace(new RegExp(".md" + "$"), "");
        const syncedEntry: CreateEntryInput = {
          trip_id: trip.id,
          slug: slug,
          title: frontmatter.title,
          date: frontmatter.date,
          tags: frontmatter.tags ?? [],
          difficulty: frontmatter.difficulty,
          rating: frontmatter.rating,
          draft: Boolean(frontmatter.draft),
          body_markdown: file.content,
          writer_source: "blog",
        };

        if (dbId) {
          dbWritesPromises.push(updateEntry(dbId, syncedEntry));
        } else {
          dbWritesPromises.push(createEntry(syncedEntry));
        }
      }

      await Promise.all(dbWritesPromises);
      await markTripSynced(trip.id);

      setError("");

      getAndSetEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const render = () => {
    if (loading) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Loading…
        </ThemedText>
      );
    }

    if (entries.length === 0) {
      return (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.emptyState}
        >
          No entries for this trip yet. Sync it, or add a new entry.
        </ThemedText>
      );
    }

    return (
      <ThemedView style={styles.list}>
        {entries.map((entry) => (
          <ThemedView
            key={entry.id}
            type="backgroundElement"
            style={styles.entryCard}
          >
            <ThemedText type="smallBold">{entry.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {entry.date}
              {entry.draft ? " · Draft" : ""}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.buttonRow}>
              <Button
                label="View Markdown"
                onPress={() =>
                  router.push({
                    pathname: "/trip/[tripId]/[entrySlug]",
                    params: {
                      tripId: String(trip?.id),
                      entrySlug: String(entry.slug),
                    },
                  })
                }
                style={styles.rowButton}
              />
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
        },
      ]}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">
          {trip?.display_name ?? "Unknown"}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.buttonRow}>
          <Button
            label="New Entry"
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/newEntry",
                params: { tripId: String(trip?.id) },
              })
            }
            style={styles.rowButton}
            disabled={loading}
          />
          <Button
            label={syncing ? "Sync In Progress.." : "Sync Trip Entries"}
            onPress={() => handleSyncEntries(trip)}
            style={styles.rowButton}
            disabled={loading}
          />
        </ThemedView>
        {error ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.helpText}
          >
            {error}
          </ThemedText>
        ) : null}
        {render()}
      </ThemedView>
    </ScrollView>
  );
}
