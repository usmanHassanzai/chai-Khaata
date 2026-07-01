# Chai Khata 🍵

Tea shop ledger — **one codebase** for **Web** and **Android**.

Track sales (Dukaan), purchases (Godaam), stock, customer dues, and dealer balances. All numbers are calculated automatically from your entries — nothing is typed in by hand.

## Features

- **Dashboard** — today's/month's/year's sales, profit, stock value, dues, low-stock alerts
- **Dukaan (Sale)** — live stock check, profit calculation, customer credit
- **Godaam (Warehouse)** — dealers, purchases with miss-weight, dealer dues
- **Customers** — credit tracking, payments, history
- **Stock Ledger** — live inventory per tea with low-stock threshold
- **Languages** — English + Roman Urdu (default)

## Quick Start (Web)

```bash
cd "chai khaata"
npm install
npm run dev
```

This starts **both** the auth server and the web app in one command.

Open http://localhost:5173 (or 5174 if 5173 is busy).

**Admin login:**
- Email: `usmankhan14700@gmail.com` **or** username: `admin`
- Password: `admin123`

### If `npm run dev` fails

```bash
# 1. Install dependencies (required once)
npm install

# 2. Free blocked ports from old runs
npm run free-ports

# 3. Start again
npm run dev
```

**Or use two terminals:**

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:web
```

## Build for Production

```bash
npm run build
npm run preview
```

## Android App

Your `npx cap add android` and `npx cap sync` steps **already succeeded**. The error is only from `npx cap open android`, which tries to launch **Android Studio** — and Android Studio is **not installed** on your PC (Java/JDK is also missing).

### Option A — Install Android Studio (for native APK)

**1. Install Android Studio (Ubuntu)**

Download from: https://developer.android.com/studio

Or install the tarball:

```bash
# Example: extract to ~/android-studio, then run:
~/android-studio/bin/studio.sh
```

On first launch, Android Studio will install the Android SDK and JDK for you.

**2. Tell Capacitor where Studio is** (if not in the default path):

```bash
export CAPACITOR_ANDROID_STUDIO_PATH="$HOME/android-studio/bin/studio.sh"
# Add that line to ~/.bashrc so it persists
```

**3. Build and open the project**

```bash
npm run build
npx cap sync
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

**4. Or build APK from terminal** (after SDK + Java are installed):

```bash
npm run android:apk
```

**Check what's missing on your machine:**

```bash
npm run cap:check
```

---

### Option B — Use on Android without Android Studio (PWA)

This works **right now** — no Studio needed:

**On your PC:**

```bash
npm run dev -- --host
```

Note your PC's IP (e.g. `192.168.1.5`). On your **Android phone** (same Wi‑Fi):

1. Open Chrome → `http://192.168.1.5:5173`
2. Menu (⋮) → **Add to Home screen** or **Install app**
3. Chai Khata opens like a normal app and saves data on the phone

For production PWA, deploy the `dist/` folder to any web host, or serve locally with `npm run preview -- --host`.

---

### What each command does

| Command | What it does |
|---|---|
| `npm run build` | Builds the web app into `dist/` |
| `npx cap sync` | Copies `dist/` into the Android project |
| `npx cap open android` | Opens Android Studio (needs Studio installed) |
| `npm run android:apk` | Builds debug APK via Gradle (needs JDK + SDK) |

Requires [Android Studio](https://developer.android.com/studio) for the native APK workflow.

## Install as PWA (Android without Play Store)

1. Open the website in Chrome on Android
2. Tap menu → **Add to Home screen**
3. Works offline after first load

## Login & User Access

Chai Khata uses a **service-based login**. Users register, you approve them as admin, then they can log in.

### 1. Start the auth server + web app

**Terminal 1 — auth server:**

```bash
npm run dev:server
```

**Terminal 2 — web app:**

```bash
npm run dev
```

Or copy `.env.example` to `.env` and adjust `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### 2. Admin account

On first run, an admin account is created from `.env`:

| Field | Default |
|---|---|
| Email | `usmankhan14700@gmail.com` |
| Password | `admin123` |

Log in with your **email** (not username). Change the password in `.env` before first start in production.

### 3. How it works

1. **Sign up** — User registers with username, email, and password
2. **Pending** — Account waits for admin approval (cannot log in yet)
3. **Admin approves** — Log in as **usmankhan14700@gmail.com** → **Settings → User Approvals** → Approve
4. **User logs in** — Approved user signs in with their **email** and password

Each user's shop data is stored **locally on their device** (IndexedDB), scoped to their account.

### 4. Phone / network access

For Android PWA on the same Wi‑Fi, run both servers with host access:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev -- --host
```

On the phone, set API URL before build (or create `.env.local`):

```
VITE_API_URL=http://YOUR_PC_IP:3001
```

Then open `http://YOUR_PC_IP:5173` on the phone.

---

## Data & Privacy

Shop ledger data (sales, stock, customers) stays **on the device** in IndexedDB. Only **login accounts** are stored on the auth server.

## Tech Stack

- React + TypeScript + Vite
- Express auth server (register, login, admin approval)
- Dexie (IndexedDB) for local shop data per user
- react-i18next for English / Roman Urdu
- Capacitor for Android packaging
- PWA support for installable web app

## Documentation

See [chai-khata-documentation.md](./chai-khata-documentation.md) for full business logic and field definitions.
