import { Spacing } from "@/constants/theme";
import { Trip } from "@/lib/db";
import { styles } from "@/styles/styles";
import { router } from "expo-router";
import { StyleSheet } from "react-native";
import { Button } from "./button";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

type TripProps = {
  key: string;
  trip: Trip;
};

export function TripCard({ trip }: TripProps) {
  return (
    <ThemedView
      key={trip.id}
      type="backgroundElement"
      style={tripCardStyles.tripCard}
    >
      <ThemedText type="smallBold">{trip.display_name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        <ThemedText type="code">{trip.slug}</ThemedText> · created{" "}
        {new Date(trip.created_at).toLocaleDateString()}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Last Synced:{" "}
        {trip.last_sync_date
          ? new Date(trip.last_sync_date).toLocaleDateString()
          : "Never"}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.buttonRow}>
        <Button
          label="View Trip Entries"
          style={styles.buttonRow}
          onPress={() =>
            router.push({
              pathname: "/trip/[tripId]",
              params: { tripId: String(trip.id) },
            })
          }
        />
      </ThemedView>
    </ThemedView>
  );
}

const tripCardStyles = StyleSheet.create({
  tripCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
});
