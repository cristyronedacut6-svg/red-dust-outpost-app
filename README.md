# Red Dust Outpost

A pixel-art space outpost survival game for **Android** and the **web**, with an online backend.
Players run outposts on the Moon, Mars, Mercury, Europa and Titan, balancing power, air, food and
radiation shielding (based on NASA data) while fighting aliens, exploring, and calling Earth for help.

**Online features (Supabase backend)**
- Accounts: everyone starts as a guest automatically; add an email and password to keep progress on any phone
- Cloud save: stars, journal, badges, styles and campaign progress sync between devices
- Global leaderboards: overall, per world, daily and co-op
- Daily challenge: the same world and two twists for every player each day
- Live co-op: two players share one outpost using a 4-letter room code

The game also works fully offline. Online features switch on once you add your Supabase project.

---

## How it fits together

```
 Android app (Capacitor)  ─┐                ┌─ Auth ........ guest + email accounts
                           ├─ www/ game ────┤─ Database .... supabase/schema.sql
 Web version (GitHub Pages)┘   js/net.js    │   profiles, saves, scores + server-checked functions
                               js/coop.js   └─ Realtime .... co-op rooms (broadcast)
```

| Folder / file | What it is |
|---|---|
| `www/index.html` | The game |
| `www/js/net.js` | Online client: sign-in, cloud save, scores, leaderboard, daily challenge |
| `www/js/coop.js` | Two-player co-op: rooms, syncing the world between phones |
| `www/config.js` | **Your Supabase project URL and key go here** |
| `supabase/schema.sql` | The backend: tables, security rules and server functions |
| `.github/workflows/build.yml` | Builds the Android APK and the website on GitHub automatically |
| `scripts/android-setup.mjs` | Makes the Android app landscape, fullscreen, keeps the screen on |
| `assets/` | App icon and splash screen |

**Security:** players can never write to the database directly. Every change goes through a server
function that checks it first: scores must match the mission's stats, one score per 15 seconds,
names are validated, and each player can only read their own save.

---

## Step 1 · Set up the backend on Supabase (about 10 minutes)

1. Go to **supabase.com**, sign up for free, and click **New project**. Pick any name and a database
   password (save it somewhere), choose the region closest to you, and create it. Wait a minute or two.
2. In the left menu open **SQL Editor**, click **New query**, paste everything from
   `supabase/schema.sql`, and click **Run**. You should see "Success".
3. Open **Authentication → Sign In / Providers** (on some versions: Authentication → Providers):
   - Turn **on** "Allow anonymous sign-ins" (this lets players start as guests).
   - Under **Email**, turn **off** "Confirm email" (so players can save an account without an email link).
   - Save.
4. Open **Project Settings → API Keys** (or the **Connect** button at the top). Copy:
   - the **Project URL** (looks like `https://abcdefghijkl.supabase.co`)
   - the **anon** or **publishable** key (the public one, never the secret / service_role key)
5. Open `www/config.js` and paste them in:
   ```js
   window.RDO_CONFIG = {
     supabaseUrl: 'https://abcdefghijkl.supabase.co',
     supabaseKey: 'paste-the-anon-or-publishable-key-here'
   };
   ```
   This key is meant to be public; the security rules above protect the data.

## Step 2 · Put the project on GitHub

1. Create a **new repository** on GitHub (Public), or use your existing Red-Dust-outpost one and
   delete the old `index.html` file there first.
2. Upload **everything in this folder**, keeping the folders as they are. On the repo page click
   **Add file → Upload files** and drag in the contents of the unzipped folder
   (`www`, `supabase`, `scripts`, `assets`, `.github`, `package.json`, `capacitor.config.json`,
   `README.md`, `.gitignore`). Click **Commit changes**.
   - The `.github` folder is required for the automatic build. If your computer hides it, turn on
     hidden files (Windows: File Explorer → View → Show → Hidden items).
   - If dragging folders doesn't work, use **GitHub Desktop** (free) to add and push the folder.
3. Go to **Settings → Pages**, and under **Build and deployment → Source** choose **GitHub Actions**.

## Step 3 · Get the Android app

1. Open the **Actions** tab. A run called **Build app and website** starts automatically after each
   upload. Wait for it to finish (about 5 to 8 minutes) with a green check.
2. Open the **Releases** section on the right side of your repo's main page (or
   `github.com/YOUR-NAME/YOUR-REPO/releases/latest`).
3. Download **RedDustOutpost.apk** on an Android phone and open it. Android will ask you to allow
   installing apps from your browser or files app; allow it, then tap **Install**.
4. The web version is live at the address shown in **Settings → Pages**
   (`https://YOUR-NAME.github.io/YOUR-REPO/`). Anyone can play it there too, and it can be
   added to a home screen.

Every time you upload a change, GitHub builds a new APK and updates the website.

---

## Playing online

- **Account:** tap 👤 on the title screen to set your call sign or save an email account.
- **Leaderboard:** 🏆 on the title screen. Finishing a mission sends your score automatically.
- **Daily challenge:** 📅 on the title screen. New world and twists every day at midnight UTC.
- **Co-op:** 🤝 → **Host a game** shows a 4-letter code. Your friend taps 🤝 → types the code → **Join**.
  The host picks the world and starts. You share the base, crew, credits and ore; each of you
  walks, shoots, builds, uses EMP and calls Earth. The host runs the mission, so keep the host's
  phone on a good connection.

## If something goes wrong

| Problem | Fix |
|---|---|
| Title screen says "Offline mode" | `www/config.js` is empty or the URL/key has a typo. |
| "Online features unavailable: Anonymous sign-ins are disabled" | Step 1.3: turn on anonymous sign-ins. |
| Saving an account asks for an email link | Step 1.3: turn off "Confirm email", or click the link in the email. |
| Leaderboard says a function is missing | Run `supabase/schema.sql` again in the SQL Editor. |
| Co-op can't find the room | Both phones need internet and the same game version; check the code. |
| The Actions run is red | Open it to see which step failed. "Web version" failing usually means Settings → Pages → Source is not set to GitHub Actions. |
| Android blocks the install | Allow "Install unknown apps" for your browser or Files app, then open the APK again. |

## Building on your own computer (optional)

Needs Node.js 22, JDK 21 and Android Studio.
```bash
npm install
npm run android:create   # creates the android/ project and applies the game settings
npm run android:icons    # icon and splash screen
npm run android:apk      # APK at android/app/build/outputs/apk/debug/app-debug.apk
```

## Credits

Made for the space outpost hackathon challenge. Planet facts and numbers come from NASA's public
fact sheets and mission pages.
