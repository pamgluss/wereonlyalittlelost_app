import { MaxContentWidth, Spacing } from "@/constants/theme";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
  codeText: {
    fontFamily: "monospace",
    fontSize: 13,
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    backgroundColor: "#208AEF",
  },
  saveButtonLabel: {
    color: "white",
  },
  cancelButton: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: "#D00",
  },
  emptyState: {
    textAlign: "center",
    paddingVertical: Spacing.four,
  },
  list: {
    gap: Spacing.two,
  },
  entryCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  textArea: {
    height: 120,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
