# Txtshell iOS App — Design Spec

Personal-use, native iOS app for reading Txtshell blocks on phone and capturing thoughts to a desktop-drained inbox. Same architecture supports Android if ever extended; iOS is the only platform in scope.

---

## Architecture

Two encrypted blobs in Cloudflare R2:
- **Blocks blob** — read by phone, written by desktop
- **Inbox blob** — written by phone, drained by desktop

One Cloudflare Worker with five endpoints:
- `PUT /blocks` — desktop uploads encrypted blocks
- `GET /blocks` — phone fetches encrypted blocks
- `POST /inbox` — phone appends an encrypted capture
- `GET /inbox` — desktop fetches the inbox for triage
- `DELETE /inbox` — desktop trims processed entries by ID (Approach 2: surgical removal, not wholesale clear)

A single shared passphrase derives the AES-GCM key via PBKDF2. Same passphrase on desktop and iOS. Cloudflare only ever sees ciphertext.

Worker storage paths: `users/${userId}/blocks.encrypted` and `users/${userId}/inbox.json`. userId hardcoded in the Worker for now, paths structured for future multi-user expansion. Single shared auth secret in `X-Auth-Secret` header for now.

---

## Desktop changes (Txtshell)

### `/mirror` setup command (one-time)
1. Choose passphrase with strength meter (same UX as vault setup)
2. Confirm passphrase
3. Display QR code containing `{ passphrase, workerUrl }` as JSON
4. Display passphrase in text form below the QR as fallback for manual entry
5. QR remains available for re-pairing additional devices

### Auto-export on every save
Silent background upload of encrypted blocks blob whenever a block is saved on desktop. No user-visible action needed.

### `/inbox` command
1. Fetch the inbox blob from Worker
2. Decrypt locally
3. Show captured entries with **Save / Edit / Skip** actions per entry
4. Push back the trimmed inbox via `DELETE /inbox` with IDs of processed entries
5. Untouched entries remain in the inbox, visible on phone as pending

---

## iOS app (Swift, SwiftUI)

### First-launch flow
1. Welcome screen
2. **Primary action:** "Scan QR from desktop" button
3. **Fallback link:** "Enter passphrase manually"

**QR path:**
- Tap opens camera via `AVFoundation` (`AVCaptureMetadataOutput` for QR detection)
- Scans QR, parses `{ passphrase, workerUrl }` JSON

**Manual path:**
- Standard text input for passphrase
- Worker URL hardcoded as fallback if QR isn't used

**Either path:**
- App tests credentials by fetching blocks blob from Worker and attempting decrypt
- On success: derive key, store in Keychain protected by biometrics (`kSecAccessControlBiometryCurrentSet`), discard passphrase from memory
- On failure: show clear error, allow retry

### Subsequent launches
- Face ID / Touch ID via `LocalAuthentication`
- Biometric unlock retrieves key from Keychain
- Decrypts cached blocks, shows immediately
- Sync action fetches fresh blocks blob from Worker, decrypts, updates list

### Inbox screen (default after unlock)
- Top bar: "Inbox" title, sync status indicator ("all synced" / "N pending"), search icon (top-right)
- Large capture text area, autofocused on launch (keyboard up)
- Text persists as encrypted local draft across app launches until Save or Delete
- Keyboard accessory bar: "Save" button (right-aligned)
- Long-press on typed text → contextual menu with "Copy entire note" and "Delete" (confirmation on Delete)
- Tap Save → text committed to local inbox queue, field cleared, background sync to Worker

### Search view (pushed on top when search icon tapped)
- "‹ Inbox" back button (or edge-swipe right from left edge, iOS-native gesture)
- Search field pinned at top, NOT focused on open
- **Default state (no query):** all blocks listed below grouped by date (Today / Yesterday / Earlier), browseable without engaging search
- **Filtered state (text in search field):** results update in real-time as user types, sorted by relevance, with matched keyword highlighted
- Tap a result → opens block in read-only view
- No editing on phone — view-only access to existing blocks

