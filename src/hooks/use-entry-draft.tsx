import { createEntry, CreateEntryInput, Trip } from "@/lib/db";
import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useReducer,
} from "react";

import {
  BLOG_BASE_BRANCH,
  BLOG_OWNER,
  BLOG_REPO,
  TRIPS_LIST_PATH,
} from "@/constants/blog";
import { getCredential } from "@/lib/credentials";
import { createCommitWithFiles, GitHubFile } from "@/lib/github";
import {
  generateMarkdownHeading,
  getLocalImagePathsFromMarkdown,
  HeaderKeysT,
  titleToSlug,
} from "@/lib/markdown-helpers";
import {
  contentTypeFor,
  formatR2KeyFromPath,
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_PUBLIC_URL_BASE,
  uploadToR2,
} from "@/lib/r2";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

// Reducer function
type Actions =
  | "edit_title"
  | "edit_slug"
  | "pick_date"
  | "edit_tags"
  | "edit_difficulty"
  | "edit_rating"
  | "change_draft_status"
  | "edit_body_markdown"
  | "append_image_to_markdown"
  | "add_image_to_state_map"
  | "set_trip_details"
  | "set_is_post_creating"
  | "set_branch_url"
  | "set_is_loading";

type FormAction = {
  type: Actions;
  value: any;
};

type ImageMapT = {
  // filepath: fileURI
  [key: string]: string;
};

type EntryDraftState = {
  entry: CreateEntryInput;
  loading: boolean;
  trip: Trip | null;
  branchUrl: string;
  creatingPost: boolean;
  imageMap: Partial<ImageMapT>;
};

// What consumers get back from useEntryDraft()
type EntryDraftContextT = {
  state: EntryDraftState;
  dispatch: Dispatch<FormAction>;
  pickImageFromGallery: () => void;
  submitPost: () => void;
};

export function userEntryReducer(
  state: EntryDraftState,
  action: FormAction,
): EntryDraftState {
  switch (action.type) {
    case "edit_title": {
      return {
        ...state,
        entry: {
          ...state.entry,
          title: action.value,
        },
      };
    }
    case "pick_date": {
      return {
        ...state,
        entry: {
          ...state.entry,
          date: action.value,
        },
      };
    }
    case "edit_difficulty": {
      return {
        ...state,
        entry: {
          ...state.entry,
          difficulty: action.value,
        },
      };
    }
    case "edit_rating": {
      return {
        ...state,
        entry: {
          ...state.entry,
          rating: action.value,
        },
      };
    }
    case "edit_slug": {
      return {
        ...state,
        entry: {
          ...state.entry,
          slug: action.value,
        },
      };
    }
    case "edit_tags": {
      return {
        ...state,
        entry: {
          ...state.entry,
          tags: action.value,
        },
      };
    }
    case "change_draft_status": {
      return {
        ...state,
        entry: {
          ...state.entry,
          draft: action.value,
        },
      };
    }
    case "edit_body_markdown": {
      return {
        ...state,
        entry: {
          ...state.entry,
          body_markdown: action.value,
        },
      };
    }
    case "append_image_to_markdown": {
      const markdownImage = `![image](/${action.value})`;
      return {
        ...state,
        entry: {
          ...state.entry,
          body_markdown: `${state.entry.body_markdown ?? ""}\n${markdownImage}\n`,
        },
      };
    }
    case "set_trip_details": {
      return {
        ...state,
        trip: action.value,
      };
    }
    case "set_is_loading": {
      return {
        ...state,
        loading: action.value,
      };
    }
    case "set_is_post_creating": {
      return {
        ...state,
        creatingPost: action.value,
      };
    }
    case "set_branch_url": {
      return {
        ...state,
        branchUrl: action.value,
      };
    }
    case "add_image_to_state_map": {
      return {
        ...state,
        imageMap: {
          ...state.imageMap,
          [action.value[0]]: action.value[1],
        },
      };
    }
  }
}

// Initial state
function initState(trip_id: number): EntryDraftState {
  const date = new Date().toISOString();
  return {
    entry: {
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
    },
    loading: true,
    trip: null,
    branchUrl: "",
    creatingPost: false,
    imageMap: {},
  };
}

// Starts as null so useEntryDraft can tell when there is no provider above it
const EntryDraftContext = createContext<EntryDraftContextT | null>(null);

