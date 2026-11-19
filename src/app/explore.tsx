import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BLOG_BASE_BRANCH, BLOG_OWNER, BLOG_REPO } from "@/constants/blog";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { styles as sharedStyles } from "@/styles/styles";
import { getCredential } from "@/lib/credentials";
import { createCommitWithFiles } from "@/lib/github";
import {
  PLACEHOLDER_PNG_BASE64,
  PLACEHOLDER_PNG_BYTES,
} from "@/lib/placeholder-image";
import { Place, searchPlaces } from "@/lib/places";
import {
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_PUBLIC_URL_BASE,
  uploadToR2,
} from "@/lib/r2";

type RunState = "idle" | "running" | "success" | "error";

export default function ScratchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [githubState, setGithubState] = useState<RunState>("idle");
  const [githubLog, setGithubLog] = useState<string[]>([]);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubBranchUrl, setGithubBranchUrl] = useState<string | null>(null);

  const [r2State, setR2State] = useState<RunState>("idle");
  const [r2Log, setR2Log] = useState<string[]>([]);
  const [r2Error, setR2Error] = useState<string | null>(null);
  const [r2PublicUrl, setR2PublicUrl] = useState<string | null>(null);

  const [placesQuery, setPlacesQuery] = useState(
    "Idletime Brewing Company Stowe VT",
  );
  const [placesState, setPlacesState] = useState<RunState>("idle");
  const [placesResults, setPlacesResults] = useState<Place[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);

  async function runGithubTest() {
    setGithubState("running");
    setGithubLog([]);
    setGithubError(null);
    setGithubBranchUrl(null);

    const pat = await getCredential("github_pat");
    if (!pat) {
      setGithubError(
        "No GitHub PAT in storage. Set it in the Settings tab first.",
      );
      setGithubState("error");
      return;
    }

    const timestamp = Date.now();
    const newBranch = `claude-test-${timestamp}`;
    const markdown = `# Claude Phase 1 Test\n\nThis commit was created by the trip-companion app to verify the GitHub Git Data API multi-file commit flow.\n\n- Branch: \`${newBranch}\`\n- Timestamp: ${new Date(timestamp).toISOString()}\n\nSafe to delete.\n`;

    try {
      const result = await createCommitWithFiles({
        pat,
        owner: BLOG_OWNER,
        repo: BLOG_REPO,
        baseBranch: BLOG_BASE_BRANCH,
        newBranch,
        commitMessage: `Phase 1 scratch test (${newBranch})`,
        files: [
          {
            path: ".claude-test/note.md",
            content: markdown,
            encoding: "utf-8",
          },
          {
            path: ".claude-test/pixel.png",
            content: PLACEHOLDER_PNG_BASE64,
            encoding: "base64",
          },
        ],
        onStep: (msg) => setGithubLog((prev) => [...prev, msg]),
      });
      setGithubBranchUrl(result.branchUrl);
      setGithubState("success");
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : String(err));
      setGithubState("error");
    }
  }

  async function runR2Test() {
    setR2State("running");
    setR2Log([]);
    setR2Error(null);
    setR2PublicUrl(null);

    const accessKeyId = await getCredential("r2_access_key_id");
    const secretAccessKey = await getCredential("r2_secret_access_key");
    if (!accessKeyId || !secretAccessKey) {
      setR2Error(
        "No R2 credentials in storage. Set them in the Settings tab first.",
      );
      setR2State("error");
      return;
    }

    const timestamp = Date.now();
    const key = `.claude-test/pixel-${timestamp}.png`;

    try {
      const result = await uploadToR2({
        accessKeyId,
        secretAccessKey,
        accountId: R2_ACCOUNT_ID,
        bucket: R2_BUCKET,
        key,
        body: PLACEHOLDER_PNG_BYTES,
        contentType: "image/png",
        publicUrlBase: R2_PUBLIC_URL_BASE,
        onStep: (msg) => setR2Log((prev) => [...prev, msg]),
      });
      setR2PublicUrl(result.publicUrl);
      setR2State("success");
    } catch (err) {
      setR2Error(err instanceof Error ? err.message : String(err));
      setR2State("error");
    }
  }

  async function runPlacesTest() {
    setPlacesState("running");
    setPlacesResults([]);
    setPlacesError(null);

    const apiKey = await getCredential("google_places_key");
    if (!apiKey) {
      setPlacesError(
        "No Google Places API key in storage. Set it in the Settings tab first.",
      );
      setPlacesState("error");
      return;
    }
    const query = placesQuery.trim();
    if (!query) {
      setPlacesError("Enter a search query first.");
      setPlacesState("error");
      return;
    }

    try {
      const results = await searchPlaces({ apiKey, query, maxResults: 5 });
      setPlacesResults(results);
      setPlacesState("success");
    } catch (err) {
      setPlacesError(err instanceof Error ? err.message : String(err));
      setPlacesState("error");
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
    >
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Phase 1 scratch
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.helpText}
        >
          Throwaway test buttons to prove the risky integrations work from React
          Native. Delete this screen when all three are green.
        </ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">GitHub Git Data API</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Creates branch{" "}
            <ThemedText type="code">claude-test-{"{timestamp}"}</ThemedText> on{" "}
            <ThemedText type="code">
              {BLOG_OWNER}/{BLOG_REPO}
            </ThemedText>{" "}
            with a markdown + PNG committed atomically.
          </ThemedText>

          <Pressable
            onPress={runGithubTest}
            disabled={githubState === "running"}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: "#208AEF" },
              pressed && styles.pressed,
              githubState === "running" && styles.disabled,
            ]}
          >
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              {githubState === "running" ? "Running…" : "Run GitHub test"}
            </ThemedText>
          </Pressable>

          {githubLog.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.logBox}>
              {githubLog.map((entry, i) => (
                <ThemedText key={i} type="code" style={styles.logEntry}>
                  {i + 1}. {entry}
                </ThemedText>
              ))}
            </ThemedView>
          )}

          {githubBranchUrl && (
            <Pressable onPress={() => Linking.openURL(githubBranchUrl)}>
              <ThemedText type="link" style={styles.resultLink}>
                View branch on GitHub →
              </ThemedText>
            </Pressable>
          )}

          {githubError && (
            <ThemedView type="backgroundElement" style={styles.errorBox}>
              <ThemedText type="small" style={styles.errorText}>
                {githubError}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">Cloudflare R2 upload</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Uploads a 1x1 PNG to{" "}
            <ThemedText type="code">{R2_BUCKET}</ThemedText> at{" "}
            <ThemedText type="code">
              .claude-test/pixel-{"{timestamp}"}.png
            </ThemedText>{" "}
            and logs the public URL.
          </ThemedText>

          <Pressable
            onPress={runR2Test}
            disabled={r2State === "running"}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: "#208AEF" },
              pressed && styles.pressed,
              r2State === "running" && styles.disabled,
            ]}
          >
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              {r2State === "running" ? "Running…" : "Run R2 test"}
            </ThemedText>
          </Pressable>

          {r2Log.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.logBox}>
              {r2Log.map((entry, i) => (
                <ThemedText key={i} type="code" style={styles.logEntry}>
                  {i + 1}. {entry}
                </ThemedText>
              ))}
            </ThemedView>
          )}

          {r2PublicUrl && (
            <Pressable onPress={() => Linking.openURL(r2PublicUrl)}>
              <ThemedText type="link" style={styles.resultLink}>
                View uploaded file →
              </ThemedText>
            </Pressable>
          )}

          {r2Error && (
            <ThemedView type="backgroundElement" style={styles.errorBox}>
              <ThemedText type="small" style={styles.errorText}>
                {r2Error}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">Google Places search</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Text query → Places API (New) → top 5 results with name, address,
            website.
          </ThemedText>

          <TextInput
            value={placesQuery}
            onChangeText={setPlacesQuery}
            editable={placesState !== "running"}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. Idletime Brewing Company Stowe VT"
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

          <Pressable
            onPress={runPlacesTest}
            disabled={placesState === "running"}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: "#208AEF" },
              pressed && styles.pressed,
              placesState === "running" && styles.disabled,
            ]}
          >
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              {placesState === "running" ? "Searching…" : "Run Places test"}
            </ThemedText>
          </Pressable>

          {placesResults.length > 0 && (
            <ThemedView style={styles.resultsList}>
              {placesResults.map((p, i) => (
                <ThemedView
                  key={i}
                  type="backgroundElement"
                  style={styles.resultCard}
                >
                  <ThemedText type="smallBold">{p.name}</ThemedText>
                  {p.address ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.address}
                    </ThemedText>
                  ) : null}
                  {p.website ? (
                    <Pressable onPress={() => Linking.openURL(p.website!)}>
                      <ThemedText type="link">{p.website}</ThemedText>
                    </Pressable>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      (no website)
                    </ThemedText>
                  )}
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {placesState === "success" && placesResults.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              No results.
            </ThemedText>
          )}

          {placesError && (
            <ThemedView type="backgroundElement" style={styles.errorBox}>
              <ThemedText type="small" style={styles.errorText}>
                {placesError}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

// Shared styles come from @/styles/styles; only explore-specific ones (or ones that
// differ from the shared version, like `button` and `input`) are defined here.
const localStyles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  sectionDisabled: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    opacity: 0.5,
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  buttonLabel: {
    color: "white",
  },
  logBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  logEntry: {
    fontSize: 12,
  },
  errorBox: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: "#D00",
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    minHeight: 44,
    marginTop: Spacing.one,
  },
  resultsList: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  resultCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
});

const styles = { ...sharedStyles, ...localStyles };
