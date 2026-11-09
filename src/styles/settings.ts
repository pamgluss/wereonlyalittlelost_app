import { StyleSheet } from "react-native";

import { MaxContentWidth, Spacing } from "@/constants/theme";

export const settingsStyles = StyleSheet.create({
  contentContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  container: {
    width: "100%",
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  helpText: {
    textAlign: "center",
  },
  field: {
    gap: Spacing.one,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    fontFamily: "monospace",
    minHeight: 44,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  rowButton: {
    flex: 1,
  },
  status: {
    textAlign: "center",
  },
});
