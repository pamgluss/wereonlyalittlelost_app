import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export default function TripScreen() {
  const [entries, setEntries] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await listEntriesByTripId();
    setEntries(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
}
