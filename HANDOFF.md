# Red Dust Outpost — hand-off for the next laptop

Read this first. It tells a new Claude Code session (or a person) where the project stands and what comes next.

## Where things are

- **Repository:** https://github.com/cristyronedacut6-svg/red-dust-outpost-app
- **Working branch:** `high-end-quality-realism-upgrade`
  - Built on top of `moon-survival`, the newest version as of 14 Nov 2026 (cache v102, which already contains `release-v90`).
  - Not merged into `main`, and not deployed. The live site and the Android build only update from `main` (see `.github/workflows/build.yml`).
- **The game:** `www/` holds plain ES modules with no build step. three.js r169 is vendored in `www/js/vendor/three`. The Android app is a Capacitor wrapper around the same files.

## Setting up the new laptop

1. Install Git and VS Code (plus the Claude Code extension).
2. Clone and switch to the branch:
   ```
   git clone https://github.com/cristyronedacut6-svg/red-dust-outpost-app
   cd red-dust-outpost-app
   git checkout high-end-quality-realism-upgrade
   ```
3. Play it in a browser. Serve the `www` folder, because opening `index.html` directly does not work (the browser blocks ES modules from `file://`). Either:
   - VS Code: install the **Live Server** extension, right-click `www/index.html` and choose **Open with Live Server**; or
   - use the PowerShell server on the `release-v90` branch (its Windows launcher).

   Press **Ctrl+Shift+R** once to skip the browser's saved copy.
