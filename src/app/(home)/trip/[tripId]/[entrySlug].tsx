import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BLOG_BASE_BRANCH,
  BLOG_OWNER,
  BLOG_REPO,
  TRIPS_LIST_PATH,
} from "@/constants/blog";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getCredential } from "@/lib/credentials";
import {
  Entry,
  getEntryByTripAndSlug,
  getTripById,
  Trip,
  updateEntry,
} from "@/lib/db";
import {
  createCommitWithFiles,
  fetchFileContentsFromRepo,
  GitHubFile,
} from "@/lib/github";
import { getLocalImagePathsFromMarkdown } from "@/lib/markdown-helpers";
import {
  contentTypeFor,
  formatR2KeyFromPath,
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_PUBLIC_URL_BASE,
  uploadToR2,
} from "@/lib/r2";
import { styles, viewStyles } from "@/styles/styles";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
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
  const [trip, setTrip] = useState<Trip | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [modalVisible, setModalVisible] = useState(false);
  const [imageMigrationState, setImageMigrationState] =
    useState<ImageMigrationState>("idle");
  const [branchUrl, setBranchUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);

  async function getAndSetMarkdown() {
    const entryRow = await getEntryByTripAndSlug(id, entrySlug);
    const entry = entryRow;

    if (!entry) return;

    setEntry(entry);

    const contents = entry.body_markdown;
    let markdown = "";
    try {
      markdown = atob(contents);
    } catch (err) {
      setErrorMessage(String(err));
      return;
    }

    setMarkdown(markdown);
    // Regex match on ![20201006_081334](/images/20201006_081334.jpg) in markdown
    // an image in R2 will not have a local path URL in /images/
    setImageMigrationState("scanning");
    const matches = getLocalImagePathsFromMarkdown(markdown);
    setImagePaths(matches || []);

    const tripDetails = await getTripById(id);
    setTrip(tripDetails);
  }

  async function migrateImages() {
    if (!entry || !trip) return;
    setErrorMessage("");

    const pat = await getCredential("github_pat");
    if (!pat) {
      setImageMigrationState("error");
      setErrorMessage("You need a PAT token");
      return;
    }

    const accessKeyId = await getCredential("r2_access_key_id");
    const secretAccessKey = await getCredential("r2_secret_access_key");
    if (!accessKeyId || !secretAccessKey) {
      setImageMigrationState("error");
      setErrorMessage("You need to set up R2 key and/or secret access key");
      return;
    }

    const imageFullPaths = imagePaths.map((path) => `static/${path}`);

    // Download image file from GH
    setImageMigrationState("downloading");

    //1, The first step is get the download url from Github
    const downloadURLPromises = imageFullPaths.map((path) => {
      return fetchFileContentsFromRepo({ pat, path });
    });

    const downloadImages = await Promise.all(downloadURLPromises).then(
      (results) => {
        return results.map((result) => {
          return fetch(result.download_url);
        });
      },
    );

    //2, The second step is using the download url to get the file content.
    const fetchResults = await Promise.all(downloadImages).then((results) => {
      return results.map((result) => {
        return result.arrayBuffer();
      });
    });

    // Then transform that content into the format R2 expects
    const uploadPromises = await Promise.all(fetchResults).then((results) => {
      return results.map((result, index) => {
        const key = formatR2KeyFromPath(imagePaths[index], trip.slug);
        const buffer = new Uint8Array(result);
        return uploadToR2({
          accessKeyId,
          secretAccessKey,
          accountId: R2_ACCOUNT_ID,
          bucket: R2_BUCKET,
          key,
          body: buffer,
          contentType: contentTypeFor(key),
          publicUrlBase: R2_PUBLIC_URL_BASE,
        });
      });
    });

    // Update image to R2
    setImageMigrationState("uploading");
    const r2PublicUrls = await Promise.all(uploadPromises).then(
      (uploadResults) => {
        return uploadResults.map((upload) => {
          return upload.publicUrl;
        });
      },
    );

    // Edit markdown contents
    setImageMigrationState("editing");
    // So the R2 address is https://pub-6552d22062234bd394ccc7a815d71ba7.r2.dev/images/20201006_081334.jpg
    // Edit the contents in place:
    let editedMarkdown = markdown;
    imagePaths.forEach((path, index) => {
      editedMarkdown = editedMarkdown.replace(`/${path}`, r2PublicUrls[index]);
    });

    // Commit and push branch for page
    // Delete the images too
    setImageMigrationState("committing");
    const timestamp = Date.now();
    const newBranch = `app-migrate-${entrySlug}-images-${timestamp}`;

    if (!trip || !trip.slug) {
      setImageMigrationState("error");
      setErrorMessage("Trip couldnt be found");
      return;
    }
    try {
      const files: GitHubFile[] = [
        {
          path: `${TRIPS_LIST_PATH}/${trip.slug}/${entry?.slug}.md`,
          content: editedMarkdown,
          encoding: "utf-8",
        },
      ];

      const result = await createCommitWithFiles({
        pat,
        owner: BLOG_OWNER,
        repo: BLOG_REPO,
        baseBranch: BLOG_BASE_BRANCH,
        newBranch,
        commitMessage: `exclude - migrate images for ${entrySlug} to R2`,
        files,
        deletePaths: imageFullPaths,
      });

      setBranchUrl(result.branchUrl);
    } catch (err) {
      setErrorMessage(String(err));
      setImageMigrationState("error");
    }

    // If nothing went wrong:
    setImageMigrationState("done");

    await updateEntry(entry.id, {
      // body_markdown is stored base64-encoded (as GitHub returns it)
      body_markdown: btoa(editedMarkdown),
    });
    setMarkdown(editedMarkdown);

    // Wait a while then clear the state
    setTimeout(() => setImageMigrationState("idle"), 2000);
    setModalVisible(false);
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
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
            </View>
          </View>
        </Modal>

        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">{entry?.title ?? "--"}</ThemedText>
          <Button
            label="Migrate Images To R2"
            onPress={() => {
              setModalVisible(true);
              migrateImages();
            }}
            disabled={imagePaths.length === 0}
            style={styles.rowButton}
          />
          <Button
            label="Edit Markdown TODO"
            onPress={() => {
              console.log("TODO");
            }}
            disabled={imageMigrationState != "idle"}
            style={styles.rowButton}
          />
          {branchUrl ? (
            <Pressable onPress={() => Linking.openURL(branchUrl)}>
              <ThemedText type="link" style={styles.resultLink}>
                View Branch →
              </ThemedText>
            </Pressable>
          ) : null}
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
