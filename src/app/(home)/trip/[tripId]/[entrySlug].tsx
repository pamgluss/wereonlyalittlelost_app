import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Entry, getEntryByTripAndSlug } from "@/lib/db";
import { styles } from "@/styles/styles";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  async function getAndSetMarkdown() {
    const entryRow = await getEntryByTripAndSlug(id, entrySlug);
    const entry = entryRow;

    if (!entry) return;

    setEntry(entry);

    const contents = entry.body_markdown;
    const markdown = atob(contents);

    setMarkdown(markdown);
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
    if (loading) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Loading…
        </ThemedText>
      );
    }

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
          <ThemedText type="subtitle">{entry?.title ?? "--"}</ThemedText>
          <ScrollView style={styles.container}>
            <Text selectable style={styles.codeText}>
              {markdown}
            </Text>
          </ScrollView>
        </ThemedView>
      </ScrollView>
    );
  };

  return render();
}
