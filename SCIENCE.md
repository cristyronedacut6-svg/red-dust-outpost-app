# Red Dust Outpost · Science sources and verification notes

Every number the game shows the player is listed here. For each one you'll find:

- the value and its unit
- the conditions it applies under
- the source

Planet facts change with place, time of day and season, so the conditions column matters.

Last checked: 10 November 2026 (v85).

## Story mode worlds

| World | Quantity | Value in game | Conditions / approximation | Source |
|---|---|---|---|---|
| Moon | Surface gravity | 1.62 m/s² (17% of Earth) | Mean surface value | [NASA Moon facts](https://science.nasa.gov/moon/facts/) |
| Moon | Surface temperature | −173 to 121 °C | Equator, night to day. Polar craters are colder. | [NASA Moon facts](https://science.nasa.gov/moon/facts/) |
| Moon | Radiation dose | about 1.4 mSv per day | Measured by Chang'e 4 (1.369 mSv/day), quiet Sun, far side | Zhang et al. 2020, *Science Advances*, via [Sci.News](https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html) |
| Moon | Day–night cycle | 29.5 Earth days, so a night lasts about 14 days | Synodic month | [NASA Moon facts](https://science.nasa.gov/moon/facts/) |
| Mars | Surface gravity | 3.71 m/s² (38%) | Mean | [NASA Mars facts](https://science.nasa.gov/mars/facts/) |
| Mars | Surface temperature | −153 to 20 °C | Range over the planet. The base sim uses a Gale-crater-like range, −95 to 0 °C. | [NASA Mars facts](https://science.nasa.gov/mars/facts/) |
| Mars | Air pressure | under 1% of Earth (about 0.6%) | About 6 mbar, varies with season and altitude | NASA Mars facts |
| Mars | Sunlight | 43% of Earth | 1/1.524², mean distance | Inverse-square law |
| Mars | Radiation dose | about 0.67 mSv per day | Curiosity RAD, Gale crater, 2012–2013 | Hassler et al. 2014, *Science*, via [SwRI](https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars) |
| Mars | Launch windows | about every 26 months | Earth–Mars synodic period | [NASA Mars Exploration](https://science.nasa.gov/mars/) |
| Mercury | Surface gravity | 3.70 m/s² (38%) | Mean | [NASA Mercury facts](https://science.nasa.gov/mercury/facts/) |
| Mercury | Surface temperature | −180 to 430 °C | Night to day at the equator | NASA Mercury facts |
| Mercury | Sunlight | about 7 times Earth on average, up to 11 times at perihelion | 1/0.387² mean, 1/0.307² at perihelion. **Corrected in v85** (was "up to 7"). | Inverse-square law |
| Mercury | Sun's apparent size | about 2.5 times wider than from Earth | 1/0.387 at mean distance | Geometry |
| Mercury | Polar water ice | present in permanently shadowed craters | Earth radar, confirmed by MESSENGER (2012) | [NASA MESSENGER](https://science.nasa.gov/mission/messenger/) |
| Europa | Surface gravity | 1.31 m/s² (13%) | Mean | [NASA Europa facts](https://science.nasa.gov/jupiter/jupiter-moons/europa/europa-facts/) |
| Europa | Surface temperature | about −160 to −170 °C | Equator by day. Poles are colder. | NASA Europa facts |
| Europa | Sunlight | about 4% of Earth | 1/5.2² | Inverse-square law |
| Europa | Radiation | about 5.4 Sv per day, unshielded | Surface average. Varies strongly with longitude. **Made specific in v85** (was "deadly within days"). | Commonly cited estimate. See also the [JPL radiation map of Europa](https://www.jpl.nasa.gov/news/radiation-maps-of-jupiters-moon-europa-key-to-future-missions/) |
| Europa | Jupiter in the sky | about 12° wide | 2·atan(69,911 km / 671,034 km) | Geometry |
| Titan | Surface gravity | 1.35 m/s² (14%) | Mean | [NASA Titan facts](https://science.nasa.gov/saturn/moons/titan/) |
| Titan | Surface temperature | about −179 °C | Nearly uniform | NASA Titan |
| Titan | Air pressure | about 1.5 times Earth | 1.47 bar, measured by Huygens (2005) | NASA Titan / ESA Huygens |
| Titan | Sunlight | about 1% of Earth at the top of the air, less at the ground because of haze | 1/9.5² | Inverse-square law |
| Titan | Surface cobbles | rounded water-ice pebbles | Huygens landing-site images | ESA/NASA Huygens |
| Ceres | Surface gravity | 0.28 m/s² (3%) | Mean | [NASA Ceres facts](https://science.nasa.gov/dwarf-planets/ceres/facts/) |
| Ceres | Surface temperature | about −105 °C (sim range −143 to −73 °C) | Day-side estimate | NASA Ceres |
| Ceres | Sunlight | about 13% of Earth | 1/2.77² | Inverse-square law |
| Ceres | Bright spots | salts left by brine; some brine may remain | Occator crater, Dawn (2015–2018) | [NASA Dawn](https://science.nasa.gov/mission/dawn/) |
| Ceres | Ahuna Mons | ice volcano about 4 km tall | Dawn | NASA Dawn |

## Planet cards (main menu, v86)

| World | Day length | Atmosphere | Source |
|---|---|---|---|
| Moon | 29.5 Earth days (sunrise to sunrise) | None (a very thin exosphere) | NASA Moon facts |
| Mars | 24 h 40 min (one sol is 24 h 39.6 min) | Thin carbon dioxide, about 0.6% of Earth's pressure | NASA Mars facts |
| Mercury | 176 Earth days (sunrise to sunrise) | None (a very thin exosphere) | NASA Mercury facts |
| Europa | 3.6 Earth days (it always shows the same face to Jupiter, so a day equals its 3.55-day orbit) | Almost none (a trace of oxygen) | NASA Europa facts |
| Titan | 15.9 Earth days (tidally locked to Saturn) | Thick nitrogen with methane, about 1.5 times Earth's pressure | NASA Titan |
| Ceres | 9.1 hours | None | NASA Ceres facts |

Gravity and temperature on the cards are the same values as the Story mode table above.

## Light-speed delay (Earth help)

The delay is distance divided by the speed of light (299,792 km/s):

| World | Delay used |
|---|---|
| Moon | about 1.3 s |
| Mars | 3 to 22 min, depending on where the planets are |
| Titan | about 80 min at Saturn's mean distance |

The game shortens these waits so they're playable. It always tells the player the real figure.

## Adventure mode: real distances on the map (new in v85)

The map shows each planet's real distance from Earth today. How it's worked out:

- **Planet positions:** NASA JPL's approximate Keplerian elements (Standish, J2000 epoch). For each planet this uses the orbit's size (a), its shape (e), the mean longitude L with its rate, and the longitude of perihelion. Kepler's equation is solved each time.
- **Simplification:** inclinations are ignored. This puts the distances within about 1–2% for the major planets. A check against known 2026 events (Saturn's opposition on 4 October 2026 and Venus's inferior conjunction on 24 October 2026) gave about 8.6 AU and about 0.3 AU for 10 November 2026, as expected.
- **Moon:** shown at its mean distance of 384,400 km.
- **Ceres:** shown by its orbit size (2.77 AU from the Sun), not a live distance.

The map says clearly that the game's own sizes and distances are squeezed so trips take minutes.

Source: [JPL Solar System Dynamics, approximate positions of the planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)

## Mission Control decisions (new in v85)

Each world-specific decision tells a real fact:

| World | Decision | Real fact |
|---|---|---|
| Moon | Long night | Lunar nights last about 14 days, below −170 °C. NASA's Fission Surface Power project. |
| Mars | Launch window | A launch window opens every 26 months. |
| Mercury | Heat wave | MESSENGER's sunshade. |
| Mercury | Ice expedition | Polar ice confirmed by MESSENGER. |
| Europa | Radiation belts | About 5.4 Sv/day. Ice works as shielding. |
| Europa | Water plume | Hubble's plume observations. Europa Clipper (launched 2024, arrives 2030). |
| Titan | Methane rain | Titan's methane cycle. Burning methane needs oxygen, and Titan's air has no free oxygen. |
| Titan | Drone survey | The Dragonfly rotorcraft (launch planned for 2028). |
| Ceres | Brine | Dawn's results at Occator crater. |

## Visual identity (new in v85): what each world's look is based on

| World | Look | Based on |
|---|---|---|
| Moon | Dark mare basalt patches and bright ray streaks from fresh craters | Lunar albedo features |
| Mars | Dark basaltic sand in the low ground, ripples, layered mesas and buttes | Gale crater and Mount Sharp, as seen by Curiosity |
| Mercury | Brownish-grey ground, darker "low-reflectance material", small bright bluish "hollows" and lobate scarps | MESSENGER discoveries |
| Europa | Reddish-brown lineae (long bands with bright central ridges) and tilted ice rafts of chaos terrain | Galileo images of Conamara Chaos |
| Titan | Dark methane lakes in low ground, far from the base | Cassini radar |
| Titan | Rounded ice cobbles | Huygens |
| Ceres | Dark, low-albedo ground with bright salt patches, and Ahuna Mons on the horizon | Dawn |

## Science scanning discoveries (v87)

Each world has six. Every one is based on published mission results:

| World | Discoveries and sources |
|---|---|
| Moon | Anorthosite and the Apollo 15 "Genesis Rock" · mare basalt · ilmenite as an oxygen source · Apollo 17 orange volcanic glass (Shorty crater) · water detected by LCROSS at Cabeus crater (2009) · impact breccia |
| Mars | Hematite spherules ("blueberries") and jarosite (Opportunity, Meridiani Planum) · perchlorate (Phoenix, 2008) · basalt · clay-bearing mudstone and calcium sulfate veins (Curiosity, Gale crater) |
| Mercury | Hollows, carbon-rich low-reflectance material, high surface sulfur, volcanic smooth plains and polar ice (all from MESSENGER) · impact melt |
| Europa | Water-ice shell · sodium chloride (Trumbo et al. 2019, Hubble/Keck) · hydrated salts on lineae (Galileo NIMS) · sulfuric acid hydrate from Io's sulfur · hydrogen peroxide (Keck, 2013) · chaos terrain |
| Titan | Water-ice cobbles, methane-damp ground and river channels (Huygens, 2005) · tholins · organic dune sand and lake-shore evaporites (Cassini) |
| Ceres | Sodium carbonate in Occator crater, ammoniated clays, exposed water ice at Oxo crater, organics near Ernutet crater and hydrohalite (all from Dawn) · carbonaceous rock |

Two discoveries are worded as possibilities, because scientists aren't sure yet:

- How Mercury's hollows form: they "may" form from material escaping as gas.
- Where Europa's surface salts come from: they "may" come from the ocean.

## Rendering rules tied to the science (v89)

- **Airless worlds** (Moon, Mercury, Europa, Ceres): there is no atmosphere to scatter light.
  - **Distance:** far terrain is not faded by haze (no aerial perspective). Only the very edge of the map fades.
  - **Shadows:** in the HD and Real views, the sky does not fill them, so they are darker and harder. Earthshine on the Moon and Jupitershine on Europa still add a faint fill.
- **Mars and Titan** keep distance haze, because both have real atmospheres. Mars' is thin and dusty; Titan's is thick and hazy.

## Known approximations

- **Days and waves:** a game day is 50 seconds on every world. Real day lengths are explained in the facts and the field guide.
- **Scale:** buildings, aliens and distances in Story mode are scaled for play.
- **Ceres dust:** the realism module adds a little dust settling on solar panels on Ceres. This is a gameplay stand-in, not a measured rate.

## Adventure surfaces (v90, branch `adventure-mode-quality-upgrade`)

Each landing world now has its own ground recipe in `www/js/adv_terrain.js`. The surfaces are **procedural**: they are shaped by published descriptions, not copied from measured elevation. Where a landing site already used a real elevation model (the Moon sites and most Mars sites, in `models/dem/`), the recipe only changes colour, texture and rocks. It never invents landforms there.

| World | What the ground shows | Based on |
|---|---|---|
| Mars (Jezero) | Dark basaltic sand in low ground with wind ripples; pale, fractured bedrock on higher ground and every steep face; ochre dust elsewhere; a layered, terraced escarpment to the west (the delta front) and a delta-remnant butte; an eroded crater rim far away | Mars 2020 and HiRISE descriptions of the Jezero delta front, the "Séítah" ripple fields and the crater-floor bedrock |
| Moon | Mature grey regolith covered in small craters; brighter, blockier ejecta around a few young craters; no ripples (no wind) | Apollo and LROC images |
| Mercury | Darker, browner regolith than the Moon (low-reflectance material), small bright bluish "hollows", a lobate thrust scarp | MESSENGER MDIS results |
| Europa (Conamara Chaos) | Bright water ice; double ridges with reddish-brown material along them; tilted ice rafts in a darker, lumpy matrix; fine lineae in the ice | Galileo SSI images of Conamara Chaos |
| Titan (Kraken Mare shore) | Dark organic sand in long east–west dunes; rounded water-ice cobbles; darker, damp ground toward the sea | Huygens descent images (rounded cobbles), Cassini RADAR (linear dunes) |
| Ceres (Occator) | Very dark grey regolith; the bright sodium-carbonate faculae on the crater floor with fractures; the crater wall on the horizon | Dawn Framing Camera results |

**Rocks.** Rock sizes follow a power law, so there are many pebbles and few boulders, as counted at the Viking, Pathfinder and Mars 2020 sites. Rocks gather on crater rims, on slopes and at the foot of scarps. Mars and Moon rocks are angular; Titan and Ceres rocks are rounder. On Mars the rock tops carry a little dust.

**Approximations.**
- Landform sizes are compressed to fit a 1.4 km area. For example, the Jezero delta front is tens of metres high in reality, and Titan's dunes are about 100 m high and kilometres apart.
- Feature heights are chosen to look right; they are not measurements.

**Sound.**
- Worlds with almost no air (Mercury, Europa and the other "almost none" moons) are now treated as vacuum, like the Moon and Ceres. Before this, they used full-range sound by mistake.
- On the surface you always hear the suit: a fan hum and slow breathing, faster when you run.
- Only worlds with real air carry an outside breeze. On Mars it is very faint, because the air is so thin, and dust storms make it louder.
