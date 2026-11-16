import * as SQLite from "expo-sqlite";

const DB_NAME = "wereonlyalittlelost.db";

export type Trip = {
  id: number;
  slug: string;
  display_name: string;
  created_at: number;
  last_sync_date: number | null;
};

export type Entry = {
  id: number;
  trip_id: number;
  slug: string;
  title: string;
  date: string;
  tags: string[];
  difficulty: string | null;
  rating: string | null;
  draft: boolean;
  body_markdown: string;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  writer_source: WriterSource;
};

type WriterSource = "app" | "blog";

export type Photo = {
  id: number;
  entry_id: number;
  local_uri: string | null;
  remote_url: string | null;
  caption: string | null;
  position: number;
  created_at: number;
};

export type Place = {
  id: number;
  entry_id: number;
  name: string;
  url: string;
  position: number;
  created_at: number;
};

type EntryRow = Omit<Entry, "tags" | "draft"> & {
  tags: string;
  draft: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openAndMigrate();
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
      );
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        difficulty TEXT,
        rating TEXT,
        draft INTEGER NOT NULL DEFAULT 1,
        body_markdown TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        UNIQUE(trip_id, slug)
      );
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        local_uri TEXT,
        remote_url TEXT,
        caption TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      ALTER TABLE trips ADD COLUMN last_sync_date INTEGER;
      PRAGMA user_version = 2;
    `);
  }

  if (currentVersion < 3) {
    await db.execAsync(`      
      ALTER TABLE entries ADD COLUMN writer_source TEXT;
      PRAGMA user_version = 3;
    `);
  }

  return db;
}

function rowToEntry(row: EntryRow): Entry {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed))
      tags = parsed.filter((t): t is string => typeof t === "string");
  } catch {
    tags = [];
  }
  const { tags: _t, draft: _d, ...rest } = row;
  return { ...rest, tags, draft: row.draft !== 0 };
}

// Trip helpers

export async function listTrips(): Promise<Trip[]> {
  const db = await getDb();
  return db.getAllAsync<Trip>("SELECT * FROM trips ORDER BY display_name");
}

export async function getTripById(id: number): Promise<Trip | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Trip>("SELECT * FROM trips WHERE id = ?", id)) ??
    null
  );
}

export async function getTripBySlug(slug: string): Promise<Trip | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Trip>(
      "SELECT * FROM trips WHERE slug = ?",
      slug,
    )) ?? null
  );
}

export async function markTripSynced(id: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.runAsync(
    `UPDATE trips SET last_sync_date = ? WHERE id = ?`,
    now,
    id,
  );
}

export async function createTrip(input: {
  slug: string;
  display_name: string;
}): Promise<Trip> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    "INSERT INTO trips (slug, display_name, created_at) VALUES (?, ?, ?)",
    input.slug,
    input.display_name,
    now,
  );
  return {
    id: result.lastInsertRowId,
    slug: input.slug,
    display_name: input.display_name,
    created_at: now,
    last_sync_date: null,
  };
}

export async function deleteTrip(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM trips WHERE id = ?", id);
}

// Entry helpers

export async function listEntriesByTripId(tripId: number): Promise<Entry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    "SELECT * FROM entries WHERE trip_id = ? ORDER BY date DESC",
    tripId,
  );
  return rows.map(rowToEntry);
}

export async function getEntryById(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>(
    "SELECT * FROM entries WHERE id = ?",
    id,
  );
  return row ? rowToEntry(row) : null;
}

export async function getEntryByTripAndSlug(
  tripId: number,
  entrySlug: string,
): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>(
    "SELECT * FROM entries WHERE trip_id = ? AND slug = ?",
    tripId,
    entrySlug,
  );
  return row ? rowToEntry(row) : null;
}

export type CreateEntryInput = {
  trip_id: number;
  slug: string;
  title: string;
  date: string;
  tags?: string[];
  difficulty?: string | null;
  rating?: string | null;
  draft?: boolean;
  body_markdown?: string;
  writer_source: WriterSource;
};

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO entries
       (trip_id, slug, title, date, tags, difficulty, rating, draft, body_markdown, created_at, updated_at, writer_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.trip_id,
    input.slug,
    input.title,
    input.date,
    JSON.stringify(input.tags ?? []),
    input.difficulty ?? null,
    input.rating ?? null,
    input.draft === false ? 0 : 1,
    input.body_markdown ?? "",
    now,
    now,
    input.writer_source,
  );
  const entry = await getEntryById(result.lastInsertRowId);
  if (!entry) throw new Error("createEntry: entry disappeared after insert");
  return entry;
}

export type UpdateEntryInput = Partial<Omit<CreateEntryInput, "trip_id">>;

export async function updateEntry(
  id: number,
  patch: UpdateEntryInput,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = ["updated_at = ?"];
  const params: SQLite.SQLiteBindValue[] = [Date.now()];
  if (patch.slug !== undefined) {
    sets.push("slug = ?");
    params.push(patch.slug);
  }
  if (patch.title !== undefined) {
    sets.push("title = ?");
    params.push(patch.title);
  }
  if (patch.date !== undefined) {
    sets.push("date = ?");
    params.push(patch.date);
  }
  if (patch.tags !== undefined) {
    sets.push("tags = ?");
    params.push(JSON.stringify(patch.tags));
  }
  if (patch.difficulty !== undefined) {
    sets.push("difficulty = ?");
    params.push(patch.difficulty);
  }
  if (patch.rating !== undefined) {
    sets.push("rating = ?");
    params.push(patch.rating);
  }
  if (patch.draft !== undefined) {
    sets.push("draft = ?");
    params.push(patch.draft ? 1 : 0);
  }
  if (patch.body_markdown !== undefined) {
    sets.push("body_markdown = ?");
    params.push(patch.body_markdown);
  }
  params.push(id);
  await db.runAsync(
    `UPDATE entries SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
  );
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM entries WHERE id = ?", id);
}

