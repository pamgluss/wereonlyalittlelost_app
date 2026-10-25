/**
 * Library for Google Places API
 */

export type Place = {
  name: string;
  address: string;
  website: string | null;
  googleMapsUrl: string;
};

type PlacesApiResponse = {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    googleMapsUri?: string;
  }[];
};

export async function searchPlaces(opts: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<Place[]> {
  const { apiKey, query, maxResults = 5 } = opts;
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: maxResults }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    const trimmed = text.length > 300 ? text.slice(0, 300) + "…" : text;
    throw new Error(`Places search failed: HTTP ${res.status} — ${trimmed}`);
  }

  const data: PlacesApiResponse = await res.json();
  const places = data.places ?? [];
  return places.map((p) => ({
    name: p.displayName?.text ?? "(no name)",
    address: p.formattedAddress ?? "",
    website: p.websiteUri ?? null,
    googleMapsUrl: p.googleMapsUri ?? "",
  }));
}
