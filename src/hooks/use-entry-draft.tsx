import { CreateEntryInput, Trip } from "@/lib/db";
import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useReducer,
} from "react";

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
  addImageToStateMap: (fileName: string, fileURI: string) => void;
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

  const addImageToStateMap = (fileName: string, fileURI: string): void => {
    dispatch({ type: "add_image_to_state_map", value: [fileName, fileURI] });
  };

  return (
    <EntryDraftContext value={{ state, dispatch, addImageToStateMap }}>
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
