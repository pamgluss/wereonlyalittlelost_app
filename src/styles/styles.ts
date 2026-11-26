import { MaxContentWidth, Spacing } from "@/constants/theme";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  rowContainer: {
    flexDirection: "row", // Aligns children horizontally
    justifyContent: "space-between", // Distributes space horizontally (main axis)
    alignItems: "center", // Aligns children vertically (cross axis)
    gap: 10, // Adds uniform spacing between items
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
  modalText: {
    marginBottom: 15,
    textAlign: "center",
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#333",
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
    minHeight: 120,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textInput: {
    padding: 10,
    borderColor: "#000",
    borderWidth: 1,
    margin: 12,
  },
  resultLink: {
    textAlign: "center",
    paddingVertical: Spacing.two,
  },
});

export const viewStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
