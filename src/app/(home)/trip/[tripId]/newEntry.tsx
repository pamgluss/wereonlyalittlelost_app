import { Button } from "@/components/button";
import { TagInput } from "@/components/tag-input";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getCredential } from "@/lib/credentials";
import { createEntry, CreateEntryInput, getTripById, Trip } from "@/lib/db";
import { generateMarkdownHeading, HeaderKeysT } from "@/lib/github";
import {
  contentTypeFor,
  formatR2KeyFromPath,
  getLocalImagePathsFromMarkdown,
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_PUBLIC_URL_BASE,
  uploadToR2,
} from "@/lib/r2";
import { styles } from "@/styles/styles";
import { DatePickerDialog, Host } from "@expo/ui/jetpack-compose";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useReducer, useState } from "react";
import { Alert, ScrollView, Switch, Text, TextInput } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Reducer function
type UserFormActions =
  | "edit_title"
  | "pick_date"
  | "edit_tags"
  | "edit_difficulty"
  | "change_draft_status"
  | "edit_body_markdown"
  | "append_image";

type FormAction = {
  type: UserFormActions;
  value: any;
};

type ImageMapT = {
  // filepath: fileURI
  [key: string]: string;
};

function reducer(
  state: CreateEntryInput,
  action: FormAction,
): CreateEntryInput {
  switch (action.type) {
    case "edit_title": {
      return {
        ...state,
        title: action.value,
      };
    }
    case "pick_date": {
      return {
        ...state,
        date: action.value,
      };
    }
    case "edit_tags": {
      return {
        ...state,
        tags: action.value,
      };
    }
    case "change_draft_status": {
      return {
        ...state,
        draft: action.value,
      };
    }
    case "edit_body_markdown": {
      return {
        ...state,
        body_markdown: action.value,
      };
    }
    case "append_image": {
      const markdownImage = `![image](/${action.value})`;
      return {
        ...state,
        body_markdown: (state.body_markdown += `\n${markdownImage}\n`),
      };
    }
  }

  return state;
}

function initEntry(trip_id: number): CreateEntryInput {
  const date = new Date().toISOString();
  return {
    trip_id,
    slug: "",
    title: "",
    date,
    tags: [],
    difficulty: null,
    rating: null,
    draft: true,
    body_markdown: "",
    writer_source: "app",
  };
}

