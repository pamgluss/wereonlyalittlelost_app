import { Button } from "@/components/button";
import { TagInput } from "@/components/tag-input";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { EntryDraftProvider, useEntryDraft } from "@/hooks/use-entry-draft";
import { useTheme } from "@/hooks/use-theme";
import { DIFFICULTIES, getTripById, RATINGS } from "@/lib/db";
import { styles } from "@/styles/styles";
import { Picker } from "@expo/ui/community/picker";
import { DatePickerDialog, Host } from "@expo/ui/jetpack-compose";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Sets up the provider; the form below it is what reads the draft
export default function NewEntryScreen() {
  const { tripId } = useLocalSearchParams<{
    tripId: string;
  }>();

  return (
    <EntryDraftProvider tripId={Number(tripId)}>
      <NewEntryForm />
    </EntryDraftProvider>
  );
}

function NewEntryForm() {
  const { tripId } = useLocalSearchParams<{
    tripId: string;
  }>();

  const id = Number(tripId);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { state, dispatch, pickImageFromGallery, submitPost } = useEntryDraft();
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const refresh = useCallback(async () => {
    dispatch({ type: "set_is_loading", value: true });
    const tripDetails = await getTripById(id);
    dispatch({ type: "set_trip_details", value: tripDetails });
    dispatch({ type: "set_is_loading", value: false });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const render = () => {
    if (state.loading) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Loading…
        </ThemedText>
      );
    }

    if (!state.trip) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Error: trip couldn't load - cannot create new entry.
        </ThemedText>
      );
    }

    return form();
  };

  const form = () => {
    return (
      <SafeAreaView>
        <ThemedText type="title">New Post</ThemedText>
        <TextInput
          style={styles.input}
          onChangeText={(value) => dispatch({ type: "edit_title", value })}
          value={state.entry.title}
          placeholder="Entry Title"
        />

        <View style={styles.rowContainer}>
          <Text>Date: {state.entry.date}</Text>
          <Button
            style={styles.rowButton}
            label="Change"
            onPress={() => setDatePickerVisible(true)}
          />
        </View>
        {datePickerVisible && (
          <Host>
            <DatePickerDialog
              onDateSelected={(date) => {
                if (date !== null) {
                  const stringifiedDate = date.toISOString();
                  dispatch({ value: stringifiedDate, type: "pick_date" });
                  setDatePickerVisible(false);
                }
              }}
              initialDate={state.entry.date}
              variant="picker"
              onDismissRequest={() => setDatePickerVisible(false)}
            />
          </Host>
        )}

        <Text nativeID="tags" style={styles.label}>
          Tags
        </Text>
        <TagInput
          aria-labelledby="tags"
          tags={state.entry.tags ?? []}
          onChange={(tags) => dispatch({ type: "edit_tags", value: tags })}
        />

        <Text nativeID="hikeOptions">Hike Options</Text>
        <View style={styles.rowContainer} aria-labelledby="hikeOptions">
          <Text nativeID="difficulty" style={styles.label}>
            Difficulty
          </Text>
          <Picker
            style={{ flex: 1 }}
            selectedValue={state.entry.difficulty}
            onValueChange={(value) =>
              dispatch({ type: "edit_difficulty", value })
            }
          >
            {DIFFICULTIES.map((difficulty) => {
              return (
                <Picker.Item
                  label={
                    difficulty
                      ? difficulty[0].toUpperCase() + difficulty.slice(1)
                      : "N/A"
                  }
                  value={difficulty}
                />
              );
            })}
          </Picker>

          <Text nativeID="rating" style={styles.label}>
            Rating
          </Text>
          <Picker
            style={{ flex: 1 }}
            selectedValue={state.entry.rating}
            onValueChange={(value) => dispatch({ type: "edit_rating", value })}
          >
            {RATINGS.map((rating) => {
              return (
                <Picker.Item
                  label={
                    rating ? rating[0].toUpperCase() + rating.slice(1) : "N/A"
                  }
                  value={rating}
                />
              );
            })}
          </Picker>
        </View>

        <View style={styles.rowContainer}>
          <Text nativeID="draftSwitch" style={styles.label}>
            Entry Is a Draft
          </Text>
          <Switch
            aria-labelledby="draftSwitch"
            trackColor={{ false: "#767577", true: "#cedbf8" }}
            thumbColor={state.entry.draft ? "#81b0ff" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={(value) =>
              dispatch({ type: "change_draft_status", value })
            }
            value={state.entry.draft}
          />
        </View>

        <Text nativeID="blogBody" style={styles.label}>
          Blog Body
        </Text>
        <TextInput
          aria-labelledby="blogBody"
          textAlignVertical="top"
          editable
          multiline={true}
          numberOfLines={10}
          onChangeText={(value) =>
            dispatch({ type: "edit_body_markdown", value })
          }
          value={state.entry.body_markdown}
          style={styles.textArea}
        />
        <ThemedView type="backgroundElement" style={styles.buttonRow}>
          <Button
            label="Add Picture"
            style={styles.rowButton}
            onPress={() => {
              pickImageFromGallery();
            }}
          />
          <Button
            label="Add Place (TODO)"
            style={styles.rowButton}
            onPress={() => {
              console.log("todo");
            }}
          />
        </ThemedView>
        <ThemedView type="backgroundElement" style={styles.buttonRow}>
          <Button
            label={state.creatingPost ? "Creating Post..." : "Save + Push Post"}
            style={styles.rowButton}
            onPress={() => {
              submitPost();
            }}
          />
        </ThemedView>
      </SafeAreaView>
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
        {render()}
        {state.branchUrl ? (
          <Pressable onPress={() => Linking.openURL(state.branchUrl)}>
            <ThemedText type="link" style={styles.resultLink}>
              View Branch →
            </ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>
    </ScrollView>
  );
}
