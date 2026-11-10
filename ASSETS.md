# Red Dust Outpost · Asset and source manifest

Every third-party asset the game ships, where it came from, who made it and its licence. The in-game Credits screen (main menu, then Credits) shows the same list. Reviewed on 10 November 2026 (v88).

## Rules

NASA material:
- NASA is not endorsing Red Dust Outpost. The NASA insignia is never used as the game's logo, and no partnership is implied.
- NASA material is used under the [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
- The NASA "meatball" and "worm" logo models found in the NASA 3D collection (`nasa-insignia`, `hubble-medallion`, `viking-emblem`) are only shown as historical objects in Adventure mode's museum and scan codex, never as branding.

CC-BY assets:
- Each one is credited by name, with a link, in Credits.

New assets in v85–v88:
- None were downloaded. All new visuals are generated in code: terrain patterns, landmarks, walkways, lights, the base interior and the icons.
- The only new external resource is the **Inter** font from Google Fonts (SIL Open Font License 1.1). It loads at runtime and is cached for offline play.

## Third-party 3D models and libraries

| Asset | Source | Creator / credit | Licence | Format | Used in |
|---|---|---|---|---|---|
| Spacecraft, rovers, rockets, suits, Deep Space Network dishes (about 330 models) | [NASA 3D Resources](https://science.nasa.gov/3d-resources/), [GitHub mirror](https://github.com/nasa/NASA-3D-Resources) | NASA | Public domain (NASA media guidelines) | Converted to compact JSON meshes, with LOD versions in `www/models/nasa/lod/` | Adventure mode; HD and Real Story buildings (astronaut, Robonaut 2, Perseverance, Lunar Module, habitat, RASSOR, Ingenuity, DSN) |
| Planet and moon textures | NASA/JPL ([Solar System Simulator maps](https://space.jpl.nasa.gov/tmaps/)) and NASA Visible Earth (Blue Marble, **Black Marble** city lights) | NASA, JPL, USGS | Public domain | WebP, `www/models/tex/` | Adventure planets and skies |
| Landing-site terrain (25 height tiles) | NASA 3D Resources terrain sets (e.g. "Apollo 11 - Landing Site", "Mars - Gale Crater"), see `www/models/dem/meta.json` | NASA | Public domain | PNG height maps, `www/models/dem/` | Adventure surface landings |
| Crystal Golem | [Ricky the Golem](https://sketchfab.com/3d-models/ricky-the-golem-3137dc79dc8f4f94a68dab112b224f66) | Agustin Ruella | CC-BY-4.0 | JSON mesh, `boss_golem.js` | Moon boss (HD/Real) |
| Solar Scorcher | [Red Cherub](https://sketchfab.com/3d-models/red-cherub-6daf0cd669934d1cae88e31fedfa183f) | Spinnee | CC-BY-4.0 | `boss_cherub.js` | Mercury boss |
| Ice Kraken | [Octopus Blue Animal](https://sketchfab.com/3d-models/octopus-blue-animal-99a562a89fe146aabcc77e644ce79b1d) | 3dUVpro | CC-BY-4.0 | `boss_kraken.js` | Europa boss |
| Asteroid Colossus | [Stonebound Colossus](https://sketchfab.com/3d-models/stonebound-colossus-alien-sci-fi-838a909835454ae29d89ae35b25dd957) | antromar3 | CC-BY-4.0 | `boss_colossus.js` | Ceres boss |
| Echo / Hive Mind | [Xenomorph Queen Alien](https://sketchfab.com/3d-models/xenomorph-queen-alien-865f066315474c55a7e10781345f466c) | M0RPH0 | CC-BY-4.0 | `boss_queen.js` | Final boss |
| Hive Queen of Titan | [Fireborne Blight Queen](https://sketchfab.com/3d-models/fireborne-blight-queen-0f65f0ee9ae9425bb6154c4a95a9c62a) | HighPolyDensity | CC-BY-4.0 | `boss_blight.js` | Titan boss |
| Farm capsule | [Sci-Fi Plant Capsule](https://sketchfab.com/3d-models/sci-fi-plant-capsule-bd2d05db1bf24143ac2030c57e1eb05e) | Berk Gedik | CC-BY-4.0 | `boss_plant.js` | Farm (HD/Real) |
| Great Dust Worm | [Giant Worm](https://sketchfab.com/3d-models/giant-worm-0215a114667747009b178c6bfe8d776b) | Vasian-Digital3D | CC-BY-4.0 | `worm.js` | Mars boss |
| three.js r169 | [threejs.org](https://threejs.org/) | three.js authors | MIT | ES modules, `www/js/vendor/three/` | Adventure mode renderer |
| Inter font | [Google Fonts](https://fonts.google.com/specimen/Inter) | Rasmus Andersson | SIL OFL 1.1 | Web font | v86+ interface |
| Chakra Petch font | [Google Fonts](https://fonts.google.com/specimen/Chakra+Petch) | Cadson Demak | SIL OFL 1.1 | Web font | Logo and world titles |

## Data sources

| Data | Source | Used for |
|---|---|---|
| Gravity, temperatures, day lengths, distances | [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/index.html) and NASA world pages | Story simulation, planet cards, fact cards. The full table is in [SCIENCE.md](SCIENCE.md). |
| Live solar flares and CMEs | [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI) | Optional "Live NASA data" setting |
| Planet positions today | [JPL approximate positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Adventure map distances |
| 36 science discoveries | MESSENGER, Dawn, Cassini–Huygens, Galileo, Curiosity, Opportunity, Phoenix, Apollo, LCROSS results | Story scanning. Sources per world are in SCIENCE.md. |

## Adventure surfaces (v90 branch)

**No new files were downloaded or added.**

- **Textures:** the ground textures, ripples, bedrock plates, micro-craters and ice lineae are all generated in code at load time, in `www/js/adv_terrain.js`. There is nothing to licence.
- **Poly Haven and ambientCG:** checked as material sources, but these sites can't be reached from the build machine. Nothing from them was used.
- **NASA 3D Resources:** the repository's image folder holds only whole-planet maps, with no ground-level textures. Those planet maps are already in the game.
- **Elevation models:** the real ones already in `models/dem/` (Moon and Mars sites) are unchanged. The new recipes only recolour and texture them.

## Template for future assets

Record every new asset here **before** it ships:

| Asset | Source URL | Creator / credit | Licence | Format / size | Used in | Date added |
|---|---|---|---|---|---|---|
| | | | | | | |
