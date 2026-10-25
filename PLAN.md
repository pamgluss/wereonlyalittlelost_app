# Hugo Trip Companion App — Plan

An Android app for drafting Hugo trip posts on the go. Attach photos, tag places,
write blurbs on your phone; when you hit Publish, the app assembles the markdown
and commits+pushes to the blog repo. The existing GitHub Action deploys the site.

Companion to the Hugo blog at `~/wereonlyalittlelost_blog`.

## Stack

- **Expo + React Native + TypeScript** — pragmatic choice given JS/TS background and zero prior mobile experience
- **Cloudflare R2** — image hosting, S3-compatible, 10 GB free + zero egress fees, custom subdomain
- **GitHub fine-grained PAT** — stored in `expo-secure-store` (Android Keystore), used with `@octokit/rest` and the Git Data API for atomic batch commits
- **Google Places API** — business name + website lookups only; no map UI in the app
- **expo-sqlite** — local-first drafts; upload retry queue deferred to v2
- **EAS Build (preview profile)** — produces a signed APK to sideload on the phone, no app store, no laptop tether

## Blog output constraints

The app's `Publish` step must produce files matching the existing blog layout:

- Markdown post: `content/trips/{trip_slug}/{entry_slug}.md`
- Frontmatter: `title`, `date`, `tags[]`, `draft`, optional `difficulty`, `rating`
- Images referenced as `![alt](https://img.wereonlyalittlelost.com/{trip_slug}/{filename})`
  (images served from R2 via a custom subdomain — not committed to the repo)
- Push to `master`; GitHub Action does the Hugo build and GitHub Pages deploy

## Up-front setup (before Phase 0)

Gather credentials first so Phase 1 is not blocked.

- Node 22+ on the laptop
- Expo account (free) — needed for EAS Build in Phase 6
- Google Cloud project → enable Places API → create API key (app fingerprint restriction added later)
- Cloudflare account → create R2 bucket (`wereonlyalittlelost-images`) → create API token scoped to that bucket → bind custom subdomain `img.wereonlyalittlelost.com`
- GitHub fine-grained PAT scoped to the blog repo with Contents: Read/Write

## Phase 0 — Hello phone (~half a day)

Get a trivial Expo app running on the phone with hot reload.

- `npx create-expo-app` with the TS tabs template
- Install Expo Go on phone, scan QR from `npx expo start`
- Learn the `app/` file-based routing basics

**Done when:** editing a file on the laptop updates the app on the phone in ~2 seconds.

## Phase 1 — Prove the three risky integrations (~1–2 days)

**Most important phase.** Verify external dependencies work from React Native
before building any UI. Three throwaway buttons on a scratch screen:

1. **GitHub button** — `@octokit/rest` creates a test commit on a branch of the
   blog repo with 2 files (markdown + placeholder image) via the Git Data API
   (blob → tree → commit → ref). Proves the atomic batch-commit flow.
2. **R2 button** — upload a canned image to R2, log the public URL. Primary
   approach: AWS SDK v3 S3 client + any needed polyfills. Fallback: a 20-line
   Cloudflare Worker that mints presigned PUT URLs, POST through it.
3. **Places button** — text input → Places Text Search API → log top 5 results
   (`name` + `website`).

**Done when:** all three buttons work end-to-end. Delete the scratch screen.

## Phase 2 — Data model and basic draft UI (~2–3 days)

Local-first SQLite schema and the skeleton screens.

**Schema:**

- `trips`: id, slug (`vermont`, `colorado`), display_name, created_at
- `entries`: id, trip_id, slug, title, date, tags (JSON), difficulty, rating, draft, body_markdown, published_at
- `photos`: id, entry_id, local_uri, remote_url, caption, order
- `places`: id, entry_id, name, url

**Screens:** list trips → create trip → list entries in a trip → create/edit entry.
Entry editor has text inputs for frontmatter fields and a multiline textarea for the body.
No photos or places yet.

**Done when:** can create a trip, add 3 entries, close/reopen the app, data persists.

## Phase 3 — Photos (~2 days)

- `expo-image-picker` multi-select from gallery → store local URIs in `photos`
- Upload to R2 (reusing Phase 1 flow) → store returned URL in `remote_url`
- Thumbnail grid in the entry editor: reorder (drag), delete, caption
- Per-photo badge: local only vs uploaded

**Done when:** attach 10 photos to an entry, see them uploaded, R2 URLs load in a browser.

## Phase 4 — Places (~half a day)

- "Add place" button in the entry editor
- Modal: text search → Google Places → pick result → save `name` + `website`
  (fallback to the Google Maps place URL if the business has no website)
- Attached places list under the body field with per-item delete

**Done when:** attach "Idletime Brewing Company" and it stores both the name
and `https://idletymebrewing.com/`.

## Phase 5 — Publish (~1–2 days)

The payoff phase.

**Markdown assembly:**

- YAML frontmatter from entry fields
- Body = user's blurb interleaved with image embeds using the R2 URLs
- Appended "Places" section with `- [Name](url)` lines per attached place
  (simpler than inline insertion in v1)

**Push:**

- Git Data API commit targeting `content/trips/{trip_slug}/{entry_slug}.md` on `master`
- Existing GitHub Action deploys the site
- Mark entry `published_at = now()` locally, lock editing

**Done when:** draft a post on the phone, hit Publish, see it live on
wereonlyalittlelost within a few minutes.

## Phase 6 — Real app on the phone (~half a day)

Phases 0–5 run through Expo Go tethered to the laptop. This phase makes the
app standalone so it can come on an actual trip.

- `eas build --profile preview --platform android` → signed APK
- Sideload to the phone (adb or just download the APK URL on the phone)
- Settings screen for PAT / R2 keys / Google key, persisted via `expo-secure-store`
- First-run flow: enter all three credentials, test each with a Verify button
- Add the Android app's SHA-1 fingerprint to the Google API key restriction

**Done when:** laptop off, airplane mode toggled, draft an entry with photos
and places; come back on wifi, publish, works.

## Deferred to v2+

- Upload retry queue for flaky-wifi mid-upload (v1 fails the upload and user retries)
- Edit a published post (round-trip the markdown back from GitHub, parse, re-publish)
- Markdown preview inside the app
- Photo cropping / rotation / EXIF cleanup
- Tag autocomplete from existing tags across the blog
- Interactive map UI
- Multiple photo-caption positioning (v1 appends each photo immediately after its blurb)

## Rough budget

Evenings/weekends pace: Phases 0–1 one weekend, Phases 2–5 across two weekends,
Phase 6 whenever. Realistic to be publishing from the phone within ~3 weeks of
calendar time.
