# Red Dust Outpost

A pixel-art space outpost survival game for **Android** and the **web**, with an online backend.
Players run outposts on the Moon, Mars, Mercury, Europa, Titan and Ceres, balancing power, air, food and
radiation shielding (based on NASA data) while fighting aliens, exploring, and calling Earth for help.

**Online features (Supabase backend)**
- Accounts: everyone starts as a guest automatically; add an email and password to keep progress on any phone
- Cloud save: stars, journal, badges, styles and campaign progress sync between devices
- Global leaderboards: overall, per world, daily and co-op
- Daily challenge: the same world and two twists for every player each day
- Live co-op: two players share one outpost using a 4-letter room code

**Gameplay systems**
- **The story is hidden in the campaign**: Mission Control slips up, every world has a strange discovery to scan,
  your crew talks between waves, and a faint "thank you" comes through the radio after each boss
- **Two endings**: spare all six bosses for the true ending, where the freed aliens fight beside you. Story credits roll over
  photos of your own outposts, with a post-credits scene. After the ending, hunt the six hidden gates from the title screen
- **Secret 7th world and a story twist**: get 3 stars on all six worlds and a strange signal leads you to Echo, a purple
  alien world. Finish it to learn who really sent you into space (no spoilers here). For a demo, tap the
  RED DUST OUTPOST logo on the title screen 5 times to unlock Echo right away
- **Squad hero and robot dog**: a named hero fights next to you, levels up on every world, and is gone for good if
  they fall. Sparky the robot dog digs up ore and barks when aliens come
- **Spare a boss**: when a boss is almost beaten you can spare it, and it guards you on every world after that
- **Living world**: aliens are stronger at night, dust and spore storms roll in as a wall you can see, and from wave 3
  the aliens learn where your defenses are weakest and tunnel in from that side
- **Real fact cards**: real NASA science pops up when storms, nights, meteors and bosses happen (switch off in Settings)
- **Postcards**: photo mode turns your base into a postcard with the world, wave and date, ready to share
- **Daily base ghost**: after a daily challenge, see your base next to the top player's base
- **Moon Productions intro**: an animated team intro and the game logo play when the game opens (tap to skip)
- **Showcase demo**: one button on the title screen tours every world, event and story beat in 10 steps (about 4 to 5 minutes),
  played live while a presenter talks. Each step has a timer bar, a pause button and Next. The base is protected
- **HD view (new)**: pick 2D, 3D or **HD ✨** on the title screen, or tap the view button in game. HD has smooth
  hills, craters, dunes and ice ridges, anime-style cel shading with ink outlines and rim light, clouds on worlds
  with air, a detailed jointed astronaut and a wider camera behind you. It switches back to 3D by itself if a phone is too slow
- **Real gravity physics**: in 3D and HD, tap **JUMP** (or press J). Each world uses its real NASA gravity, so you
  float for 2 s on the Moon and almost 13 s on Ceres. In HD the rover's suspension also follows that gravity, so it
  can fly off crater rims on low-gravity worlds
