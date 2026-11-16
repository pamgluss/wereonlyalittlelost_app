import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getCredential } from "@/lib/credentials";
import { Entry, getEntryByTripAndSlug } from "@/lib/db";
import { fetchFileContentsFromRepo } from "@/lib/github";
import { styles, viewStyles } from "@/styles/styles";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ImageMigrationState =
  | "idle"
  | "none"
  | "scanning"
  | "downloading"
  | "uploading"
  | "editing"
  | "committing"
  | "done"
  | "error";

export default function EntryMarkdownScreen() {
  const { tripId, entrySlug } = useLocalSearchParams<{
    tripId: string;
    entrySlug: string;
  }>();

  const id = Number(tripId);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [modalVisible, setModalVisible] = useState(false);
  const [imageMigrationState, setImageMigrationState] =
    useState<ImageMigrationState>("idle");

  async function getAndSetMarkdown() {
    const entryRow = await getEntryByTripAndSlug(id, entrySlug);
    const entry = entryRow;

    if (!entry) return;

    setEntry(entry);

    const contents = entry.body_markdown;
    const markdown = atob(contents);

    setMarkdown(markdown);
  }

  async function migrateImages() {
    const pat = await getCredential("github_pat");
    if (!pat) {
      setImageMigrationState("error");
      return;
    }

    // Regex match on ![20201006_081334](/images/20201006_081334.jpg) in markdown
    // an image in R2 will not have a local path URL in /images/
    setImageMigrationState("scanning");
    const regex = /images\/.+\.[a-z]+/g;
    const matches = markdown.match(regex);

    if (!matches || matches.length === 0) {
      setImageMigrationState("none");
      setTimeout(() => setImageMigrationState("idle"), 2000);
      return;
    }

    const imagePaths = matches;

    // Download image file from GH
    setImageMigrationState("downloading");

    //1, The first step is get the download url.
    const downloadURLPromises = imagePaths.map((path) => {
      const fullPath = `static/${path}`;
      return fetchFileContentsFromRepo({ pat, path: fullPath });
    });

    const downloadURLs = await Promise.all(downloadURLPromises).then(
      (results) => {
        return results.map((result) => {
          return result.download_url;
        });
      },
    );

    console.log(downloadURLs);

    //2, The second step is using the download url to get the file content.
    // Update image to R2
    setImageMigrationState("uploading");

    // Edit markdown contents
    setImageMigrationState("editing");

    // Commit and push page
    setImageMigrationState("committing");

    // If nothing went wrong:
    setImageMigrationState("done");

    // Wait a while then clear the state
    setTimeout(() => setImageMigrationState("idle"), 2000);
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    await getAndSetMarkdown();
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const render = () => {
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
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}
        >
          <View style={viewStyles.centeredView}>
            <View style={viewStyles.modalView}>
              <Text style={styles.modalText}>
                Migrating Images For {entry?.title}
              </Text>
              <Text style={styles.modalText}>{imageMigrationState}</Text>
            </View>
          </View>
        </Modal>

        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">{entry?.title ?? "--"}</ThemedText>
          <Button
            label="Migrate Images To R2 (TODO)"
            onPress={() => {
              setModalVisible(true);
              migrateImages();
            }}
            style={styles.rowButton}
          />
          <ScrollView style={styles.container}>
            <Text selectable style={styles.codeText}>
              {markdown}
            </Text>
          </ScrollView>
        </ThemedView>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Loading…
      </ThemedText>
    );
  } else {
    return render();
  }
}