export async function markEntryPublished(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE entries SET published_at = ?, draft = 0, updated_at = ? WHERE id = ?",
    Date.now(),
    Date.now(),
    id,
  );
}

// Photo helpers

export async function listPhotosByEntryId(entryId: number): Promise<Photo[]> {
  const db = await getDb();
  return db.getAllAsync<Photo>(
    "SELECT * FROM photos WHERE entry_id = ? ORDER BY position, id",
    entryId,
  );
}

export async function addPhoto(input: {
  entry_id: number;
  local_uri: string | null;
  remote_url?: string | null;
  caption?: string | null;
  position?: number;
}): Promise<Photo> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    "INSERT INTO photos (entry_id, local_uri, remote_url, caption, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    input.entry_id,
    input.local_uri,
    input.remote_url ?? null,
    input.caption ?? null,
    input.position ?? 0,
    now,
  );
  return {
    id: result.lastInsertRowId,
    entry_id: input.entry_id,
    local_uri: input.local_uri,
    remote_url: input.remote_url ?? null,
    caption: input.caption ?? null,
    position: input.position ?? 0,
    created_at: now,
  };
}

export async function updatePhoto(
  id: number,
  patch: {
    local_uri?: string | null;
    remote_url?: string | null;
    caption?: string | null;
    position?: number;
  },
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: SQLite.SQLiteBindValue[] = [];
  if (patch.local_uri !== undefined) {
    sets.push("local_uri = ?");
    params.push(patch.local_uri);
  }
  if (patch.remote_url !== undefined) {
    sets.push("remote_url = ?");
    params.push(patch.remote_url);
  }
  if (patch.caption !== undefined) {
    sets.push("caption = ?");
    params.push(patch.caption);
  }
  if (patch.position !== undefined) {
    sets.push("position = ?");
    params.push(patch.position);
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.runAsync(
    `UPDATE photos SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
  );
}

export async function deletePhoto(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM photos WHERE id = ?", id);
}

// Place helpers

export async function listPlacesByEntryId(entryId: number): Promise<Place[]> {
  const db = await getDb();
  return db.getAllAsync<Place>(
    "SELECT * FROM places WHERE entry_id = ? ORDER BY position, id",
    entryId,
  );
}

export async function addPlace(input: {
  entry_id: number;
  name: string;
  url: string;
  position?: number;
}): Promise<Place> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    "INSERT INTO places (entry_id, name, url, position, created_at) VALUES (?, ?, ?, ?, ?)",
    input.entry_id,
    input.name,
    input.url,
    input.position ?? 0,
    now,
  );
  return {
    id: result.lastInsertRowId,
    entry_id: input.entry_id,
    name: input.name,
    url: input.url,
    position: input.position ?? 0,
    created_at: now,
  };
}

export async function deletePlace(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM places WHERE id = ?", id);
}