- **Boss fight**: the ⚔️ Boss fight button on the title screen jumps straight into any world's boss battle in HD
- **Great Dust Worm (HD)**: the Mars boss uses the "Giant Worm" 3D model by Vasian-Digital3D (Sketchfab, CC-BY-4.0,
  credited in the game's sources screen). It is skinned with its real skeleton and plays baked animation clips: it roars
  when it bursts out, rears up and slams for the sand jets, lunges for the tail sweep, and does a biting combo while
  spitting glowing acid globs. New effects: glowing ground cracks before it surfaces, rocks thrown on Mars-gravity
  arcs, shockwaves, sand geysers along the jets, a glowing throat weak point, and a stagger animation when stunned.
  Baked into `www/js/worm.js` by `tools/bake_worm.py`
- **HD v5**: the robot ally is NASA's Robonaut 2 (skinned, walks and aims), Sparky is a jointed quadruped robot dog with a
  trotting gait, and buildings change as you upgrade them, like Clash of Clans: level 2 adds silver trim and corner
  lights, level 3 adds gold pylons, banners and a beacon. The base core grows a radio mast, then solar wings, an airlock
  and a dish, then a second habitat module, a greenhouse dome, a landing pad and a flag. Bosses get a glowing weak point
  (white when stunned), a red warning ring before attacks, and a signature halo, crown or ice spikes
- **HD v4**: free orbit camera (drag to look anywhere, scroll or pinch to zoom, move where the camera faces), the
  astronaut has a real 10-bone skeleton with smooth skin at shoulders, elbows, hips, knees and neck, poses blend
  smoothly and turning is eased. Rounded smooth shapes replace hard boxes on aliens, bosses and buildings, bosses
  get orbiting energy shards and a glowing ring, the rover is bigger, and the NASA models are about 2x more detailed
- **HD v3: real NASA models**: in HD, your crew are the NASA astronaut model, the rover is Perseverance, the base core and
  habitats are NASA's Habitat Demonstration Unit, drills are the RASSOR mining robot, the landing craft is the Apollo
  Lunar Module, the helper drone is Ingenuity, and a Deep Space Network dish stands beside the base. Models come from
  NASA 3D Resources (public domain), simplified into `www/js/models.js` by `tools/bake.py`
- **Emotes**: tap 💃 EMOTE (or press Y) for Dance, Wave, Cheer, Flip, Sit and Party. Your crew joins in when you dance,
  dancing plays a little beat, and Flip does a backflip using the world's real gravity
- **HD v2 (Genshin-style)**: the astronaut's height follows the hills, so running off a crest or crater rim
  launches you with that world's gravity, uphill is slower, and landings kick up dust. Hold JUMP while falling
  to open a glider. New sci-fi rifle with glowing rings and a muzzle flash, glowing tracer shots, a scarf that
  hangs with real gravity and flutters only on worlds with air, colored ink outlines, glow on lights, drifting
  light specks, and glowing crystal grass on Echo. New layered rifle, scatter and plasma sounds in every view
- **Cleaner title screen**: pick a world and it flies into orbit around Earth on its own, with its real NASA data beside it.
  Extra menus sit behind one "More" button
- **Arrival flyover**: each new world opens with a short camera sweep over the terrain and a NASA data card (tap to skip)
- **Lighter HUD and a hands-on tutorial**: 7 short do-it steps instead of a long reading tour, and brighter, more cartoon colors
- **The ending in co-op**: after Echo, both players watch the twist, fight the gate battle together, then see the ending and credits
- **Story in co-op**: both players see the squad hero, Sparky, the Guardian, every discovery, the creepy voice and the boss choice.
  Either player can scan a discovery. Echo can be played in co-op once it is unlocked
- **Co-op roles**: the host can split the team into a Builder (top view, cheaper buildings) and a Soldier (first person, stronger shots)
- **The rover is not a safe shelter**: aliens and bosses damage its armor when they reach it, its battery drains while
  driving and recharges when parked (faster at the base), and if the armor runs out it breaks down and throws the crew out
- **Raids from one side**: from wave 2, Mission Control warns which side the wave comes from and a red arrow points there
- **Mini-boss at wave 3**: a big Alpha alien that slams the ground, with a red warning circle first
- **Upgrades you can see**: level 2 and 3 buildings get extra parts and gold trim, and turrets get more barrels
- **New look**: one "mission control glass" style for menus and the HUD, menus slide in, and the results screen pops the stars in and counts up aliens, coins and buildings
- **12 languages**: English, Filipino, Bisaya (Cebuano), Español, Français, Português, Deutsch, Bahasa Indonesia,
  日本語, 中文, 한국어 and हिन्दी for the menus, buttons, tutorial and Field Guide (Settings > 🌐). Some mission stories stay in English
- **Accessibility**: bigger buttons, colorblind-friendly bar colors, reduced flashing, big text, striped danger zones
- **Game feel**: hits knock aliens back, damage numbers pop, defeated aliens burst into pieces, big hits freeze for a split
  second, bosses explode in slow motion, phone vibration on big hits, footsteps that sound different on each world
- **Harder meteor showers**: more meteors, some aimed at your buildings, and one giant meteor at the end
- **Beginner tutorial and Field Guide**: the tutorial walks new players through each bar at the top (power, air,
  food, radiation, health, ore, coins) with a spotlight, and shows how a building trades one thing for another.
  The first time you pick a building, a card shows what it makes, what it uses and when it works. The Field
  Guide (title screen and pause menu) lists every bar and building
- **3D view, mid-poly**: detailed models for every building, alien, vehicle and robot (six-wheel rover, jointed alien legs, spinning drills, Tesla arcs, parachute supply pods), better lighting, three cameras (top view, behind your
  astronaut, and first person through the astronaut's eyes), and cinematic camera shots for bosses, meteors,
  storms and supply drops (shown in 3D even when you play in 2D)
- **Scarier bosses and boss music**: every boss has a glowing aura, rising embers, glowing eyes and extra
  armor, crystals, tusks or blades, and turns red when enraged. Boss fights have their own intense soundtrack
  that speeds up when the boss is enraged
- **3D story scenes**: the intro, the launch, each trip between worlds and the ending are 3D scenes with
  planets painted in code (switch back to the pixel scenes in Settings)
- **Clean look**: simple symbols instead of lots of emojis (switch back to emojis in Settings), and features
  unlock step by step: the Moon teaches the basics, Mars adds power cables, beds and expeditions, Mercury adds
  research, new defenses and Alpha aliens
- **Boss fights with red warnings**: every boss has 4 attacks (cones, rings, beams, falling rocks, dashes),
  each shown as a red zone that fills up before it hits, plus an enraged phase at half health.
  New Charger and Bomber aliens also warn before they attack
- **Real Space Rescues**: 4 short missions based on real emergencies (Apollo 13, the 2018 Mars dust storm that
  ended the Opportunity rover, the ISS air leak, the 1997 fire on Mir). Make the right choices, then see what
  really happened. Any building can be switched off to save power
- **Every mission plays differently**: random emergencies (air leaks, fires, sick crew, lost cargo) with a
  timer, a different twist each wave (swarm, armored, flyers, chargers, bombers), and checkpoints so you can
  retry from the start of the last wave
- **Report card "What if?" coaching**: tells you how many more batteries or O2 generators would have saved the base
- **For teachers**: a built-in teacher guide (learning goals, a 40-minute lesson plan, discussion questions)
  and a sources page with links for the facts in the game
- **Phone, tablet or computer layout**: picked automatically (or in Settings). Phones get a compact HUD and a
  "Pick" button for buildings so nothing covers the game; computers get keyboard hints (1-9, B, E, F, Q, Space)
- **Accessibility**: striped danger zones for colorblind players and a big-text option
- **Commander rank and daily quests**: earn XP for everything, rank up through 15 ranks with their own badges, for bonuses and new suits, 3 new
  quests every day, and a daily streak
- **2D pixel or 3D low-poly view**: switch any time with the 3D button or in Settings. The 3D view is drawn with
  a small built-in WebGL renderer (no extra libraries), with a camera you can turn (⟲ ⟳) and zoom (🔍)
- **Power grid**: buildings must be connected to the core by cables. Pylons carry power farther
- **Smart layouts**: farms next to O2 generators grow more, shields only protect near where the crew lives,
  solar panels next to batteries lose less power
- **Crew morale and beds**: Habitats give the crew beds. Crowded or hungry crews get unhappy and work slower
- **Research lab**: 12 real NASA technologies (MOXIE, Veggie, Kilopower, iROSA, BEAM and more), paid for with
  🔬 science points from discoveries, missions and Scientists
- **Missions**: 3 missions on every world, based on real mission problems
- **Event cutscenes**: bosses, meteor showers, storms, supply ships, the final wave and Mission Control calls
  each get a short cinematic with a camera swoop (can be switched off in Settings)
- **Living sky in 3D**: the sun moves across the sky, Mars has blue sunsets, airless worlds show stars all day,
  dust storms roll in as a wall, and meteors fall from the sky
- **Mission report card**: grades for power, air, food, shielding and morale, a chart of the whole mission,
  tips on what went wrong, and a comparison with a real NASA mission
- **Live NASA space weather**: real solar flares and CMEs from NASA's DONKI database make storms stronger
  (add your own free key from api.nasa.gov as `nasaKey` in config.js if the shared demo key runs out)
- **Rover expeditions**, **Walls and Tesla coils**, **Alpha aliens**, and a sixth world: **Ceres** with low
  gravity and the Asteroid Colossus boss
- **Photo mode**: pause → 📷 Photo mode to move the camera freely and save a picture of your outpost

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
| `www/js/render3d.js` | The 3D mid-poly view and cameras (WebGL) |
| `www/js/i18n.js` | Translations for 12 languages |
| `www/js/cut3d.js` | The 3D story scenes: Earth, launch, travel, outpost secured, mission complete (WebGL) |
| `scripts/debug-keystore.txt` | The app's signing key, so every new APK installs as an update |
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

Every time you upload a change, GitHub builds a new APK and updates the website. Each build has a higher
version number and the same signing key, so installing the new APK updates the app and keeps progress.
(If you installed a build from before the signing key was added, uninstall that one once first. Cloud save
brings your progress back after you start the new app.)

The signing key in `scripts/debug-keystore.txt` is a debug key, which is fine for sharing the APK directly.
To publish on the Google Play Store you would create a private release key and keep it in GitHub Secrets.

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

### v35: Great Dust Worm, 3-phase boss fight
- Much more HP (260 base) and armor: bullets do half damage unless you hit it in a **punish window** right after an attack (throat glows), or while it is **staggered**.
- Yellow **poise bar** under its health: fill it to stagger the worm for big damage.
- **Phase 2 at 66%** (Burrowing Frenzy): faster digging, **quake rings** (jump over them in 3D/HD) and **sand rivers**.
- **Phase 3 at 33%** (The Devourer): a huge circle hunts you before it erupts, it calls its brood, and attacks come much faster.
- Short immunity and a roar on each phase change; phase marks on the health bar.

### v36: every boss is a 3-phase fight
All bosses now use the same system as the Dust Worm: armor, punish windows (gold glow right after an attack), a yellow poise bar that staggers them, and phase changes at 66% and 33% with a roar, short immunity and new attacks.
| Boss | HP | Phase 2 | Phase 3 |
|---|---|---|---|
| Crystal Golem (Moon) | 150 | Crystal Fury: crystal prison ring + jumpable shockwave | Shattered Core: leaps onto you and bursts into shards |
| Solar Scorcher (Mercury) | 280 | Solar Flare: + then X sun beams | Supernova: triple dash chain or a huge explosion |
| Ice Kraken (Europa) | 320 | Maelstrom: 3 freezing ice waves (jump them) | Abyssal Wrath: tentacle spiral |
| Asteroid Colossus (Ceres) | 360 | Meteor Storm: 12 meteors | Event Horizon: black hole pull, then explosion |
| Hive Queen (Titan) | 420 | Royal Guard: Chargers + acid rain | Hive Frenzy: triple dash or egg-ring storm |

### v37: real 3D boss models in HD (animated like the Dust Worm)
Every boss now has its own animated model in HD view, each with a clip for every attack, smooth blending between clips, and attack impacts timed to land exactly when the red warning zone fires.
| Boss | Model (CC-BY-4.0, Sketchfab) | Animations |
|---|---|---|
| Crystal Golem (Moon) | Ricky the Golem by Agustin Ruella | idle, walk, roar, hurt, stagger, double-fist slam, ground smash, crystal blast, boulder throw, stomp, leap crash |
| Solar Scorcher (Mercury) | Red Cherub by Spinnee | dash wind-up + charge, sun-beam blast, flame-ring slam, fire summon, spin, supernova |
| Ice Kraken (Europa) | Octopus Blue Animal by 3dUVpro | tentacle smash, tentacle ring, freezing beam, ice spit, quake, swirl |
| Asteroid Colossus (Ceres) | Stonebound Colossus by antromar3 | rock throw, gravity pull, pound, stomp, meteor summon |
| Hive Queen (Titan) | Fireborne Blight Queen by HighPolyDensity | its own animations: fire spray, leap, lay egg, burrow, vomit, fire sweep |
| The Echo (final boss) and the Hive Mind (Echo world) | Xenomorph Queen Alien by M0RPH0 | tail slam, screech, eye beam / acid spit from the inner jaw, tail sweep, slam (giant, purple-tinted) |
The farm in HD is the Sci-Fi Plant Capsule by Berk Gedik.

Effects: crystal shards and a glowing core (Golem), burning claws, sun beam and supernova (Scorcher), frost mist and an ice beam (Kraken), a gravity vortex and meteors (Colossus), acid spray and a glowing stinger (Queen), fire breath, embers and a burning eye (Echo). Shockwaves, debris on gravity arcs, camera shake on every slam, a gold shield while immune, a glowing weak point after each attack and stars when staggered. The Echo now also has the stagger bar and weak-point windows.

Tools: `tools/bosses.py` + `tools/rigkit.py` rig the models (own skeletons for the static ones, existing skins mapped onto a simple skeleton for the rest), author the keyframe clips and export `js/boss_*.js`.

### v38: Cartoon HD (default) + Realistic HD
The view button and the title screen now have 4 views: **2D, 3D, HD ✨ (Cartoon), Real 🎬**.
- **HD ✨ Cartoon** (default for HD and for the Boss fight button): the chunky toy style of the 3D view (cartoon astronauts, boxy crystal bosses, toy rover, buildings) on top of everything HD adds: hills and craters, jumping and gliding with real gravity, free camera, clouds, outlines, glow and the boss aura/weak-point effects. The farm still uses the plant capsule.
- **Real 🎬**: the realistic models (NASA astronauts, Perseverance, Lunar Module, Robonaut, robot dog, and the animated Sketchfab bosses).

### v39: model fixes, harder bosses, smoother frames
- Hive Queen (Titan) now uses the Fireborne Blight Queen; the final boss (the Echo) uses the Xenomorph Queen, and the Echo world's own boss (the Hive Mind) uses it too, purple-tinted. Every planet's boss has a model in Real 🎬 view.
- Every boss now fires bullet patterns between its attacks: aimed fans, rings with a gap, sniper bursts, spirals and sweeping walls (more and faster in phase 2 and 3). JUMP over boss bullets in 3D/HD. Boss bullets don't hit buildings.
- Shorter cooldowns, combo follow-ups in phase 2 and 3, and boss attacks hit 25% harder.
- Smoother play: the 3D view lowers its render resolution automatically when frames get slow (and raises it again when there is headroom), skips the outline pass on very slow devices, and the three heaviest boss models were slimmed down.

### v40: polish update
- **💨 Dodge roll** (button next to FIRE, or Shift / K): a quick roll with a moment of invulnerability, 2 charges that refill. Works in 2D (afterimages), 3D and HD (the astronaut actually rolls).
- **✨ Perfect dodge**: dodge just as an attack lands to slow time, get the charge back, and force the boss's weak point open.
- **Combat feel**: damage numbers on bosses (gold ✦ when you hit the weak point or a staggered boss), a Souls-style trailing damage bar on the boss health bar, slow motion on the killing blow, and a red pulse when the crew is low on health.
- **Boss ranks**: every boss win is graded C to S on time, damage taken and perfect dodges. Your best rank shows in the Boss fight menu.
- **🎮 Controls screen** in the pause menu and the title screen; How to play now explains weak points, stagger, phases and dodging.
- **Cleaner boss HUD**: fact cards stay hidden during boss fights; Jump/Emote moved above the action buttons so they don't cover the build bar on phones.
- **Fixes**: the "Arriving at…" card could get stuck on screen when a new game started during the arrival fly-over (e.g. Boss fight); boss roars on phase change could be skipped at the very start of a game; the frame timer could go slightly negative after the arrival fly-over (caused rare drawing errors); particle/floating text caps keep long fights smooth.
- Tested: automated sweep of all 7 worlds in 2D, 3D, HD and Real views (no errors, under 1 ms of game logic per frame).

### v41: smooth boss fights, consistent graphics
- **Level of detail**: every sphere, cylinder and cone now picks its detail by how big it looks on screen (size ÷ distance to the camera). Big and close things stay smooth; small and far parts use simpler shapes; specks smaller than a pixel or two are skipped. A Cartoon HD boss fight went from ~295,000 to ~120,000–135,000 vertices per frame (Real view: ~374,000 → ~213,000).
- Outlines are only drawn around characters, buildings and bosses (not around sparks, bullets and particles).
- The dynamic vertex buffer is reused instead of being reallocated on the GPU every frame.
- In Real view your crewmates and hero use the lighter astronaut model; yours uses the full one in close cameras.
- **No more surprise downgrades**: the game no longer switches HD back to 3D or drops to the low-quality preset in the middle of play. The resolution helper only nudges between 80% and 100% in small steps.
- Real fact cards stay hidden during boss fights.

### v42: real VFX, ⚡ Burst, punchier guns, intense boss music
- **Sprite VFX engine** (3D/HD/Real): a procedural texture atlas (glow, flame, smoke, spark streaks, rings, flares, shock waves, scorch decals) drawn as camera-facing quads with additive light and soft smoke. Every boss attack erupts in its element when its warning zone fires (crystal, sand, fire, ice, gravity, void): fireballs, sparks on gravity, rising smoke, ground shock rings and scorch marks; beams leave glowing trails, cones spray flames, quake rings ripple. Danger zones glow with an element-colored rim that pulses faster as they charge. Boss bullets are glowing orbs, your shots are glowing tracers with muzzle flashes and impact sparks (gold flares on weak-point hits), and aliens explode when they die. Phase changes raise a pillar of light; boss deaths chain explosions.
- **⚡ BURST** (button above DODGE, or T): fills as you deal damage (and +15 on a perfect dodge). Slow motion, then an orbital strike: heavy damage, breaks the boss's poise and opens its weak point.
- **Guns** have a sub-bass thump and room tail; boss impacts, the phase stinger and the burst have their own heavy sounds.
- **Boss music**: taiko drums, galloping bass, string ostinato, brass stabs and a choir. Phase 1 → 2 → 3 speeds up (148 → 160 → 172 BPM) and adds layers (16th strings, extra toms, snare rolls, crashes every bar), with a stinger on each phase change.

### v43: squad, elements, lock-on, loadout, bloom
- **👥 Squad of 3** (portraits on the left, or Tab): ⚡ **Vega** (Vanguard, Electro: your rifles, EMP skill, Orbital Burst), 🔥 **Ember** (Engineer, Pyro: short-range flamethrower, Flame Nova skill, Meteor Rain burst), ❄️ **Frost** (Medic, Cryo: piercing cryo lance that slows, Frost Field heal skill, Healing Blizzard burst). Each has their own suit, weapon, skill (E) and burst energy (off-field members charge a little too). Swapping gives a short moment of invulnerability.
- **🔬 Elemental reactions (real science)**: Pyro + Cryo = **Steam Burst** (x2.2, ice expands ~1,700x as steam), Electro + Cryo = **Superconduct** (cracks boss armor for 7 s and breaks poise), Electro + Pyro = **Overload** (explosion that hits nearby enemies), Cryo + Cryo = **Freeze** (small aliens), Pyro on Titan can trigger a **Methane Flare**. Each reaction explains its science the first time. Enemies show a glowing element marker.
- **🎯 Lock-on** (button in the camera row, or L): the camera turns to keep the boss in front of you and your shots prefer the boss. A red reticle marks it.
- **Boss bar** moved to the top centre, Genshin style, with a slide-in.
- **🎒 Loadout** (title screen and pause menu): spend tech points from boss wins (S 40, A 30, B 20, C 12) on Arc Rifle / Hotter Flames / Sharper Lance damage, Elemental Mastery, Energy Recharge, Reinforced Suits and a third dodge charge.
- **Realistic astronaut**: aims the rifle with both hands while shooting (with recoil), leans into runs, flinches when hit.
- **Bloom**: effect light (fire, beams, sparks, bullets, bursts) glows through a blurred bloom pass; surfaces never bloom, so planets keep their colors. Soft blob shadows under everyone. Bloom turns itself off on devices slow enough to need the resolution helper.
- Fix: the EMP button passed the click event in as a player, so tapping it ignored the cooldown.

### v45 — Boss entrances & squad lobby
- **Elden Ring–style boss entrance:** every boss now gets a 6-second cinematic. The screen darkens, the camera starts low and wide while the boss rises out of the ground, then pushes in for a roar (white flash, shockwave rings, screen shake, stinger) before a gold serif name card fades in.
- **ENEMY FELLED:** beating a boss shows a gold "ENEMY FELLED" banner before the rank card.
- **Valorant-style co-op lobby:** the waiting room now shows tall character cards for both players with their astronaut, rank number, READY tag, name plate and rank title, plus empty "+" slots and a CLOSED PARTY label.
- **Pick your character in the lobby:** choose Vega, Ember or Frost; your partner sees the change live, and you start the mission as that character.

### v46 — Elden Ring difficulty
- **Bosses are much tougher:** 1.5× to 3.2× more health depending on the world, and more again in co-op. Maxed weapons no longer melt them: they still help (about 10% faster kills), but skill decides the fight.
- **Guard and openings:** hits outside an opening show **GUARDED** and do little. Strike right after a boss attacks (gold glow), while it's stunned, or when its stance breaks (**CRITICAL!** hits). Burst damage is capped outside openings, so constant spraying doesn't work.
- **Stance:** it takes much more pressure to stagger a boss now, and its stance recovers if you back off.
- **Every phase is an upgrade:** each new phase gets a cinematic (dark screen, camera push-in, roar, shockwave, gold serif title). The boss then hits harder (+10% / +30% / +55% damage), moves faster, grows bigger and stronger-stanced, and burns with an ember aura (gold in phase 2, blood-red in phase 3).
- **New boss moves:** a *delayed slam* in phase 2+ (long wind-up, then a quick follow-up where you dodged), a *3-hit tracking combo* followed by a shockwave ring in phase 3, and a one-time *last-stand blast* below 15% health.

### v47 — Real view graded like Elden Ring, plus 15 new boss moves
- **Real 🎬 view, Elden Ring look:** a film grade runs over the Real view. Colours are muted, shadows lean teal and highlights warm gold, golden haze sits on the horizon, and there's a heavy vignette, light lens fringing and film grain. It follows each world's own sky and haze colours.
- **Signature moves for every boss (3 each, unlocked by phase):** each one flashes its name above the boss when cast.
  - Crystal Golem: Crystal Lance (a line of spikes racing at you), Prism Cross (4 + 4 crossing beams), Shatter Rain (a spiral of falling shards)
  - Solar Scorcher: Flare Sweep (3 cones, left to right), Corona Rings (4 rings rolling outward), Sunfall (a huge slow sun plus 6 fragments)
  - Ice Kraken: Tentacle Sweep (one side, then the other), Frost Lattice (a chessboard that bursts in two waves), Abyssal Geysers (5 geysers that chase you)
  - Hive Queen: Stinger Volley (a fan of 5 stinger lines), Brood Ambush (flyers plus acid), Royal Pounce (leaps onto you, then a landing wave)
  - Asteroid Colossus: Orbital Lasers (3 lasers in sequence), Starfall Spiral (closing spiral of stars), Collapsing Star (only a small circle of light is safe)
- Bosses use their signature moves from phase 1, and more often each phase.

### v48 — Bug fixes
- **Ceres low gravity:** your squad hero, the crew, your co-op partner and the robot dog now bounce in low gravity just like you do. Before, only you bounced while everyone else walked normally.
- **Photo mode:** pressing Esc/P (or leaving through the pause menu) while in photo mode no longer leaves the HUD hidden, or the photo buttons stuck on the world map.
- **Boss bar:** moved low on the screen, Elden Ring style, in a gold serif font on one line. It no longer covers the tips and raid warnings at the top or wraps over the minimap.
- **Phone portrait:** the Shop, view and pause buttons no longer cover the wave and stats rows, and "Real fact" cards no longer cover the EMP/Burst/Dodge buttons.
- **Short phone screens (landscape):** the Vega/Ember/Frost portraits are smaller and sit higher, so they no longer overlap the build bar.
- **Smoother wave starts:** the checkpoint saved at each wave no longer forces a GPU stall (fog map readback).

### v49 — Clean phone HUD
On phones, the game screen has been tidied so you can see the action and know what to press.
- **One action arc around FIRE**, the way Genshin and other mobile action games do it. FIRE is the big button, with Dodge, Skill (EMP), Burst and Jump arranged around it within thumb reach.
  - The 🎯 Lock button only shows up during boss fights.
  - EARTH only shows (glowing) when your uplink is charged.
- **⋯ More menu (top right)** for things you rarely need mid-fight: Emote, Switch weapon, Inspect, Top/Free camera, Zoom, Turn left/right, View (2D/3D/HD/Real) and Earth help.
- **Top right is just three small icons:** 🛒 Shop, ⋯ More and ❚❚ Pause, plus the minimap. The camera row and view switch no longer sit on top of the game.
- **Compact status:** smaller resource chips, chat messages cut to 2 lines, smaller warning cards, and "Real fact" cards that sit at the top instead of the middle of the screen.
- **Build** is one button (bottom middle in landscape, bottom left in portrait), and the "drag to move" hint is gone.
- Works in both landscape and portrait. Tablets and computers keep the full layout.

### v50 — Squad progression and Adventure Mode
**Squad progression (Genshin style)**
- **Character levels:** Vega, Ember and Frost each level up separately (Lv 1–40). Defeating aliens gives XP to whoever is active (the others get a share), and waves and bosses give XP to everyone. Every level adds gun damage and toughness, shown as a "Lv" badge on each portrait.
- **Ascension:** levels stop at 20 and at 30. To raise the cap, ascend with boss materials plus tech points.
- **Boss materials:** each boss drops its own material (Moon Crystal Core, Dust Worm Fang, Solar Shard, Abyssal Ice Pearl, Royal Hive Jelly, Asteroid Heart, Echo Fragment): 3 for an S rank, 2 for an A, 1 otherwise.
- **Talents:** 3 per character, unlocking at Lv 10, 20 and 30.
  - Vega: Overcharge, Arc Crit, Storm Caller
  - Ember: Kindling, Heat Shield, Phoenix
  - Frost: Field Medic, Shatter, Absolute Zero
- **Daily commissions:** 3 new tasks every day (defeat aliens, trigger reactions, dodge, use Bursts, build, survive waves, beat a boss, swap). Each gives +15 🔧 and +120 XP, plus a +30 🔧 bonus for finishing all three.
- **Squad screen:** replaces Loadout (open it from the pause menu, the title's More menu or the phone ⋯ menu). It shows character art, level and XP, Ascend, talents, commissions and materials. The old gear upgrades are under "🔧 Gear upgrades".
- Bosses still scale, so higher levels help a little against them, but skill still decides the fight.

**🚀 Adventure Mode: The Grand Tour** (new button on the title screen)
- Fly a crew capsule (NASA's ESAS crew-module concept, the design that became Orion) across a 3D solar system: the Sun, 8 planets, the Moon, Ceres and the asteroid belt.
- **45 real NASA 3D models** from NASA 3D Resources, shrunk for phones (meshopt + WebP, about 23 MB in total) and loaded only when you fly near them. They include Perseverance, Ingenuity, Opportunity, InSight, Viking, the Apollo Lunar Module, the ISS, Hubble, JWST, the Space Shuttle, Saturn V, Juno, Cassini, Voyager 1, Parker Solar Probe, OSIRIS-REx and asteroid Bennu.
- Every spacecraft is placed where it belongs: in orbit, on a planet's surface, at L1/L2, or far out in deep space.
- **Scan** anything to read its NASA fact card: agency, launch year, where it is and 3 facts. Planets and the Sun have cards too, with 56 entries in total.
- **Codex** of everything you've scanned, a **Map with autopilot**, and **6 Grand Tour missions** (ISS & Hubble → Moon → Mars → Jupiter → Saturn → Voyager).
- **Rewards feed the main game:** +5 🔧 and squad XP per new scan, +20 🔧 per mission, and codex milestones (10/25/all) worth +30/+60/+150 🔧.
- **Controls:**
  - Phone: joystick, THRUST, BOOST and SCAN buttons.
  - Computer: W/Shift to fly, A/D and arrow keys or mouse drag to steer, E to scan, M for the map, C for the codex, Esc to exit.
- three.js (MIT) is bundled locally in `js/vendor/three`, so it also works offline in the APK.

### v51 — Adventure Mode: the whole NASA library, real planet maps, landing and diving
- **Every model from NASA 3D Resources** is now in Adventure Mode: 209 models, shrunk for phones (about 120 MB in total, each loaded only when you get close). Only the ones that couldn't be converted are missing: Base Station, Tall Dish, Terra, an oversized ISS variant and one oversized Cassiopeia A variant. Each model sits where it belongs:
  - Around Earth: Earth-science satellites, high and geostationary orbits, CubeSats and Robonaut near the ISS, Hubble's instruments
  - At L1 and L2: the Sun-watchers and the telescopes
  - Deep space and the outer planets, plus a **deep-sky gallery** of 3D supernova remnants and the young star BP Tauri
  - Kennedy Space Center: rockets, launch hardware, antennas, aircraft and the spacesuit hall
  - Mars and the Moon: rovers, landers and habitats
- **Real NASA planet maps** (from NASA 3D Resources textures) for Earth, Venus, Mars, Jupiter, Saturn, Neptune, Pluto and 19 moons, plus NASA's Tycho star map as the sky.
- **20 moons and Pluto added:** Phobos, Deimos, Io, Europa, Ganymede, Callisto, Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Pluto and Charon. Each has a fact card.
- **🛬 Land on any rocky world** (Earth, Moon, Mercury, Venus, Mars, Ceres, Pluto and every moon) and explore on foot as an astronaut (NASA's astronaut model).
  - Each world uses its real gravity, so you leap on the Moon and float on Enceladus. Hold JUMP to glide on your jetpack, and RUN to move fast.
  - The camera follows behind you, and you drag to look around.
  - Every world has its own sky and terrain:
    - Atmospheres: Mars's butterscotch dust, Venus's thick orange haze, Titan's methane fog with a methane sea, Earth's blue sky and ocean
    - Airless moons: black sky, stars, and the parent planet hanging overhead
    - Special features: craters, Io's lava, Europa's cracks, Enceladus and Triton geysers, Ceres's salt deposits
  - **Earth lands you at Kennedy Space Center:** walk among the VAB, crawler, mobile launcher, gantry, Saturn V, a rocket garden (Mercury Atlas, Redstone, Jupiter-C, Ares I), Deep Space Network dishes, NASA HQ and Mission Control, a spacesuit hall, and aircraft flying overhead.
  - **Mars lands you in Jezero Crater** with Perseverance, Ingenuity hovering nearby, plus Opportunity, InSight, Viking, the habitat, the Space Exploration Vehicle and RASSOR.
  - **The Moon lands you at Tranquility Base** with the Apollo Lunar Module.
  - **Collect on every world:** 6 🧪 science samples, each with a fact about that world (+2 🔧), and 12 ⭐ star fragments (+1 🔧). Finding everything on a world gives +15 🔧.
- **🌀 Dive into the gas giants** (Jupiter, Saturn, Uranus, Neptune): descend through the cloud layers with lightning, watch the depth and pressure rise, and grab 3 gas samples, each with a fact. Climb out before the pressure crushes your probe.
- **Every scan shows the real thing:** the fact card now has a **spinning 3D model** of what you scanned (or the planet itself). The codex is grouped by place, and each group shows how many you've found.
- **9 Grand Tour missions:** ISS and Hubble → Kennedy Space Center → lost spacewalk tools → Moon landing → Mars (Perseverance and Ingenuity) → Jupiter dive and Europa → Saturn, Cassini and Titan → Voyager 1 and 2 → Pluto's heart.

### v52 — Maximum detail, every NASA 3D model, and real NASA terrain
- **Full-detail models:** every NASA GLB model was re-processed with **no geometry simplification** and **2048 px textures** (meshopt + WebP, lossless-looking). That's about 240 MB in total, and each model loads only when you get near it.
- **Even more NASA models:** the three that failed before (Base Station, Tall Dish, Terra) were repaired. **37 models from NASA's "3D Printing" library** were converted too:
  - Spacecraft and rockets: Curiosity, New Horizons, Orion, SLS Block 1, SOFIA, DART, Landsat 9, Explorer 1, ISEE-3, a Europa orbiter concept, the NIAC Titan submarine, and a Perseverance wheel and sample tube
  - **9 real asteroid shapes:** Eros, Itokawa, Vesta, Toutatis, Geographos, Kleopatra, Mithra, Golevka and 1996 HW1
  - Deep-sky objects: the Crab Nebula, Pillars of Creation, Eta Carinae, DG Tau, SN 1006, SN 1987A, Tycho's supernova remnant and U Scorpii
  - 3D hurricane models (Katrina, Sandy, Julio) floating above Earth
  - NASA emblems (meatball insignia, Hubble 25 medallion, Viking 40 emblem) in the Kennedy spacesuit hall
- **Real NASA terrain landing sites:** 21 3D terrain models from NASA were turned into walkable ground.
  - **Mars:** Gale Crater with Curiosity, Pahrump Hills, Victoria Crater with Opportunity, Gusev Crater with Spirit, plus Jezero (Perseverance), Elysium (InSight) and Chryse (Viking).
  - **Moon:** all six Apollo landing sites, each with its own Lunar Module (Eagle, Intrepid, Antares, Falcon, Orion, Challenger), plus Mount Hadley and Hadley Rille, Copernicus, Tycho, Aristarchus, Gassendi and Linné.
  - **Vesta (new landable asteroid):** Rheasilvia, the Snowman craters and Numisia.
- **More realistic rendering:**
  - A studio reflection map so the metal and foil on NASA models shine like the real hardware
  - Bloom glow and a lens flare from the Sun
  - Glowing atmosphere rims on Earth, Venus, Mars, Titan, Pluto and the giant planets
  - Earth's cloud layer drifting slowly
  - Real sky colours with a sun halo on the ground (blue on Earth, butterscotch with a bluish sun glow on Mars, orange on Venus and Titan)
  - Soft shadows when you're on the ground
  - More detailed terrain
- **⚙ Graphics button:**
  - **Ultra:** full resolution, bloom and 2048 px shadows
  - **High:** for most phones
  - **Lite:** for older phones, with no bloom or shadows
- **2 new Grand Tour missions:** Gale Crater with Curiosity, and Apollo 15 plus Vesta.
- **Note on GitHub uploads:** the full-detail ISS "IGOAL" model is **43 MB**, which is over GitHub's 25 MB web-upload limit. Upload that one file with GitHub Desktop or git, or leave it out and the game shows a simple stand-in. Every other file is under 25 MB.

## v53 — Hangar, flyable aircraft, restored models and terrain

- **🛠 Hangar (Adventure Mode):** fly 9 real NASA spacecraft as your ship: ESAS Crew Module, Orion (Artemis), Gemini, Apollo–Soyuz, Agena, Apollo Lunar Module, Space Shuttle orbiter, Shuttle launch stack and SLS Block 1. Each ship has its own speed, boost and turning. You unlock a ship by scanning it in the world (the Shuttle stack and SLS also unlock at 15 and 25 scans). Your chosen ship also waits on the landing pad and dives into gas giants with you. Key: **H**.
- **✈ Aircraft flight:** after landing on Earth, tap ✈ FLY to fly the X-57 Maxwell, Global Hawk or a Space Shuttle glide over Kennedy Space Center. You can scan and collect finds from the air. On Mars, fly the Ingenuity helicopter with spinning rotors (hold CLIMB to rise, let go to land). Key: **F**.
- **Restored models:** ACRIMSAT (A, B) and ICESat-2 (A, B, C) now each have their own file. Eclipse 2017 (the printed USA map plus all 53 state and territory tiles) and LISA (16 parts in an exploded view) are new displays at Kennedy Space Center.
- **Restored terrain:** rebuilt from NASA's 3D-print terrain by sampling the real surface. New Mars landing sites: Valles Marineris, the Valles Marineris canyon floor, the Tharsis volcanoes, and Meridiani Planum (Opportunity).
- **Fixes:** the 3D model on fact cards now sits inside the card. The space scene pauses while a menu is open, which saves battery. Untextured NASA models no longer render black.

## v54 — Max graphics Adventure: real models everywhere, VFX, smoother flight

- **No more boxes:** the stand-in boxes are gone. If a model is still loading you see only its glowing marker. The online preview now loads the real NASA models too, using a second copy of each model as an embedded glTF `.json` file, because the preview host can't serve `.glb`. GitHub Pages and the Android app still use the `.glb` files.
- **Max graphics only:** Lite mode is removed. The choices are **Ultra** (4× anti-aliasing, 2× resolution, 4096 px shadows, the most rocks and grass) and **High**. Both keep every effect.
- **Cinematic look:** HDR rendering with anti-aliasing, then bloom, ACES tone mapping and a film grade with vignette, soft lens fringing, grain, and a contrast and colour lift.
- **VFX:**
  - Space: engine exhaust that changes with thrust and boost, warp streaks at high speed, a field-of-view kick when you speed up, and scan sparks with a shockwave ring.
  - On the ground: footstep dust, jetpack thrusters, landing dust rings, floating dust in the air, and a burst with a ring when you collect a find.
  - Aircraft: contrails, wingtip vortices and ground spray. Ingenuity: rotor wash that kicks up dust.
- **More realistic worlds:** about 1,500 lumpy, shadow-casting rocks on every rocky world, and up to 30,000 blades of grass waving in the wind at Kennedy Space Center. The ground mesh has 40% more detail.
- **Smoother controls:** steering input is smoothed, so the ship banks and turns more gently.
- Graphics key: tap ⚙ to switch between Ultra and High.

## v55 — Adventure stability fix

- **Fixed: the astronaut, aircraft and landing-pad ships not showing correctly.** A v53 code mix-up meant the astronaut never loaded (a white capsule stood in its place), and aircraft and your ship on the landing pad loaded without their correct rotation, so they looked sideways or glitchy.
- **Smooth model streaming:**
  - NASA models now load nearest first, three at a time, instead of all at once. Loading everything at once froze the game for a moment.
  - Models far behind you are unloaded so memory stays steady.
  - A small "⏳ Loading NASA 3D models 12 / 38" badge shows progress, so a model that is still loading doesn't look missing.
- **No more memory crashes:** raw model files are no longer kept in memory twice. If the phone's graphics memory still runs out, the game recovers by itself instead of losing all its models.
- **Dynamic resolution:** if the frame rate drops, the game lowers the resolution a little, never the effects, and raises it again when it can.
- Failed model downloads are retried automatically.

## v56 — Adventure performance: level of detail, no flicker, instant reloads

- **Fixed: a flickering black square in space.** It came from the Sun's lens flare: three.js's Lensflare copies a square of the screen each frame, and that breaks with the anti-aliased renderer added in v54. It's replaced with a flare built from sprites that never reads the screen, and the flare hides when a planet is in front of the Sun.
- **Level of detail (LOD):** every NASA model now also has a light version in `www/models/nasa/lod/` (about 5% of the triangles, 256 px textures).
  - All light versions within range stream in within seconds, so every spaceship appears almost right away.
  - The full-detail model swaps in when you fly close, and unloads when you fly away while the light version stays.
- **Faster streaming:** 4–6 parallel loads depending on the device's CPU, nearest first, with one full-detail model and one light model started each frame.
- **Instant reloads:** the service worker keeps NASA models and textures in their own cache (`rdo-models-1`) that survives game updates. After the first load they come from the device, even offline.
- **Model loading never gets stuck:** each model tries `.glb` first, then falls back to `.json`, then retries.
- **The loading badge is accurate:** it counts every object in range, so it only says done when everything nearby has appeared.
- **Upload note:** `www/models/nasa/lod/` adds 258 small files. Use GitHub Desktop, because the website stops at 100 files per upload.

## v57 — Download resources screen and a black-flicker fix

- **⬇ Download resources:** opening Adventure Mode on the web now first shows a launcher-style screen, like Genshin's:
  - **Full pack:** every NASA model in full detail, about 298 MB.
  - **Light pack:** light versions of every model plus the ships and aircraft, about 60 MB.
  - **Skip:** stream models while you play.
  - Downloads run 6 at a time, with a progress bar, speed and time left. Files go into the device's model cache, so Adventure Mode then loads from the device, even offline. Files you already have are skipped, so a download can resume. Use the **⬇** button in Adventure Mode to download more later.
  - The Android app skips this screen, because every model is already inside it.
- **Black flicker fix:**
  - Dynamic resolution now changes rarely. It used to adjust every 1.5 s when the frame rate hovered near its thresholds, and each change cleared the screen for one frame. Now it only steps down after about 6 s of sustained slowness, waits at least 12 s between changes, and makes at most 6 changes per session.
  - The HDR/anti-aliased render buffers are only used when the phone's GPU supports rendering to them. Otherwise the game uses standard buffers, which avoids black frames on some Android GPUs.
- `www/models/manifest.json` lists every resource for the downloader.

## v58 — Flicker fix, smoother play, space-sim cinematics

- **Black-flicker fix (main cause):** a guard pass now runs right after the 3D scene renders. It removes invalid pixels (Inf from an over-bright highlight, NaN from a broken normal) before bloom. Bloom used to smear a single bad pixel into black flashes across the screen.
- **Smoother on phones:**
  - Phones render at most 1.6× resolution on Ultra and 1.3× on High. Desktops stay at 2× and 1.5×.
  - Distant spacecraft stop drawing once they'd be only a few pixels wide.
  - Labels move with GPU transforms and only rewrite their text when it changes, so the page no longer re-lays itself out every frame.
  - Shadows are 2048 px on phones, and grass and rocks are lighter.
- **🔥 Atmospheric entry:** landing now plays a 3-second entry. The ship dives toward the planet with plasma streaming off its heat shield, camera shake and an orange heat glow, then a white flash into the landing site. Airless worlds get a retro-rocket descent instead.
- **🚀 Lift-off:** launching from a planet shows your ship lighting its engines on the pad. Smoke billows out, a shockwave ring spreads, and the camera watches the climb from the ground.
- **🎥 Cockpit view (V):** switches between the chase camera and a first-person cockpit with a reticle and a vignette.
- **Flight HUD:**
  - A target bracket locks onto the nearest object and shows its name (or UNKNOWN SIGNAL), distance and closing speed.
  - A green ◎ prograde marker shows where the ship is actually drifting.
- **📷 Photo mode (P):** hides the UI, adds cinematic letterbox bars, and slowly orbits the camera around your ship for screenshots.

## v59 — Genshin-style performance: memory budget, graphics settings, lighter textures

- **Measured first:** all 258 NASA models together come to 31.6 million triangles and about 2.1 GB of texture memory, far more than a phone has. That, not draw calls, was the main cause of lag (the models were already merged into few parts).
- **Memory budget, like Genshin:** each graphics preset sets how many full-detail triangles and how many MB of model textures may be loaded at once. The nearest models get full detail, and everything beyond the budget shows its light version. A model that was swapped out only reloads once you're clearly closer, so nothing flickers between detail levels. The nearest model always stays full detail.
- **Lighter textures:** every model texture is now at most 1024 px. The ISS IGOAL and Gateway models, which have more than 100 and 37 textures, go down to 512 px. The ISS IGOAL model alone drops from 577 MB to 146 MB of texture memory.
- **⚙ Graphics settings panel:**
  - Quality preset: Low, Medium, High or Max. Phones default to Medium and computers to High.
  - Frame-rate cap: 30, 45 or 60 FPS.
  - Render-resolution slider: 50–100%.
  - On-screen counter showing FPS, loaded triangles, texture MB, draw calls and resolution.
  - The presets also set anti-aliasing, shadow size, grass and rock density, ground detail, glow and particle amounts.
- **The model cache is renamed to `rdo-models-2`,** so devices download the new lighter models instead of keeping the old ones.

## v60 — Realism pass 1: real sunlight, atmospheres, cockpit, sound

- **Real sunlight on every planet and moon** (`js/adv_planet.js`):
  - Shaders light each pixel from the Sun, with a soft day/night line and a truly dark night side. Ambient light was cut from 0.75 to 0.22, so the dark sides are actually dark.
  - Light turns red-orange near the day/night line, because sunrise and sunset light crosses more air.
  - Earth's oceans glint where the Sun reflects off them.
  - A sky-coloured glow shows at the day-side edge of each planet, with orange along the day/night line.
- **Atmosphere shells** now glow on the lit side, turn orange at sunset, blaze when you look toward the Sun through them, and fade out at night.
- **Clouds** are lit by the Sun and turn pink-orange at dusk. They use new swirling, latitude-banded patterns, like the real tropics and storm belts, instead of streaks.
- **Saturn's rings** are lit from the Sun, and the planet casts its shadow across them.
- **Real Space Shuttle cockpit:** the cockpit view (V) is now framed by NASA's own photos of Space Shuttle Discovery's flight-deck panels (NASA 3D Resources, Images and Textures). It has three green flight screens showing speed, throttle, ship, nearest body, altitude, landing readiness, target, scan count and mission.
- **Sound design** (`js/adv_audio.js`, Web Audio, no graphics cost):
  - an engine roar and low throb that follow the throttle and boost
  - wind and plasma roar during atmospheric entry and when flying aircraft
  - a quiet ambient space drone with reverb
  - soft cockpit beeps in cockpit view

## v61 — Realism pass 2: opening cinematic, real-world scale, demo tour

- **🎬 Opening cinematic:** Adventure Mode opens with a 10-second flyby. The camera glides past Earth's day/night line in cinematic letterbox while "MOON PRODUCTIONS PRESENTS · RED DUST OUTPOST · ADVENTURE · THE GRAND TOUR" fades in, then it settles in behind your ship. Tap to skip.
- **📏 Real-world scale:**
  - The speed bar shows your true altitude in km above the nearest planet or moon, using its real radius.
  - Planet and moon cards show the real diameter, the distance from the Sun in AU and km, and how many minutes sunlight takes to arrive.
  - Real radii are included for 33 bodies.
- **🎬 Demo tour button:** flies itself through a showcase for judges:
  1. autopilot to the ISS and scan it
  2. autopilot to Hubble and scan it
  3. cockpit view
  4. autopilot to Mars, atmospheric entry, and landing on real NASA terrain at Gale Crater
  5. lift-off
  6. photo-mode orbit of your ship

  Touching the joystick or pressing any key hands control back.
- **Cleaner sky:** the "unknown signal" markers are smaller, shrink with distance, and hide once a model is shown, so space looks less cluttered.

## v62 — Realism pass 3: mission control, asteroid belt, star field

- **🎙 Mission-control voice callouts** use the device's speech voice behind a radio chirp. You hear:
  - "Arriving at …"
  - "New object identified …"
  - "Entry interface. Heat shield is taking the load." and "Peak heating."
  - "Touchdown. Welcome to Gale Crater."
  - "Main engine start. And lift-off!" and "Orbit achieved."
  - "Demo tour starting."

  Turn it on or off in ⚙ Settings, under Mission Control Voice.
- **☄️ Real-looking asteroid belt:** up to 2,100 lumpy, irregular asteroids in three rock shapes, with mixed sizes (some large ones), stony brown-grey colours and a ragged thickness. The count scales with the graphics preset.
- **✨ Star field:** a new star shader keeps the black between stars truly dark and pushes the brightest stars past white, so they glow and twinkle through the bloom like a real night sky.

## v63 — Realism pass 4: a living Sun, flowing gas giants, engine light

- **☀️ The Sun is now a live star:**
  - its surface boils with three layers of granulation
  - dark sunspot groups drift slowly across it
  - the edge is darker and more orange (limb darkening), like real photos
  - a flickering corona shell surrounds it
- **🪐 Gas giants move:** Jupiter, Saturn, Uranus and Neptune have cloud bands that flow east and west in alternating jet streams. A seamless flow-map method keeps the bands moving forever without smearing.
- **💡 Engine light:** your engine now casts real blue light (orange on boost) onto your ship and nearby spacecraft.
- **Night lights:** NASA's Earth at Night / Black Marble 2016 map is the right source for city lights, and the game already supports it. The session can't download it, so it's waiting for the file.

## v64 — Realism pass 5: real night lights, living skies, ocean, dust devils (and the black-square fix)

- **🌃 Real city lights:** Earth's night side now glows with NASA's **Black Marble 2016** night-lights map (`www/models/tex/earth_night.webp`, made from NASA Earth Observatory's 8000×4000 image). The city lights were separated from the blue land base so only real lights glow, warm sodium-orange, and they fade in exactly where the Sun sets.
- **🌅 Day/night cycle on planets with air** (Earth, Mars, Venus, Titan, Pluto): one day passes every 4 minutes. The sun moves across the sky, and the light, sky, fog, shadows and stars all follow it.
  - The sky blends from day to night and glows in sunset colours toward the Sun near the horizon. **Mars sunsets are blue**, as NASA's rovers photographed them, and Earth's are orange.
  - At night the stars come out, and moonlight and starlight replace the Sun.
- **🌊 Ocean at Kennedy Space Center:** four layers of moving waves reflect the sky (stronger at grazing angles, like real water), with sun glitter on the waves, fading into the haze at the horizon.
- **🌪 Dust devils on Mars:** three swirling dust columns wander across the plains.
- **🐛 Fix for the black square:** the flight-HUD target bracket was picking up a style from the main game that gave it a dark filled background. It showed up as a black square that flickered as targets changed. The HUD classes are renamed, so the bracket is only corner marks now. The HUD is also hidden on planet surfaces.

## v65 — Astronaut fix + realism passes 6 and 7: ground detail and footprints

- **🐛 Astronaut half in the ground (fixed):** the walking bounce reset the model's height every frame and cancelled the offset that keeps its feet on the ground. The model is now wrapped in its own group, so the bounce moves the wrapper instead. The stand-in capsule had the same fix.
- **Realism pass 6: the ground.**
  - Steep slopes turn rocky and darker.
  - A seamless regolith normal map adds bumps under the sunlight: periodic ripples, about 420 stamped pebbles and fine grit.
  - The large-scale brightness varies, so the ground never looks tiled.
  - A ring of ground beyond the edge means the world never just ends; the haze hides the seam.
  - Earth, Titan and Venus have a drifting cloud layer overhead that follows the day/night colours.
- **Realism pass 7: astronauts.**
  - **Bootprints:** each step leaves a print made from NASA's real Apollo 11 bootprint photo (AS11-40-5878, from NASA 3D Resources). Prints alternate left and right, follow your heading, and the last 220 stay on the ground. They appear on every world except grassy Earth.
  - **Low-gravity walk:** a slower, bouncier gait on the Moon and Mars, scaled by each world's real gravity.
  - **Helmet lamp:** a spotlight on the helmet turns on by itself as night falls.

## v66 — Realism pass 8: eclipses, navigation lights, sunrise ring

- **🌑 Real eclipse shadows:** every moon now sits in its planet's shadow when it passes behind it. Each planet can also be crossed by the shadow of its biggest nearby moon, like Io's shadow on Jupiter or a solar eclipse on Earth. The shadow is worked out per pixel with a soft penumbra edge.
- **🚨 Navigation lights:** spacecraft carry a red light on the left (port), a green light on the right (starboard) and a white strobe that double-flashes, like real spacecraft and aircraft. Planets, asteroids, storms and deep-sky objects don't get them.
- **🌅 Sunrise ring:** from Earth's night side with the Sun behind it, sunlight shining through the atmosphere lights up a bright, warm ring around the whole planet, like astronaut photos of orbital sunrise.

## v67 — Demo tour hardening

- If Gale Crater's terrain can't load, the Demo tour now falls back to the first Mars landing site.
- It moves into landing range if the autopilot stopped slightly short.
- It picks a landing site automatically if the site menu still opens.
- Before each showcase stop it closes any card left open, and it skips a stop whose spacecraft is missing instead of waiting.

## v68 — Opening cinematic: sunrise over Earth

- The opening shot now starts on Earth's night side. The city lights glow, the atmosphere blazes into a sunrise ring, and the Sun peeks over the edge as the title fades in. Then the camera sweeps round the day/night line to the day side and settles in behind your ship. It lasts 11 seconds; tap to skip.
- I checked all four graphics presets (Low, Medium, High and Max) by switching between them live with no errors. Anti-aliasing per preset: none, 2×, 2× and 4×.

## v69 — The feeling of space, and a Story Mode bridge

- **🌌 Milky Way and nebulae:** the sky shader adds a soft, warm Milky Way band with dark dust lanes and a brighter galactic core, plus faint purple, teal and amber nebula clouds, all on top of NASA's star map. It's lighter on the Low preset.
- **✨ Space dust:** hundreds of faint motes drift past the camera, wrapping around you, so you feel your speed and the depth of space even far from planets.
- **🔆 Anamorphic sun streak:** a long horizontal blue-white streak through the Sun, like a cinema lens.
- **🟣 The Purple Signal (Story Mode bridge):** once you've found at least one mystery clue in the campaign, Adventure Mode picks up a strange purple signal in the asteroid belt. This is where all six outposts beamed their message in the story.
  - It's a pulsing crystal cluster with a purple glow, light and drifting sparks.
  - Flying close triggers a screen glitch, a radio whisper ("six doors") and mission control saying it isn't on any NASA chart.
  - Scanning it opens a story card that counts your clues. With all six, it reveals that a seventh door waits in the belt.
  - The first scan gives +15 🔧 and +150 XP. It's listed on the 🗺 Map under STORY and doesn't count toward the NASA codex.

## v70 — Story Mode: voiced radio messages

- In the main game, Mission Control and crew messages are now read aloud over the radio, with a radio chirp before each one. Mission Control has a low voice, and your crew has a brighter one. This covers story beats, mysterious transmissions, tips and crew chatter.
- It respects the 🎬 Cutscenes and sound settings. Emojis and formatting are stripped before speaking, and a new message cuts off the previous one so voices never pile up.
- I ran the headless regression sweep on worlds 1 and 3 with no errors.

## v71 — True ending, trophies, NASA daily missions, Adventure co-op, controllers, realism passes 9 and 10

- **🚪 The true ending: the seventh door.** Once you've finished the campaign (all six worlds secured, the secret world won, or all six clues found), scanning the Purple Signal in Adventure Mode offers **🚪 Open the seventh door**.
  - **The cinematic:** a 3D sequence where the crystal shatters and a great ring with six crystal shards grows out of the signal. Its purple membrane swirls open, your ship flies through, and the screen flashes white.
  - **What follows:** five voiced story cards reveal what the doors were, who the bosses really were (the text changes if you spared them), and what the Echo wanted. Then come the Moon Productions credits.
  - **Afterwards:** the door stays open in the asteroid belt as a landmark. Opening it unlocks the *Seventh door* trophy.
- **🏆 Trophies across both modes.** There are 20 new Adventure trophies, including first scan, 25 and 100 scans, full codex, landing, landing on 5 worlds, gas-giant dive, flying an aircraft, Ingenuity, a new ship and getting close to the Sun. Others cover 100 bootprints on the Moon, a blue Mars sunset, cockpit view, photo mode, the demo tour, a daily mission, co-op, the Purple Signal and the seventh door.
  - The new 🏆 button opens a trophy room showing Story Mode and Adventure Mode badges with a progress bar.
  - Unlocking one in Adventure shows a gold animated banner and is spoken aloud. The Story Mode badge screen is now grouped by mode.
- **🛰 Today's NASA mission.** There's a new mission every day, shown under the campaign mission. Tap it for details and autopilot.
  - **Live data:** it uses real NASA data first. A real M or X class solar flare this week (from the DONKI feed the game already reads) gives a *Solar flare alert* mission. A geomagnetic storm at Kp 5 or higher gives a crew check.
  - **Picture of the Day:** if today's NASA Astronomy Picture of the Day is about a planet or moon, the mission sends you there. The card shows the picture and links to it.
  - **Other days:** it picks from ten themed missions, such as Great Observatories, Rover check-in, Juno at Jupiter, Planet hunters and Ocean worlds.
  - **Rewards:** +25 🔧, +300 XP and a daily streak. If NASA can't be reached, the missions still work from the built-in list.
- **👥 Co-op in Adventure Mode.** The new 👥 button lets one player make a room and the other type its 4-letter code. It uses the same Supabase Realtime system as Story Mode co-op.
  - You see your friend's real ship (the one they picked in the Hangar), smoothly interpolated, with a green name marker and distance. The marker sticks to the screen edge when they're off-screen.
  - You get toasts when they land, and a **Fly to friend** button. Flying near each other for 10 seconds unlocks *Wingmate*.
- **🎮 Controller support.** Xbox, PlayStation and other standard controllers work everywhere.
  - **Menus:** the D-pad or stick moves a gold focus ring, A selects and B goes back.
  - **Story Mode:**

    | Control | Action |
    |---|---|
    | Stick | Move |
    | A or RT | Fire |
    | X | Dodge |
    | B | EMP |
    | Y | Build |
    | LB | Swap weapon |
    | RB | Call Earth |
    | Back | Shop |
    | Start | Pause |
    | Right stick | Look in 3D |

  - **Adventure, in space:**

    | Control | Action |
    | --- | --- |
    | Left stick | Steer |
    | Right stick | Look |
    | RT | Thrust |
    | LT | Boost |
    | A | Scan |
    | X | Land |
    | Y | Map |
    | LB | Camera |
    | B | Codex |
    | Back | Hangar |
    | Start | Settings |
    | R3 | Photo mode |
    | L3 | Demo |

  - **Adventure, on the surface:**

    | Control | Action |
    | --- | --- |
    | Left stick | Walk |
    | Right stick | Look |
    | A | Jump |
    | RT | Run |
    | X | Scan |
    | Y | Fly |
    | Back | Launch |

- **Realism pass 9 (space):**
  - **Saturn's rings cast their shadow on the planet.** The shader follows each pixel's ray toward the Sun to the ring plane and darkens it by the ring's real opacity there, so the Cassini Division shows up as a light gap in the shadow.
  - **Eye adaptation:** exposure dims when the Sun fills the view and opens up when you're in a planet's shadow, so the stars and the Milky Way come out on the night side. It costs one ray test per body per frame.
- **Realism pass 10 (surfaces):**
  - **Sun haze (forward scattering):** distant terrain on worlds with air glows toward the Sun, warm and orange at low sun. It's strongest in Mars dust, gentler on Earth, Titan and Venus. Airless worlds stay crisp, the way they really look.
  - **Ballistic regolith:** on airless worlds (the Moon, Vesta, Ceres, Europa, Pluto…), footsteps and landings kick up dust grains that fly in clean parabolas under the world's gravity and drop straight back down, like in the Apollo footage. Worlds with air still get billowing dust.

## v72 — Sun fix, realism passes 11 (space) and 12 (on every world)

- **🐛 Fixed: the ship got stuck at the Sun.** Flying into the Sun (or autopilot routing through it) used to pin the ship to its heat limit.
  - Now the ship slides off. A heat-shield warning auto-turns you away and pushes you clear.
  - Autopilot steers around the Sun and planets, and turns before it accelerates.
- **Realism pass 11 (space):**
  - **Solar prominences:** arches of flowing plasma rise off the Sun's limb.
  - **Sun approach:** the screen edges glow with heat and the hull shakes, with a Parker Solar Probe heat-shield note.
  - **A real comet** on a long elliptical orbit, with true Kepler motion (it speeds up near the Sun). As it nears the Sun it grows a glowing coma, a straight blue ion tail pointing exactly away from the Sun, and a curved dust tail lagging behind its path.
  - **Auroras** circle the poles of Earth (green and red) and of Jupiter and Saturn (violet), brightest on the night side.
  - **Inside Saturn's rings:** fly into the ring plane and thousands of tumbling ice chunks surround you, only where the ring is dense. The Cassini Division stays empty. It's one instanced draw call.
  - **Correct axial tilts:** planets now spin around their tilted axes instead of wobbling. Earth is 23°, Mars 25° and Saturn 27°, and Saturn's rings now lie exactly in its equator.
- **Realism pass 12 (on every world):**
  - **The Sun's real size from each world:** two-thirds size from Mars, small from Jupiter's moons, and a tiny piercing point from Pluto.
  - **The planet in your sky** (Earth from the Moon, Jupiter from Europa, Saturn from Enceladus…) now shows a real phase with a black night side, an atmosphere rim and, for Earth, city lights on its night side.
  - **Cloud shadows** drift across the ground on Earth, Titan and Venus, following the real moving clouds.
  - **Opposition surge:** on airless worlds the ground brightens when the Sun is right behind you, as on the real Moon.
  - **Ice glints:** icy moons (Europa, Enceladus, Triton, Pluto…) sparkle with crystal facets that catch the Sun.

## v73 — A walking astronaut, a living solar system, rovers, helmet view and weather on every world

- **🐛 Fixed: the T-posing astronaut.** The old NASA astronaut was a single frozen mesh with its arms out. It's replaced by a fully jointed astronaut (hips, knees, ankles, spine, neck, shoulders, elbows, wrists) in a white suit, with a gold sun visor, a life-support backpack and a chest control unit. A gait engine moves it like a real person:
  - **Walking:** heel-to-toe steps with knee bend, arm swing opposite the legs, hip sway and a little forward lean.
  - **Running:** a longer stride and stronger lean.
  - **Moving around:** it leans into turns and breathes when standing still, looking around a little.
  - **Jumps and landings:** it tucks its legs and balances with its arms when jumping, and crouches when it lands.
  - **Low gravity:** it blends into the Apollo "bunny hop" lope, with both feet nearly together, long floating bounds and the suit's arms held out.
- **🐛 Fixed: Io and Europa offered "Dive into Jupiter"** when you were right next to the moon. Moons now win when you're close.
- **Realism pass 13 (space):**
  - **A moving solar system:** planets follow Kepler's third law (an Earth year is 25 minutes, Mercury's is about 8), and moons visibly circle their planets (Io every 45 seconds, Europa 90, Ganymede 3 minutes, our Moon 4). Positions come from the real clock, so co-op friends see the same sky. Your ship rides along with whatever world it's near, like a real orbit. A Settings switch can freeze them.
  - **The ISS** laps Earth about every half minute.
  - **Jupiter up close:** a slowly swirling Great Red Spot with spiral cloud arms and a pale collar, lightning flashing in the clouds on the night side, and Io's volcanic plumes (sulfur umbrellas in clean arcs, with glowing lava at the vents) seen from orbit.
  - **Light from nearby worlds:** sunlight now follows your ship and is blocked when a planet eclipses you. Your ship casts real shadows on nearby spacecraft, Saturn's ring ice, moons, planets and the ring plane. The colour reflected off the nearest world lights your hull: orange near Mars, blue near Earth, cream near Jupiter.
  - **Newtonian flight** (Settings or the N key): no fake drag. You keep drifting until you fire retro jets (S), with a speed cap of 700.
  - **RCS jets:** small cold-gas puffs fire at the nose whenever the ship turns or brakes, in both flight modes.
  - **Real constellations** (the ✨ button or K): all 88 IAU constellation figures and names, plus the 45 brightest named stars. They're drawn on the same sphere as NASA's Tycho star map, so the lines sit exactly on the real stars. Star data is from the open-source d3-celestial project (BSD licence).
- **Realism pass 14 (on the worlds):**
  - **Real day lengths** on every world (game time runs 360× faster): Earth 4 minutes, Mars 4 min 6 s (24 h 40 m), the Moon about 2 hours, so its Sun barely moves, and Vesta under a minute, so its Sun races across the sky. Airless worlds now have a moving Sun too.
  - **Earthshine:** at lunar night the ground is softly lit blue-white by Earth overhead. Jupiter, Saturn and the other sky planets do the same for their moons.
  - **Weather:**
    - **Mars:** dust storms roll in now and then. The air thickens, the Sun dims and dust streaks past. A thin, patchy frost forms at night and burns off after dawn, as Viking 2 photographed.
    - **Titan:** a methane drizzle of big, slow drops (about 1.6 m/s) and dark, mirror-smooth methane lakes.
    - **Io:** lava glows and flickers through cracks in the crust, and a Pele-class volcanic plume rises 300 km on the horizon.
  - **🪖 Helmet view** (the 🪖 button, the V key or LB): first person through the visor. The curved faceplate bends the edges of the view, adds slight colour fringing at the rim, faint reflections, a gold visor edge, specks of dust and, on very cold worlds, condensation at the bottom.
  - **Suit readout** on every world:
    - **Time:** local time with a Sol or Day count and the real day length.
    - **Oxygen:** it drains as you explore and refills at your lander or rover.
    - **Suit:** suit pressure (29.6 kPa, like the real NASA suit) and heart rate, which rises when you run.
    - **Outside temperature:** it follows day and night (the Moon swings from −173 to 127 °C).
    - **Radiation:** real dose rates. Earth is 0.1 µSv/h, the Moon 57, Mars 28, Europa 225 mSv/h and Io 1,500 mSv/h (flagged LETHAL).
  - **🚙 Drivable rovers** (the button on the Moon and Mars, the G key or B):
    - **Moon:** the Apollo **Lunar Roving Vehicle**, with wire-mesh tyres, an umbrella antenna, a gold-foil pallet and your astronaut seated at the T-handle. On Mars, a **Perseverance-style rover** with six wheels on a rocker-bogie suspension, a Mastcam-Z mast and a finned RTG power source.
    - **Handling:** each wheel follows the ground on its own suspension, and the chassis pitches and rolls. In low gravity it's thrown into the air over bumps and floats down. The front wheels steer.
    - **Tracks and dust:** the tyres leave tracks. On the Moon the wheels throw "rooster tails" of dust in perfect arcs, as in the Apollo 16 film.
    - **Parking:** park it and it stays where you left it. There's a new *Moon buggy* trophy.