4. Optional, to continue the exact chat:
   - Copy `C:\Users\Admin\.claude\projects\c--Users-Admin-red-dust-outpost-app\` from the old laptop to the same path on the new one.
   - Clone the repo to `C:\Users\Admin\red-dust-outpost-app` (the path must match).
   - Run `claude --resume` in that folder.

## What this branch adds (Adventure Mode realism)

| Area | What | Files |
|---|---|---|
| Ground | Photo-scanned CC0 ground (Poly Haven: `moon_dusted_02`, `rock_ground`, `dry_ground_rocks`, `rocks_ground_05`), turned into brightness-detail maps plus normal maps; anti-tiling at distance | `www/models/tex/hd/ground_*.jpg`, `adv_surface.js` (`GROUND`, `groundTex`) |
| Landscape | Far mountain ring stitched to the terrain edge (only on worlds without the upstream `adv_terrain.js` recipe) | `adv_terra.js` (`farHeight`, `makeFar`) |
| Shadows | Hills and crater walls shade the land: a CPU bake into two DataTextures, sampled by every lit material through a global ShaderChunk patch (`LIT`, `litHook`). Near the astronaut the live shadow map takes over | `adv_terra.js` (`makeBake`) |
| Light | Per-world reflection map (`makeEnv`); airless bounce light; low-Sun exposure boost; AgX tone mapping | `adv_terra.js`, `adv_surface.js`, `adventure.js` |
| Sun | Disc, corona, diffraction spikes and lens ghosts, hidden when the Sun is behind terrain | `adv_terra.js` (`makeSun`), `adv_surface.js` (`sunStep`, `sunClear`) |
| Terrain data | NASA 16-bit DEM PNGs decoded at full precision (`loadHeights16`), with the canvas loader as fallback | `adv_terra.js`, `adventure.js` (`loadDEM`) |
| Astronaut | NASA Z-2 suit GLB rigged at load (the mesh is split into its 43 pieces, each bound to a joint); dust tint on boots and gloves; backpack O2/jet read-out; procedural gait (weight shift, lean, jetpack pose) | `adv_astro.js` |
| Movement | Jetpack with fuel on low-gravity worlds; landing camera shake; speed FOV | `adv_surface.js` (`stepLand`) |
| Camera | Over-the-shoulder framing; frame-rate-independent follow (on foot, rover, aircraft) | `adv_surface.js` |
| Rover | New original pressurized exploration rover on the Moon (the Apollo sites keep the real LRV); six-wheelers keep their middle wheels straight | `adv_rover.js` (`kind === 'pxr'`) |
| Base | On airless worlds (not the Apollo sites): NASA Habitat Demonstration Unit plus base-station models, a 22 m comms tower with a blinking beacon, and work lights | `adv_surface.js` (`makeBase`) |
| Scan view | Continue opens a full-screen discovery view: drag or pinch to inspect the model, sectioned record built only from existing data | `adventure.js` (`card`, `viewer`), `adv_tech.js` CSS |
| HUD | Space-tech skin, compass on foot | `adv_tech.js` |
| Story Mode | 3D view: buildings rise out of the ground with a weld glow; camera follow is frame-rate independent | `render3d.js` (`building`), `index.html` (`camUp`) |
| Offline | Service worker cache `rdo-v103`, with the new modules added | `www/sw.js` |

Test hook for developers: `ADV._land('moon', 'tycho')` in the browser console puts the astronaut straight onto a world, skipping the flight.

## Known issues to check

- **Mars:** in headless tests on a CPU-only renderer, some NASA model materials failed with "VALIDATE_STATUS false", followed by a null program log. That looks like the software renderer running out of graphics memory. Not confirmed on a real GPU.
- **NASA model texture:** one NASA model logs "GLTFLoader: Couldn't load texture blob:…" (cause not investigated).
- **Phones:** check the frame rate on Android. The terrain shadows, mountains, rocks and base all add rendering work.
- **Astronaut:** check the joints while moving (knees, elbows, wrists) and the new pressurized rover's ride height and camera distance.
- **Not done:**
  - ambient occlusion;
  - photo-scanned 3D rocks;
  - real NASA orbiter imagery (LROC, HiRISE) as ground colour;
  - Story Mode model and material upgrades.

## The plan: moving to Unity

The goal is a big jump in realism, toward the look of *Deliver Us The Moon* (Unreal Engine 4). Use that game as an art reference only: do not copy its assets or designs.

**Hardware needed** (the old laptop had about 3.6 GB free, 7.4 GB RAM and integrated graphics, which is not enough):
- 50 GB or more of free disk;
- 16 GB or more of RAM;
- a dedicated GPU (NVIDIA RTX or a recent AMD RX) for HDRP.

**Install:**
- Unity Hub, then Unity 6 LTS, with the Android Build Support module (OpenJDK, SDK and NDK);
- Git and VS Code.

**Choose a render pipeline:**
- **HDRP:** the most realistic, but PC and console only (no Android, no web).
- **URP:** runs on Android and on the web, but looks closer to what the browser version already does.

Decide which platforms matter before starting.

**Approach (do not rewrite everything at once):**
1. **Prototype one Moon landing site** in Unity, then compare it side by side with the web version:
   - terrain from the NASA DEM in `www/models/dem/` (16-bit PNG heightmaps; relief values in `meta.json`);
   - the Z-2 suit and the other NASA GLBs in `www/models/nasa/` (glTFast imports them);
   - a third-person controller using the low-gravity gait rules in `adv_astro.js`;
   - photogrammetry rocks;
   - HDRP or URP lighting.
2. **If it is clearly better, port in this order:**
   1. surface walking;
   2. rovers (`adv_rover.js`);
   3. scanning and the discovery view;
   4. space flight between worlds (`adventure.js`, with the data in `adv_data.js`);
   5. Story Mode (`index.html`, `render3d.js`);
   6. Moon Survival (`survival*.js`);
   7. multiplayer (`coop.js`, `net.js`, Supabase in `supabase/`).
3. **Keep these from the web version:**
   - the scientific data (`adv_data.js`, `story_real.js`);
   - the 17 languages (`i18n*.js`);
   - the recorded voices.

   Keep the web version live until the Unity build matches it.

**Asset sources (check every licence):**
- NASA 3D Resources;
- Poly Haven (CC0);
- ambientCG (CC0);
- Quixel Megascans via Fab (check the licence terms for Unity use);
- NASA PDS: LROC and LOLA for the Moon, HiRISE for Mars.

## User preferences learned this session

- The user (who writes in English with some Filipino phrasing) wants maximum visual realism and a "wow" quality.
- Work in batches and keep test runs to a minimum: the user does the full playtesting, to save usage.
- Do not merge into `main` or deploy without asking. Work on branches.
- Explain things in plain words. Give clear click-by-click steps when the user has to do something.