// The provider is a component: it owns the state and shares it with everything inside it
export function EntryDraftProvider({
  tripId,
  children,
}: {
  tripId: number;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(userEntryReducer, initState(tripId));

  // Copied wholesale from the expo docs
  const pickImageFromGallery = async () => {
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
      dispatch({ type: "append_image_to_markdown", value: fileName });
      //TODO: grab the returned URI (asset.uri) and copy or move it to a new path with your custom filename using expo-file-system

      //Save a map of image paths (for the markdown) to image URIs (for the upload) so that we know what to upload when the post is submitted
      dispatch({ type: "add_image_to_state_map", value: [fileName, fileURI] });
    }
  };

  const submitPost = async () => {
    if (!state.trip) {
      Alert.alert("Trip is null", "Cannot submit without an associated trip.");
      return;
    }

    const trip = state.trip;

    // Error on missing r2 and GH creds
    const pat = await getCredential("github_pat");
    if (!pat) {
      Alert.alert("Empty PAT", "Configure PAT token in settings.");
      return;
    }

    dispatch({ type: "set_is_post_creating", value: true });

    // Generate a slug from the title
    const entrySlug = titleToSlug(state.entry.title);
    dispatch({ type: "edit_slug", value: entrySlug });

    // First construct the markdown header
    let headerKeys: HeaderKeysT = {
      title: state.entry.title,
      date: state.entry.date,
      draft: state.entry.draft ? "true" : "false",
      tags: [state.entry.title],
    };

    // Always tag the post with the trip its associated with
    if (state.trip) {
      headerKeys["tags"].push(trip.display_name);
    }

    if (state.entry.tags && state.entry.tags.length > 0) {
      headerKeys["tags"].concat(state.entry.tags);
    }

    if (state.entry.difficulty) {
      headerKeys["difficulty"] = state.entry.difficulty;
    }

    if (state.entry.rating) {
      headerKeys["rating"] = state.entry.rating;
    }

    const headerMarkdown = generateMarkdownHeading(headerKeys);

    // Second, append the input markdown
    const newMarkdown = headerMarkdown + "\n" + state.entry.body_markdown;

    // Third, search our map for the images to make sure we have the URI - if we don't, error
    // It's possible there are no matches, in which case we can skip this step
    const matches = getLocalImagePathsFromMarkdown(newMarkdown);
    let editedMarkdown = newMarkdown;
    if (matches) {
      const accessKeyId = await getCredential("r2_access_key_id");
      const secretAccessKey = await getCredential("r2_secret_access_key");
      if (!accessKeyId || !secretAccessKey) {
        Alert.alert(
          "Missing R2 Creds",
          "You need to set up R2 key and/or secret access key.",
        );
        dispatch({ type: "set_is_post_creating", value: false });
        return;
      }

      // Fourth, upload the images to r2 and get the r2 URLs
      const uploadPromises = matches.map(async (match) => {
        const key = formatR2KeyFromPath(match, trip.slug);
        // We already know imageMap[match] is valid from
        const buffer = new Uint8Array(
          await new File(state.imageMap[match] ?? "").arrayBuffer(),
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

      matches.forEach((path, index) => {
        editedMarkdown = editedMarkdown.replace(
          `/${path}`,
          r2PublicUrls[index],
        );
      });
    }

    // Fifth, encode and save the markdown to the DB
    let encodedMarkdown = "";
    try {
      encodedMarkdown = btoa(editedMarkdown);
    } catch (err) {
      Alert.alert("Error encoding markdown", JSON.stringify(err));
      dispatch({ type: "set_is_post_creating", value: false });
      return;
    }

    try {
      await createEntry({
        trip_id: trip.id,
        slug: entrySlug,
        title: headerKeys.title,
        date: headerKeys.date,
        tags: headerKeys.tags,
        difficulty: state.entry.difficulty,
        rating: state.entry.rating,
        draft: state.entry.draft,
        body_markdown: encodedMarkdown,
        writer_source: "app",
      });
    } catch (err) {
      Alert.alert("Error saving post to DB", JSON.stringify(err));
      dispatch({ type: "set_is_post_creating", value: false });
      return;
    }

    // Finally, make the commit on github
    try {
      const timestamp = Date.now();
      const newBranch = `app-${trip.slug}-${entrySlug}-${timestamp}`;
      const files: GitHubFile[] = [
        {
          path: `${TRIPS_LIST_PATH}/${trip.slug}/${entrySlug}.md`,
          content: editedMarkdown,
          encoding: "utf-8",
        },
      ];
      const commitResult = await createCommitWithFiles({
        pat,
        owner: BLOG_OWNER,
        repo: BLOG_REPO,
        baseBranch: BLOG_BASE_BRANCH,
        newBranch,
        commitMessage: `exclude - New post for ${state.entry.title} from the app`,
        files,
      });

      dispatch({ type: "set_branch_url", value: commitResult.branchUrl });
    } catch (err) {
      Alert.alert("Error making branch", JSON.stringify(err));
      dispatch({ type: "set_is_post_creating", value: false });
      return;
    }

    dispatch({ type: "set_is_post_creating", value: false });
  };

  return (
    <EntryDraftContext
      value={{ state, dispatch, pickImageFromGallery, submitPost }}
    >
      {children}
    </EntryDraftContext>
  );
}

// The hook is how screens inside the provider read that state
export function useEntryDraft(): EntryDraftContextT {
  const context = useContext(EntryDraftContext);
  if (!context) {
    throw new Error("useEntryDraft must be used inside <EntryDraftProvider>");
  }
  return context;
}