### Capture flow (sync mechanics)
- User taps Save → text added to local inbox queue
- App attempts POST to Worker `/inbox` endpoint immediately if online
- Optimistic: field clears regardless of sync result; sync state tracked separately
- Failed sends retry on next app foreground or network reachability change
- Sync status indicator in top bar reflects pending queue length

---

## Tech stack

| Need | Framework |
|---|---|
| UI | SwiftUI |
| Crypto (AES-GCM, PBKDF2) | `CryptoKit` |
| Biometrics | `LocalAuthentication` |
| Secure key storage | Keychain Services with `kSecAccessControlBiometryCurrentSet` |
| HTTP | `URLSession` |
| QR scanning | `AVFoundation` |
| Cached blob + offline queue | App sandbox file storage |

---

## Behavioral guarantees

- **Phone is strictly read-only for existing blocks.** Editing happens only on desktop.
- **Inbox persists** in R2 until desktop drains it — captures survive desktop being offline for any length of time.
- **Partial processing reflects on phone:** untouched entries stay visible as pending; processed/discarded ones disappear next sync.
- **One passphrase covers both blobs.** Set up once via QR (or manual), biometrics handle every subsequent unlock.
- **Capture drafts persist locally** until explicitly saved or deleted. No silent loss.

---

## Build sequence

| Step | Scope | Time |
|---|---|---|
| 1 | Cloudflare Worker + 5 endpoints | One evening |
| 2 | Desktop `/mirror` setup + QR generation + auto-export | Two evenings |
| 3 | Desktop `/inbox` command for triage | Long evening or two |
| 4 | iOS app, read-only with QR or manual setup | Weekend or two |
| 5 | iOS biometric unlock | An evening |
| 6 | iOS capture + offline queue | An evening |

Roughly three focused weekends total.

Each step is independently shippable. If at any point a current state is good enough, stop — no half-built system.

---

## Distribution

- Apple Developer Program ($99/year, already paid)
- Install directly from Xcode to iPhone via USB
- No TestFlight, no App Store

---

## Explicitly left out

- No bidirectional sync
- No conflict resolution
- No account system
- No real-time sync
- No native Android, no PWA
- No multi-user infrastructure (paths structured for future expansion only)
- No QR Option B (token-based pairing with per-device keys) — passphrase stays as the shared secret

---

## Pre-build checklist

- [ ] Apple Developer Program account active
- [ ] Xcode installed on Mac, Apple ID signed in
- [ ] iPhone trusts the Mac for development builds
- [ ] Cloudflare account has Workers and R2 enabled
- [ ] `wrangler` CLI installed and authenticated
- [ ] Worker URL decided (default `txtshell-sync.workers.dev` or custom subdomain)
- [ ] Vault passphrase for sync chosen and saved in password manager

---

## Recovery story

**If passphrase is forgotten:**
- Cloud blobs become unreadable forever
- Desktop blocks unaffected (still in local IndexedDB, still unlockable with the vault passphrase)
- Run `/mirror reset` on desktop to choose a new passphrase and re-upload fresh blobs
- Old encrypted blobs in R2 are now garbage; either delete via R2 dashboard or leave them

**If phone is lost or stolen:**
- Cloud blobs are encrypted; attacker without passphrase sees only ciphertext
- iOS biometric unlock protects the on-device key
- Optional: run `/mirror revoke` on desktop to delete cloud blobs

**If desktop is lost:**
- Cloud blobs intact and decryptable from phone
- Phone has read-only access; can still read and capture to inbox
- On replacement desktop, re-run `/mirror` setup with same passphrase to re-link, fetch blobs, restore state

---

## Notes for future-self

- The Worker code is platform-agnostic. If Android is ever added, the Worker doesn't change. Only the client app does.
- The QR ceremony works for any number of devices. Scan once per device; biometrics handle the rest.
- The inbox is intentionally minimal. Resist the urge to add tags, categories, or rich text to phone captures. Phone is a fast-capture surface; desktop is where structure happens.
- If usage patterns reveal that bidirectional sync is genuinely needed, that's a separate, much larger project. Don't slip it in incrementally — the architecture has to change.
- For multi-user expansion: replace hardcoded userId in the Worker with one extracted from auth tokens. Data layout (users/${userId}/...) is already multi-user-ready.
