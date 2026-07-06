# Txtshell

A fast, local-first, end-to-end encrypted notes app that runs entirely in your browser.

Your notes are saved instantly to encrypted storage **inside your own browser** — nothing
is sent to a server first. That's why it feels fast: every action (type, save, search)
happens locally, with no network in the way. And because your notes never leave your
device unless *you* choose to move them, there's no operator to trust — not even us.

**[txtshell.com](https://txtshell.com)**

---

## What makes it different

- **Local-first.** Notes live in your browser (IndexedDB), not on a server. Instant,
  offline-capable, private by default.
- **End-to-end encrypted.** Your notes are encrypted with a master key that never leaves
  your device (AES-256-GCM). Your passphrase unlocks that key locally; the passphrase and
  key are never uploaded anywhere.
- **No account, no server.** The default experience requires no sign-up and no backend.
  There is nothing for anyone to breach, subpoena, or read — because there's no server
  holding your data in the first place.
- **You own your data.** Move it or back it up whenever you want with an encrypted export
  file (see below). Your notes are portable and yours.

---

## Getting started

Open [txtshell.com](https://txtshell.com) and start typing. To protect your notes:

1. Run `/encrypt` to set up your vault and passphrase. This creates your master key —
   everything is encrypted locally with it.
2. Write. Everything saves instantly and privately to your browser.

That's the whole app. No account, no setup, no cloud.

---

## Moving your notes between devices — export / import

The primary way to back up your notes or move them to another device is an **encrypted
export file**. It's self-contained: it holds your encrypted notes plus the wrapped keys, so
it can be restored with your passphrase (or recovery key) alone.

- **`/export`** — downloads an encrypted `.json` file of all your notes. Keep it as a
  backup, or carry it to another device.
- **`/import`** — on any device, load an export file and enter your passphrase to restore
  your notes.

This is the recommended way to keep your notes safe and portable. It needs no server, no
account, and no infrastructure — just a file you control. Export regularly; that file is
your backup, and (since encryption means a lost key can't be recovered) it's your safety
net if you ever lose access to a device.

---

## Optional: live sync across devices (for technical users)

If you want your notes to sync **automatically** across browsers and devices rather than
moving an export file by hand, Txtshell supports self-hosted sync — but it's an **advanced,
optional feature aimed at technical users**, not part of the default experience.

Because Txtshell has no central server, sync works by having you deploy **your own**
Cloudflare Worker as private, end-to-end-encrypted storage on **your own** account. The
master key still never leaves your device; the Worker only ever stores ciphertext it cannot
read. There is no Txtshell-operated backend and no one but you can access your data.

**What it takes:** a (free) Cloudflare account, a one-click Worker deploy, and activating
R2 storage (free tier). It's a few minutes for someone comfortable with a developer
dashboard. Full instructions are in the sync backend repo:

**→ [txtshell-sync](https://github.com/gitkvn/txtshell-sync)** — deploy guide + endpoints.

Once your Worker is deployed, connect it in the app:

- **`/sync setup`** — paste your Worker URL and auth token; your notes push to your Worker
  automatically from then on.
- **`/mirror`** / **`/port`** — pair additional devices: `/mirror` shows pairing data on a
  set-up device; `/port` on a fresh device imports it and pulls your notes.
- **`/pull`** — fetch the latest from your Worker on demand.

If you don't set up sync, none of this applies — Txtshell is fully functional as a
local-first tool with encrypted export/import.

---

## Security model, briefly

- The master key is generated on your device and **never leaves it unencrypted**.
- Your passphrase wraps that key locally; neither is ever uploaded.
- With sync, your Worker stores only ciphertext — a breach of it yields unreadable data.
- The app enforces a strict Content-Security-Policy (`script-src 'self'`, no inline/eval)
  and pins its one vendored dependency with Subresource Integrity, to keep foreign code
  out of the page where your unlocked key lives.
- Honest limit: because a lost master key cannot be recovered by anyone (that's what keeps
  your notes private), your encrypted export file — or a second device — is your only way
  back if you lose access. Keep an export.

---

## Repos

- **txtshell** (this repo) — the app.
- **[txtshell-sync](https://github.com/gitkvn/txtshell-sync)** — the optional, self-hosted
  Cloudflare Worker for technical users who want live sync.
