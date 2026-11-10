# Red Dust Outpost · Technical audit (v85)

I audited the code itself, not the promotional text. Every feature listed as working was checked in the source, and most were also run in a headless browser.

## Architecture

| Part | What it is |
|---|---|
| `www/index.html` (573 KB) | Story mode. Game state `S`, the simulation (`update`), the HUD, menus, saves (`LS` = localStorage wrapper), events, research, shop, tutorial, i18n hooks, audio (Web Audio mixer and an adaptive music sequencer). |
| `www/js/render3d.js` | Story mode's own WebGL1 renderer, used by the 3D, HD and Real views. It has batched geometry, a cache for building geometry, a terrain heightmap, RGBA-packed sun shadows, a sky shader, a VFX atlas, bloom and colour grading. The 2D view is the canvas in `index.html`. |
| `www/js/story_real.js` | Realism hooks: solar curve, temperatures, dust, light delay, dose, quakes, footprints, air-shaped sound. It wraps `update`, `hudUp` and `showDone`. |
| `www/js/adventure.js` + `adv_*.js` | Adventure mode, built on three.js r169 as ES modules. Covers the squeezed solar system, landing, the astronaut, rovers, launch, codex, missions, hangar and photo mode. |
| `www/js/models.js`, `boss_*.js`, `worm.js` | Baked model data, lazy-loaded through `RDO_LAZY`. |
| `www/js/net.js`, `coop.js` | Supabase: accounts, guest access, cloud save, leaderboards, daily challenge, co-op. |
| `www/sw.js` | Offline cache. Network first for code, cache first for NASA models. |
| `.github/workflows/build.yml` | Builds Pages and the Android APK from `main` only. |

## Advertised vs real

These were all verified in the code:

- six worlds with bosses
- five waves per world
- all 14 building types
- six alien types
- Earth help with light delay
- research
- crew jobs
- decision events
- emergencies
- the 2D, 3D, HD and Real views
- 12 languages
- accessibility options
- the Adventure codex (290 entries) and its 11 missions
- SLS launch, entry and parachutes, hangar, photo mode, co-op, daily challenge and trophies

Two things are built but unreleased: the judge's tour and the high-contrast / one-handed modes. They're on the dev branch, and the guide says so.

## Bugs found

1. **The Story mode scenery was never drawn (fixed in v85).** Two functions in `render3d.js` were both called `buildStatic`. The second, the building-geometry cache, silently replaced the first, the scenery builder.
   - This meant these were dead code since v19: the horizon mountains and ridges in the 3D view, the boulders around the map edge, the 150 HD rocks and the deep-space antenna.
   - The scenery builder is now named `buildScenery`, so all of these draw again.
2. **Science text didn't match the simulation (fixed).** The Moon's fact card said 127 °C. The simulation and NASA both use 121 °C.
3. **Mercury's sunlight was understated (fixed).** It said "up to 7 times". The average is about 7 times, and it reaches about 11 times at perihelion.
4. **Europa's radiation was vague (fixed).** "Deadly within days" is now the actual figure: about 5.4 Sv a day.

All three text fixes were also made in the Filipino and Spanish translations.

## Technical weaknesses (not changed in this update)

- **WebGL context loss.** It's handled in Adventure mode and in `render3d.js`, but there's no handler in the 2D canvas path. The 2D path doesn't need GPU state, so the risk is low.
- **Save format.** It's many small localStorage keys with no version number. Old keys are read with defaults, which works today. A future format change should add a `saveV` key and a migration step.
- **`index.html` is very large (573 KB of inline script and CSS).** It works, but it's hard to maintain. Splitting it into modules is a post-hackathon job.
- **Supabase key.** `www/config.js` holds only the publishable (anon) key. The service_role key is mentioned only in a comment warning not to use it. No secrets are in the repo.

## Performance

- **Revived scenery:** about 112–121k vertices in one static draw call, built once per world. Headless tests showed no measurable change in frame time.
- **Low graphics quality:** the scenery count is cut to 40%.
- **New ground patterns:** each world's ground signature is a few extra texture reads in the ground shader, and only in the HD and Real views.
- **New lights:** the base light masts are cached geometry. The beacons are one small sphere per module, and only while they blink.

## Recommendations for later

1. Version the saves (`saveV`).
2. Split `index.html` into modules.
3. Add a WebGL context-restore path for the Story renderer.
4. Add new worlds (Enceladus, Ganymede, Vesta) only after the judging.
