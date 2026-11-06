import { TRIPS_LIST_PATH } from "@/constants/blog";
import { Spacing } from "@/constants/theme";
import { getCredential } from "@/lib/credentials";
import {
    createEntry,
    CreateEntryInput,
    Entry,
    getEntryByTripAndSlug,
    Trip,
    updateEntry,
} from "@/lib/db";
import {
    fetchDirectoryContentsFromRepo,
    fetchFileContentsFromRepo,
    GithubContentsAPIResp,
    parseMarkdownHeading,
} from "@/lib/github";
import { styles } from "@/styles/settings";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { Button } from "./button";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

type TripProps = {
  key: string;
  trip: Trip;
};

export function TripCard({ trip }: TripProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function handleShowTripEntries(trip: Trip) {}

  async function handleSyncEntries(trip: Trip) {
    setSyncing(true);
    setError("");

    const pat = await getCredential("github_pat");
    if (!pat) {
      setError("Missing PAT token - cannot sync");
      setSyncing(false);
      return;
    }

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
        draft: frontmatter.draft ?? false,
        body_markdown: file.content,
      };

      if (dbId) {
        dbWritesPromises.push(updateEntry(dbId, syncedEntry));
      } else {
        dbWritesPromises.push(createEntry(syncedEntry));
      }
    }

    await Promise.all(dbWritesPromises);
    setError("");
    setSyncing(false);
  }

  return (
    <ThemedView
      key={trip.id}
      type="backgroundElement"
      style={tripCardStyles.tripCard}
    >
      <ThemedText type="smallBold">{trip.display_name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        <ThemedText type="code">{trip.slug}</ThemedText> · created{" "}
        {new Date(trip.created_at).toLocaleDateString()}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.buttonRow}>
        <Button
          label={syncing ? "Sync In Progress.." : "Sync Trip Entries"}
          onPress={() => handleSyncEntries(trip)}
          style={styles.rowButton}
          disabled={syncing}
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
    </ThemedView>
  );
}

const tripCardStyles = StyleSheet.create({
  tripCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
});
