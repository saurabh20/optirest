# 👁️ OptiRest

> Protect your eyes from digital strain with the **20-20-20 rule** — every 20 minutes, look 20 feet away for 20 seconds.

Built with Electron. Runs on **macOS**, **Windows**, and **Linux**.

Made with ❤️ by [Saurabh Mukhekar](https://www.blogsaays.com)

---

## Table of Contents

- [What is the 20-20-20 rule?](#what-is-the-20-20-20-rule)
- [Features](#features)
- [Installation](#installation)
- [First Launch — Onboarding](#first-launch--onboarding)
- [How the App Works](#how-the-app-works)
- [Break Overlay](#break-overlay)
- [Settings](#settings)
- [Statistics](#statistics)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tray Menu](#tray-menu)
- [Background Customisation](#background-customisation)
- [Social Sharing](#social-sharing)
- [Building from Source](#building-from-source)
- [Project Structure](#project-structure)
- [Platform Notes](#platform-notes)

---

## What is the 20-20-20 rule?

Doctors recommend the **20-20-20 rule** to reduce Computer Vision Syndrome (digital eye strain):

| Every | Look at | For |
|-------|---------|-----|
| **20 minutes** | something **20 feet** away | **20 seconds** |

OptiRest automates this — you just work normally and it reminds you.

---

## Features

| Feature | Description |
|---------|-------------|
| ⏱️ **Smart timer** | Drift-free countdown using `Date.now()` targets — survives sleep/wake cycles |
| 🖥️ **Multi-display** | Full-screen overlay covers every connected monitor simultaneously |
| 🎯 **6 Eye exercises** | Rotates: rest, blink reset, eye roll, palming, near/far focus, figure-8 |
| 🌅 **Custom backgrounds** | Upload up to 5 images that rotate during breaks, or choose a gradient |
| 🎨 **Gradient picker** | Custom start/end color + angle — live preview in settings |
| ✏️ **Adaptive text** | Text color auto-adjusts (WCAG contrast) against any background or image |
| 📊 **Statistics** | Daily compliance rate, 7-day bar chart, completed vs skipped counts |
| 📱 **Social sharing** | Share stats to X, WhatsApp, Facebook, or TikTok |
| 🔔 **System notifications** | Native OS notifications on break start/end |
| ⏭️ **Postpone / Skip** | Delay a break or skip it — tracked in statistics |
| ⏸️ **Pause** | Temporarily suspend all reminders |
| 🕐 **Working hours** | Only remind between configured hours (e.g. 9am–6pm) |
| 🚀 **Auto-start** | Optional login item — user chooses during onboarding |
| 🔇 **Sound toggle** | Plays completion sound when break finishes |
| 🔄 **Single instance** | Only one copy runs at a time |

---

## Installation

### Download pre-built binaries

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `OptiRest-1.0.0-arm64.dmg` |
| macOS (Intel) | `OptiRest-1.0.0-x64.dmg` |
| Windows | `OptiRest Setup 1.0.0.exe` |
| Linux | `OptiRest-1.0.0.AppImage` |

### macOS
1. Open the `.dmg` file
2. Drag **OptiRest** to your Applications folder
3. Open it from Applications — macOS may ask for permission on first run (Gatekeeper)
4. The app appears in your **menu bar** (top-right) — no dock icon

### Windows
1. Run `OptiRest Setup 1.0.0.exe`
2. Follow the NSIS installer
3. The app launches after install and appears in the **system tray** (bottom-right)

### Linux
1. Make the AppImage executable: `chmod +x OptiRest-1.0.0.AppImage`
2. Run it: `./OptiRest-1.0.0.AppImage`
3. App appears in the **system tray**

---

## First Launch — Onboarding

On first launch OptiRest shows a **5-step setup wizard** before starting.

### Step 1 — Welcome
Introduces the 20-20-20 rule with a visual card layout.

### Step 2 — How it works
Explains the break overlay, postpone/skip controls, and statistics.

### Step 3 — Set your break interval
A slider (10–60 min) lets you choose how often breaks fire.
Default: **20 minutes** (the medically recommended interval).

### Step 4 — Start at login?
Choose whether OptiRest launches automatically when you log in.

> **Recommended: Yes** — so you never forget to start it.

Two choices:
- ✅ **Yes, start automatically** — OptiRest registers as a login item
- 🖐️ **No, I'll start it manually** — you open it yourself each session

### Step 5 — All set
Summary of your chosen settings. Click **Start OptiRest 🚀** to begin.

After onboarding completes your settings are saved and the timer starts immediately. Onboarding never appears again unless you delete the app's data directory.

---

## How the App Works

```
App starts
    │
    ├── First launch? ──Yes──► Onboarding wizard ──► Save settings
    │                                                      │
    └── Returning user?──────────────────────────────────►┤
                                                           │
                                              Tray icon appears
                                              Timer starts (default 20 min)
                                                           │
                                              Every N minutes:
                                                           │
                                              ┌────────────▼────────────┐
                                              │  Break overlay appears  │
                                              │  on ALL displays        │
                                              └────────────┬────────────┘
                                                           │
                                         ┌─────────────────┼──────────────────┐
                                         │                 │                  │
                                    Complete           Postpone            Skip
                                    (20s done)         (delay Nm)       (count missed)
                                         │                 │                  │
                                    Stats++           New timer           Stats++
                                    Sound plays       starts              Tray turns red
                                                                          (3+ skips)
```

### Timer behaviour
- Uses `Date.now()` target + `setTimeout` — no drift
- Resets to full interval after **every** break (manual or automatic)
- Pauses during system sleep, restarts on wake
- Skips firing outside working hours (if enabled), retries every minute

---

## Break Overlay

When a break fires, a full-screen overlay appears on **every connected display**.

### What you see
- **Exercise title** — randomly picked from 6 exercises each break:
  - *Rest Your Eyes* — Look 20 feet away
  - *Blink Reset* — Blink rapidly 10–15 times
  - *Eye Roll* — Full circle eye rotation
  - *Palming* — Cup warm hands over closed eyes
  - *Near & Far Focus* — Alternate near/far focal points
  - *Figure-8 Trace* — Trace a figure-8 with your eyes

- **Circular countdown** — SVG progress ring counts down from your configured duration (default 20 seconds)

- **Breathing animation** — The circle gently pulses (4-second inhale, 6-second exhale) to guide relaxed breathing

- **Background** — Default deep-blue gradient, your custom gradient, or rotating uploaded images with smooth crossfade

- **Frosted glass card** — Text sits on a `backdrop-filter: blur` panel for readability on any background

### Completing a break
When the timer reaches 0:
- The progress ring turns green, a ✓ appears
- A sound plays (if enabled)
- The overlay closes after 1.5 seconds
- A system notification confirms: *"Break completed! Your eyes are refreshed."*
- Statistics update: completed count +1

### Dismissing a break early

| Action | macOS | Windows / Linux | Effect |
|--------|-------|-----------------|--------|
| **Postpone** | `Ctrl + Shift + P` | `Ctrl + Alt + P` | Delays break by your postpone duration (default 5 min), then fires again |
| **Skip** | `Ctrl + Shift + K` | `Ctrl + Alt + K` | Cancels break, increments skipped count. Tray icon turns red after 3 consecutive skips |

---

## Settings

Open via: **Tray icon → Settings**

### Break Configuration

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Break interval | 5–60 min | 20 min | How often breaks fire |
| Break duration | 10–60 sec | 20 sec | How long the overlay stays |
| Postpone duration | 1–30 min | 5 min | Delay when you hit Postpone |

All three use **sliders** with live value display.

### Preferences

| Setting | Default | Description |
|---------|---------|-------------|
| Enable completion sound | On | Plays a sound when break finishes |
| Start automatically at login | Off | Launch on OS login (set during onboarding) |
| Custom reminder message | Empty | Overrides the rotating exercise titles |

### Working Hours

Enable to restrict reminders to a time window.

- Toggle: **Enable working hours**
- Time range: **Start time** and **End time** (e.g. 09:00 – 18:00)
- Outside this window the timer retries every minute until you're back in range

### Break Background

Three modes (mutually exclusive):

#### Default
Deep-blue gradient (`#0a0e27 → #0d2137`). Always readable, no setup needed.

#### Gradient
Pick two colors + angle using native color pickers. A **live preview** updates as you adjust. Saved immediately on hitting Save.

#### Images
Upload up to **5 images** (PNG, JPG, GIF, WebP).
- Displayed as a thumbnail grid with remove buttons
- Images **rotate** during the break — each image shows for `breakDuration / imageCount` seconds
- Transitions use a smooth **crossfade** (0.9s) between two background layers — the countdown timer and text are never affected
- Text color **auto-adjusts** (WCAG luminance formula) for readability against each image

---

## Statistics

Open via: **Tray icon → Statistics**

### Stat cards (top row)

| Card | What it shows |
|------|--------------|
| **Total Breaks** | All breaks that have been triggered |
| **Completed** | Breaks you sat through to 0 |
| **Skipped** | Breaks you dismissed early |
| **Compliance** | `completed / total × 100%` |

### 7-Day chart
Bar chart (Chart.js) showing completed (green) and skipped (red) breaks for each of the last 7 days.

### Last break
Time-ago label: "Just now", "12 minutes ago", "3 hours ago", etc.

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux | Active when |
|--------|-------|-----------------|-------------|
| Take a break immediately | `Ctrl + Shift + B` | `Ctrl + Shift + B` | Always |
| Postpone current break | `Ctrl + Shift + P` | `Ctrl + Alt + P` | During a break |
| Skip current break | `Ctrl + Shift + K` | `Ctrl + Alt + K` | During a break |

> **Why different on Windows?** `Ctrl + Shift + P` and `Ctrl + Shift + K` are claimed globally by apps like VS Code on Windows, causing silent conflicts. `Ctrl + Alt + P/K` avoids this.

---

## Tray Menu

Click the tray icon to open the context menu.

```
Next break in 14m          ← live countdown (updates every 30s)
─────────────────
Take Break Now             Cmd+Shift+B
Pause Breaks               (toggles to Resume Breaks)
─────────────────
Settings
Statistics
─────────────────
About
Quit                       Cmd+Q
```

**Tray icon states:**
- Normal icon — all good
- Red icon — 3 or more consecutive breaks skipped
- Tooltip — "OptiRest — next break in 14m" or "OptiRest — paused"

**macOS:** Double-click tray icon to trigger an immediate break.

---

## Social Sharing

Open via: **Statistics → Share Stats button**

A modal appears with your current stats and four platform buttons.

### X (formerly Twitter)
- Opens `x.com/intent/tweet` with pre-formatted text
- Format: title + stats line + hashtags + `blogsaays.com`
- Length: ~215 characters (well within 280 limit)
- Text also copied to clipboard as fallback

### WhatsApp
- Opens `wa.me/?text=` (works on WhatsApp Web and mobile)
- Format: *bold* title + full stats breakdown + link + hashtags

### Facebook
- Opens Facebook Sharer with `blogsaays.com` for OG preview
- Stats text copied to clipboard — paste manually in your post

### TikTok
- No public web share URL exists for TikTok on desktop
- Caption with `#EyeTok #HealthTok` hashtags copied to clipboard
- Open TikTok and paste into your video caption

### Hashtags used
```
#EyeCare #ProtectYourEyes #HealthyVision #DigitalEyeStrain
#EyeHealthMatters #VisionCare #ScreenFatigue #EyeWellness
```

---

## Building from Source

### Prerequisites

```bash
node --version   # 18+ required
npm --version    # 8+ required
```

### Clone and install

```bash
git clone https://github.com/yourusername/optirest.git
cd optirest
npm install
```

### Run in development

```bash
npm start
```

### Build distributables

```bash
# macOS (DMG + zip)
npm run dist-mac

# Windows (NSIS installer + MSIX)
npm run dist-win

# Linux (AppImage)
npm run dist-linux

# All platforms
npm run dist
```

Output goes to `dist/`.

> **Building Windows from macOS:** electron-builder auto-downloads Wine and winCodeSign — no manual setup needed.

### Regenerate icons (if you replace the source icon)

```bash
# Requires: source PNG at 1024x1024 minimum

# macOS icns
mkdir -p /tmp/AppIcon.iconset
for size in 16 32 128 256 512; do
  sips -z $size $size youricon.png --out /tmp/AppIcon.iconset/icon_${size}x${size}.png
  sips -z $((size*2)) $((size*2)) youricon.png --out /tmp/AppIcon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns /tmp/AppIcon.iconset -o src/assets/icons/app-icon.icns

# Windows ico (requires png-to-ico)
node --input-type=module -e "
import pngToIco from 'png-to-ico';
import fs from 'fs';
const buf = await pngToIco(['youricon-256.png']);
fs.writeFileSync('src/assets/icons/app-icon.ico', buf);
"
```

---

## Project Structure

```
optirest/
├── package.json                  App config, build targets
├── src/
│   ├── main.js                   Main process — tray, windows, IPC, timer
│   ├── preload.js                Context bridge — secure renderer↔main IPC
│   ├── store.js                  JSON config store (userData/config.json)
│   └── renderer/
│       ├── onboarding.html/js/css   First-launch 5-step wizard
│       ├── countdown.html/js/css    Full-screen break overlay
│       ├── settings.html/js/css     Settings window
│       ├── statistics.html/js/css   Stats window + share modal
│       └── chart.umd.min.js         Chart.js (bundled, no CDN)
└── src/assets/
    ├── icons/
    │   ├── app-icon.icns         macOS app icon (multi-size)
    │   ├── app-icon.ico          Windows app icon (256x256 multi-size)
    │   ├── tray-icon.png         Menu bar icon 22x22 (macOS)
    │   ├── tray-icon.ico         System tray icon (Windows)
    │   └── tray-icon-red.png/ico Red variant (3+ skips)
    └── sounds/
        └── complete.mp3          Break completion sound
```

### Data stored on disk

OptiRest stores all data in the OS user data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/optirest/` |
| Windows | `%APPDATA%\optirest\` |
| Linux | `~/.config/optirest/` |

Files:
- `config.json` — all settings + statistics
- `backgrounds/` — uploaded background images

---

## Platform Notes

### macOS
- Runs as a **menu bar app** — no dock icon
- Double-click tray icon to trigger immediate break
- `app.showAboutPanel()` used for native About dialog
- `setLoginItemSettings` handles auto-start
- Tray icon is a standard PNG (22×22) — works in both light and dark menu bars

### Windows
- Runs in the **system tray** (notification area, bottom-right)
- Uses `.ico` for tray and app icons (256×256 multi-size)
- Sound playback via PowerShell `Media.SoundPlayer`
- About dialog uses `dialog.showMessageBox` with `.ico` icon

### Linux
- Tray support depends on the desktop environment (works on GNOME with AppIndicator extension, KDE, XFCE)
- Sound via `paplay`, `aplay`, or `ffplay` (whichever is available)
- Distributed as AppImage — no installation required

---

## Troubleshooting

**App not showing in menu bar / tray**
- macOS: Check System Preferences → Privacy & Security → Allow OptiRest
- Windows: Click the `^` arrow in the taskbar to reveal hidden tray icons

**Break overlay not appearing**
- Check if breaks are paused (tray menu → Resume Breaks)
- Check working hours settings — you may be outside the active window
- Try triggering manually: `Cmd/Ctrl + Shift + B`

**Sound not playing**
- Settings → enable "Enable completion sound"
- Linux: ensure `pulseaudio`, `alsa-utils`, or `ffmpeg` is installed

**Auto-start not working in development**
- Login items only work in packaged builds (`npm run dist-mac`)
- Running `npm start` in dev mode will log "Auto-start only available in packaged apps"

**Reset onboarding** (for testing)
Delete or edit `config.json` in the user data directory:
```bash
# macOS
rm ~/Library/Application\ Support/optirest/config.json

# Windows
del %APPDATA%\optirest\config.json
```

---

## License

MIT © [Saurabh Mukhekar](https://www.blogsaays.com)