export default function NewEntryScreen() {
  const { tripId } = useLocalSearchParams<{
    tripId: string;
  }>();

  const id = Number(tripId);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useReducer(reducer, initEntry(id));
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [imageMap, setImageMap] = useState<Partial<ImageMapT>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const tripDetails = await getTripById(id);
    setTrip(tripDetails);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Copied wholesale from the expo docs
  const pickImage = async () => {
    // No permissions request is necessary for launching the image library.
    // Manually request permissions for videos on iOS when `allowsEditing` is set to `false`
    // and `videoExportPreset` is `'Passthrough'` (the default), ideally before launching the picker
    // so the app users aren't surprised by a system dialog after picking a video.
    // See "Invoke permissions for videos" sub section for more details.
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access the media library is required.",
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      let fileName = result.assets[0].fileName;
      const fileURI = result.assets[0].uri;

      if (!fileName || !fileURI) {
        Alert.alert(
          "File metadata missing",
          "Result did not have filename or file URI.",
        );
        return;
      }
      fileName = `images/${result.assets[0].fileName}`;
      dispatch({ type: "append_image", value: fileName });
      //grab the returned URI (asset.uri) and copy or move it to a new path with your custom filename using expo-file-system

      //Save a map of image paths (for the markdown) to image URIs (for the upload) so that we know what to upload when the post is submitted
      let imageMapCopy = imageMap;
      imageMapCopy[fileName] = fileURI;
      setImageMap(imageMapCopy);
    }
  };

  const submitPost = async () => {
    if (!trip) {
      Alert.alert("Trip is null", "Cannot submit without an associated trip.");
      return;
    }
    // First construct the markdown header
    let headerKeys: HeaderKeysT = {
      title: state.title,
      date: state.date,
      draft: state.draft ? "true" : "false",
      tags: [state.title],
    };

    // Always tag the post with the trip its associated with
    if (trip) {
      headerKeys["tags"].push(trip.display_name);
    }

    if (state.tags && state.tags.length > 0) {
      headerKeys["tags"].concat(state.tags);
    }

    if (state.difficulty) {
      headerKeys["difficulty"] = state.difficulty;
    }

    if (state.rating) {
      headerKeys["rating"] = state.rating;
    }

    const headerMarkdown = generateMarkdownHeading(headerKeys);

    // Second, append the input markdown
    const newMarkdown = headerMarkdown + "\n" + state.body_markdown;
    console.log(newMarkdown);

    // Third, search our map for the images to make sure we have the URI - if we don't, error
    // It's possible there are no matches, in which case we can skip this step
    const matches = getLocalImagePathsFromMarkdown(newMarkdown);
    if (matches) {
      const accessKeyId = await getCredential("r2_access_key_id");
      const secretAccessKey = await getCredential("r2_secret_access_key");
      if (!accessKeyId || !secretAccessKey) {
        Alert.alert(
          "Missing R2 Creds",
          "You need to set up R2 key and/or secret access key.",
        );
        return;
      }

      // Fourth, upload the images to r2 and get the r2 URLs
      const uploadPromises = matches.map(async (match) => {
        const key = formatR2KeyFromPath(match, trip.slug);
        // We already know imageMap[match] is valid from
        const buffer = new Uint8Array(
          await new File(imageMap[match] ?? "").arrayBuffer(),
        );
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

      const r2PublicUrls = await Promise.all(uploadPromises).then(
        (uploadResults) => {
          return uploadResults.map((upload) => {
            return upload.publicUrl;
          });
        },
      );

      let editedMarkdown = newMarkdown;
      matches.forEach((path, index) => {
        editedMarkdown = editedMarkdown.replace(
          `/${path}`,
          r2PublicUrls[index],
        );
      });

      console.log(editedMarkdown);

      const createRes = await createEntry({
        trip_id: trip.id,
        slug: "",
        title: headerKeys.title,
        date: headerKeys.date,
        tags: headerKeys.tags,
        difficulty: state.difficulty,
        rating: state.rating,
        draft: state.draft,
        body_markdown: editedMarkdown,
        writer_source: "app",
      });
    }

    // Fifth, encode and save the markdown to the DB
    // Finally, make the commit on github
  };

  const render = () => {
    if (loading) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Loading…
        </ThemedText>
      );
    }

    if (!trip) {
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
          value={state.title}
          placeholder="Entry Title"
        />
        <Text>Date: {state.date}</Text>
        <Button
          label="Select date"
          onPress={() => setDatePickerVisible(true)}
        />
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
              initialDate={state.date}
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
          tags={state.tags ?? []}
          onChange={(tags) => dispatch({ type: "edit_tags", value: tags })}
        />

        <Text nativeID="draftSwitch" style={styles.label}>
          Entry Is a Draft
        </Text>
        <Switch
          aria-labelledby="draftSwitch"
          trackColor={{ false: "#767577", true: "#cedbf8" }}
          thumbColor={state.draft ? "#81b0ff" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(value) =>
            dispatch({ type: "change_draft_status", value })
          }
          value={state.draft}
        />

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
          value={state.body_markdown}
          style={styles.textArea}
        />
        <ThemedView type="backgroundElement" style={styles.buttonRow}>
          <Button
            label="Add Picture"
            style={styles.rowButton}
            onPress={() => {
              pickImage();
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
            label="Save + Push Branch (TODO)"
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
      <ThemedView style={styles.container}>{render()}</ThemedView>
    </ScrollView>
  );
}
