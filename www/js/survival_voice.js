// Moon Survival · voiced dialogue.
// Two characters: KAI (the astronaut, a boy, played by your team) and MIKA (Mission Control on Earth, a girl).
// Every line has a code (k = Kai, m = Mika). Record it as   www/audio/vo/<code>.mp3   (example: www/audio/vo/k001.mp3).
// A recorded file plays when it exists; otherwise the game reads the line with the device's text-to-speech.
// The design team can change any text here. Keep the code the same so the recording still matches.

export const CAST = {
  kai:  { n: 'KAI',  role: 'Astronaut · ARTEMIS-7', col: '#F4A259', pitch: .85 },
  mika: { n: 'MIKA', role: 'Mission Control, Houston', col: '#55D6E8', pitch: 1.25 },
};

const L = (id, who, text) => ({ id, who, text });
// Each event holds one or more conversations. The game picks one at random and plays its lines in order.
export const VO = {
  start: [[
    L('m001', 'mika', 'ARTEMIS-7, this is Houston. Kai, do you read me? Your lander came down hard on the rim of Shackleton Crater.'),
    L('k001', 'kai', 'Loud and clear, Mika. I am okay. The lander is… less okay. It is lying on its side.'),
    L('m002', 'mika', 'Your suit has oxygen for now and the lander has a small reserve. Old supply caches from robot missions are scattered around you. Look for the blinking beacons.'),
    L('k002', 'kai', 'So: salvage junk, build a base, do not freeze. Easy. Just like camping. On the Moon. Alone.'),
    L('m003', 'mika', 'You are not alone. I am right here. Well, four hundred thousand kilometres away. But right here.'),
  ]],
  welcome: [
    [L('m004', 'mika', 'Welcome back, Kai. Your base missed you.'), L('k003', 'kai', 'Did it say that?'), L('m005', 'mika', 'The battery meter went up a little. I am choosing to read that as love.')],
    [L('m006', 'mika', 'Houston here. Systems are where you left them. Ready to keep going?'), L('k004', 'kai', 'Ready. Coffee would help, but ready.')],
  ],
  daily: [[L('m007', 'mika', 'Today’s challenge is the same for every crew on Earth, Kai. One life. No second tries. Make it count.'), L('k005', 'kai', 'No pressure. Just the whole planet watching.')]],
  move: [[L('k006', 'kai', 'Whoa. One-sixth gravity. Every step feels like a trampoline.'), L('m008', 'mika', 'Careful. Your momentum is real even if your weight is not. Moving fast is easy. Stopping is the hard part.')]],
  jet: [[L('k007', 'kai', 'Jetpack is working! I am flying! Sort of. Mostly falling with style.'), L('m009', 'mika', 'Watch your fuel. With no air there is nothing to slow you down. Only your thrusters can stop you.')]],
  cache: [[L('k008', 'kai', 'Found a supply cache. Scrap metal and electronics. Christmas came early.'), L('m010', 'mika', 'Those crates were left by robotic landers. Everything you build starts with them.')]],
  cacheEmpty: [[L('k009', 'kai', 'This one is empty. On to the next beacon.')], [L('k010', 'kai', 'Cleaned out. Somebody tidy should be proud of me.')]],
  dig: [[L('k011', 'kai', 'Moon dirt. Regolith. It is like powdered glass that sticks to everything.'), L('m011', 'mika', 'Pile enough of it up and it blocks radiation. Ugly, but it works.')]],
  build: [[L('m012', 'mika', 'Build menu is open. Put the solar tower where the Sun reaches. Shadows here last a long time.')]],
  b_solar: [[L('k012', 'kai', 'Solar tower is up. It turns to follow the Sun all the way around the sky.'), L('m013', 'mika', 'At the pole the Sun never rises high. It just circles the horizon. Tall towers catch it above the shadows.')]],
  b_battery: [[L('k013', 'kai', 'Battery installed. Now the lights stay on when the Sun hides.'), L('m014', 'mika', 'Good thinking. A long night at the pole can kill a base without stored power.')]],
  b_hab: [[L('k014', 'kai', 'Habitat is inflated! Walls, air, a door. I have a house!'), L('m015', 'mika', 'Congratulations, homeowner. Step inside through the airlock. You have earned a break.')]],
  b_ice: [[L('k015', 'kai', 'Ice processor online. Ice goes in, oxygen and water come out.'), L('m016', 'mika', 'Splitting water gives you oxygen to breathe and hydrogen for fuel. That is why every Moon base wants to be near the ice.')]],
  b_berm: [[L('k016', 'kai', 'Regolith shield is built. It is basically a really expensive dirt wall.'), L('m017', 'mika', 'A really expensive dirt wall that stops solar flares. Hide behind it when the alarm goes off.')]],
  b_antenna: [[L('k017', 'kai', 'Laser comms terminal assembled. Can you see me now?'), L('m018', 'mika', 'Signal locked. It only works when Earth is in view, so keep it on high ground.')]],
  hab: [[L('k018', 'kai', 'Airlock cycling… and I am in. I can hear my own voice without the radio. That is weird.'), L('m019', 'mika', 'That inside is modelled on NASA’s real Habitat Demonstration Unit. Eight sections: the airlock, the EVA station, the geology lab, the computer station, medical, the bathroom, the galley and the storage.'), L('k019', 'kai', 'And a bed. I see a bed. Talk later, Mika.')]],
  habAgain: [[L('k020', 'kai', 'Home sweet home.')], [L('k021', 'kai', 'Shoes off. Well, boots. Well, nothing comes off. Never mind.')], [L('m020', 'mika', 'Welcome inside. Remember to refill your suit at the EVA station.')]],
  shadow: [[L('k022', 'kai', 'I just stepped into shadow and the temperature fell off a cliff.'), L('m021', 'mika', 'Without air, nothing holds the heat. Sun is about minus thirty. Shadow is much colder. Do not stay long.')]],
  crater: [[L('k023', 'kai', 'I am inside the crater. It is pitch black down here. My helmet lamp is the only light.'), L('m022', 'mika', 'That floor has not seen sunlight in billions of years. It is around minus two hundred thirty degrees. Grab the ice and get out.')]],
  ice: [[L('k024', 'kai', 'Got a chunk of ice. Real Moon ice!'), L('m023', 'mika', 'Water on the Moon. Scientists argued about it for decades. You are holding the answer.')]],
  sample: [[L('k025', 'kai', 'Found a sample with a blue marker. Bagging it for the lab.'), L('m024', 'mika', 'Bring it to the geology glovebox in the habitat. Every sample teaches us something.')]],
  sampleMore: [[L('k026', 'kai', 'Another sample! My collection is growing.')], [L('k027', 'kai', 'Shiny rock acquired. Science!')], [L('m025', 'mika', 'Nice find, Kai. The lab team is going to fight over that one.')]],
  geo: [[L('m026', 'mika', 'Analysis received. Research points added. You can trade them for better gear.')], [L('k028', 'kai', 'Running the analysis. I feel like a real scientist. I am a real scientist.')]],
  upgrade: [[L('k029', 'kai', 'Upgrade installed. I feel more powerful already.'), L('m027', 'mika', 'That is the research paying off. Good work.')]],
  eat: [[L('k030', 'kai', 'Fresh food from the atrium plants. Best salad on the Moon.')], [L('k031', 'kai', 'Mmm. Tastes like… lettuce grown in Moon water. Delicious, honestly.')]],
  drink: [[L('k032', 'kai', 'Recycled water. I try not to think about where it came from.')], [L('k033', 'kai', 'Ahh. Cold, clean, and only a little bit from ice older than the dinosaurs.')]],
  hungry: [[L('k034', 'kai', 'My stomach is louder than the radio. I need to eat.'), L('m028', 'mika', 'Eat at your lander or the habitat galley. Plants in the atrium need power and water to grow more.')]],
  thirsty: [[L('k035', 'kai', 'I am getting really thirsty.'), L('m029', 'mika', 'Melt ice in the processor to make water. Drink at the habitat water dispenser.')]],
  o2low: [[L('m030', 'mika', 'Kai, your oxygen is low. Get to the lander or the habitat now.'), L('k036', 'kai', 'Copy. Moving.')]],
  pwlow: [[L('m031', 'mika', 'Suit power is low. Without it your heaters stop. Recharge soon.')]],
  cold: [[L('k037', 'kai', 'I am freezing. My fingers are going numb.'), L('m032', 'mika', 'Get back into the sunlight. Your suit heaters cannot keep up in the dark.')]],
  flareWarn: [[L('m033', 'mika', 'Solar flare alert! The Sun just threw out a burst of radiation. Get inside the habitat or behind a regolith shield. Now!'), L('k038', 'kai', 'Running!')]],
  flareSafe: [[L('m034', 'mika', 'The flare has passed. You are safe. Nice sheltering.'), L('k039', 'kai', 'Thank you, dirt wall.')]],
  flareHit: [[L('m035', 'mika', 'The flare is over, but you took a dose. Please shelter faster next time. I worry.'), L('k040', 'kai', 'Sorry, Mika. I am glowing a little.'), L('m036', 'mika', 'You are not glowing. That is not how radiation works.')]],
  leak: [[L('k041', 'kai', 'Something hit me! I hear hissing. My suit is leaking!'), L('m037', 'mika', 'Micrometeorite. Tiny, but very fast. Press P to patch it with scrap, or get inside.')]],
  patched: [[L('k042', 'kai', 'Leak patched. Duct tape saves the day again.')]],
  dust: [[L('m038', 'mika', 'Kai, your solar tower is losing power. Moon dust is settling on the panels.'), L('k043', 'kai', 'Moon dust. My new enemy.'), L('m039', 'mika', 'The Apollo crews hated it too. Go brush it off.')]],
  clean: [[L('k044', 'kai', 'Panels clean. Sparkling. Like new.')], [L('k045', 'kai', 'And that is why I bring a brush to space.')]],
  earth: [[L('k046', 'kai', 'Mika… I can see Earth. It is just sitting there on the horizon. It is so blue.'), L('m040', 'mika', 'From the pole it never rises or sets. It just stays there. Say hi to everyone.'), L('k047', 'kai', 'Hi, everyone.')]],
  rover: [[L('k048', 'kai', 'The rover is fixed! Four wheels, no traffic.'), L('m041', 'mika', 'Drive carefully. And please do not jump it off the crater rim.'), L('k049', 'kai', 'No promises.')]],
  goal: [[L('m042', 'mika', 'Objective complete. Nice work, Kai.')], [L('m043', 'mika', 'That is one more step to a real base. Keep going.')], [L('k050', 'kai', 'Done! Next!')]],
  rest: [[L('k051', 'kai', 'Just resting my eyes for five minutes.'), L('m044', 'mika', 'Sleep well. I will keep watch.')]],
  report: [[L('k052', 'kai', 'Base report sent. Mika, did you get it?'), L('m045', 'mika', 'We got it! The whole room is cheering. A supply ship is launching to you right now. Hang on, Kai.')]],
  approach: [[L('m046', 'mika', 'Supply ship on final approach. Stand clear of the landing zone. The engine will blast dust everywhere.'), L('k053', 'kai', 'I see it! I see the light!')]],
  landed: [[L('k054', 'kai', 'Touchdown! Mika, the ship is here. I am not alone anymore.'), L('m047', 'mika', 'You were never alone. Welcome to the first base at the lunar south pole, Commander.')]],
  dead: [[L('m048', 'mika', 'Kai? Kai, do you read? …We lost his signal.')], [L('m049', 'mika', 'Suit failure. Rebooting from the last safe point. Let us try that again, Kai.')]],
  // little chats every few minutes, so the Moon is never too quiet
  idle: [
    [L('k055', 'kai', 'Mika, what did you eat for lunch?'), L('m050', 'mika', 'Adobo.'), L('k056', 'kai', 'Please never tell me that again while I am eating space food.')],
    [L('m051', 'mika', 'Fun fact: there is no wind on the Moon, so the Apollo footprints are still there.'), L('k057', 'kai', 'So my footprints will be here for a million years? I should have walked nicer.')],
    [L('k058', 'kai', 'It is so quiet here. No birds, no cars, no neighbours singing karaoke.'), L('m052', 'mika', 'Want me to sing?'), L('k059', 'kai', 'I take it back. I love the quiet.')],
    [L('m053', 'mika', 'Your heart rate looks good. Your jokes, less good.'), L('k060', 'kai', 'Mission Control is so mean.')],
    [L('k061', 'kai', 'If I throw a rock really hard, does it go into orbit?'), L('m054', 'mika', 'You would need to throw it at about one point seven kilometres per second.'), L('k062', 'kai', 'So… no.'), L('m055', 'mika', 'So no.')],
    [L('m056', 'mika', 'Did you know a day here at the pole has no proper sunrise? The Sun just slides along the horizon.'), L('k063', 'kai', 'Great. So when do I sleep?'), L('m057', 'mika', 'When I say so.')],
    [L('k064', 'kai', 'Mika, tell my family I am fine. And that I miss home cooking.'), L('m058', 'mika', 'Already done. Your mom says eat your vegetables.'), L('k065', 'kai', 'I am literally growing them.')],
    [L('m059', 'mika', 'The dust you keep complaining about? Apollo astronauts said it smelled like spent gunpowder.'), L('k066', 'kai', 'Can I report it to someone? Like a Moon manager?')],
    [L('k067', 'kai', 'Do you think there are aliens out here?'), L('m060', 'mika', 'No. Just you, rocks and a lot of very cold ice.'), L('k068', 'kai', 'That is somehow scarier.')],
    [L('m061', 'mika', 'Radio check. Still alive?'), L('k069', 'kai', 'Still alive. Still handsome.'), L('m062', 'mika', 'Only one of those is confirmed.')],
    [L('k070', 'kai', 'Mika, I named a rock. His name is Bato.'), L('m063', 'mika', 'Kai. Bato means rock.'), L('k071', 'kai', 'And he is proud of it.')],
    [L('m064', 'mika', 'The Earth you see out there spins once a day. Our office is on the side facing you right now.'), L('k072', 'kai', 'I am waving. Can you see me waving?'), L('m065', 'mika', 'Not even a little bit. But thank you.')],
  ],
};

// Adventure mode opening (plays over the flight past Earth). Codes a001…
export const ADV_VO = {
  first: [[
    L('a001', 'mika', 'Kai, welcome to the Grand Tour. Your ship is in orbit around Earth, and the whole solar system is open.'),
    L('a002', 'kai', 'The whole solar system? Mika, I do not even have a map.'),
    L('a003', 'mika', 'You do. Tap the map, pick a planet, and the autopilot flies you there.'),
    L('a004', 'kai', 'And if I see something cool?'),
    L('a005', 'mika', 'Fly close and scan it. Over two hundred real NASA spacecraft, rovers and suits are out there. Scan them and you can fly some of them yourself.'),
    L('a006', 'kai', 'Fly the Space Shuttle myself? Okay. Best job ever. Let us go!'),
  ]],
  back: [
    [L('a007', 'mika', 'Welcome back to orbit, Kai. Where to today?'), L('a008', 'kai', 'Somewhere I have not been yet. Surprise me.')],
    [L('a009', 'kai', 'Mission Control, I am back in the pilot seat.'), L('a010', 'mika', 'Copy. Try not to crash into Saturn’s rings this time.')],
    [L('a011', 'mika', 'Systems green, Kai. The planets have been waiting for you.'), L('a012', 'kai', 'Tell them I am on my way.')],
  ],
};

// ---------------- the player ----------------
// play(ev, opts): queue a conversation. opts.once = play only the first time (remembered in the save).
export function makeVoice(api, SET = VO) {
  const q = [], ok = {}, last = {}; let busy = false, el = null, cur = null, enabled = true;
  const base = 'audio/vo/';
  function box() { if (el && el.isConnected) return el; el = document.createElement('div'); el.className = 'svvo';
    el.style.cssText = 'position:absolute;left:50%;bottom:118px;transform:translateX(-50%);max-width:min(640px,90vw);background:rgba(8,14,22,.86);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 14px;font:15px/1.35 system-ui;color:#e8f1f5;display:none;pointer-events:none;z-index:6;text-align:left';
    const host = api.host && api.host(); (host || document.body).appendChild(el); return el; }
  function sub(line) { const b = box(); if (!line) { b.style.display = 'none'; return; } const c = CAST[line.who]; b.innerHTML = `<b style="color:${c.col}">${c.n}</b> <small style="opacity:.6">${c.role}</small><br>${line.text}`; b.style.display = 'block'; }
  function tts(line, done) { const ss = window.speechSynthesis; if (!ss || !api.voiceOn()) return setTimeout(done, 900 + line.text.length * 55);
    try { const u = new SpeechSynthesisUtterance(line.text), vs = ss.getVoices().filter(v => /^en/i.test(v.lang)), c = CAST[line.who];
      const girl = /female|zira|samantha|karen|victoria|susan|fiona|tessa|moira|aria|jenny|libby|sonia|natasha|google us english$/i, boy = /\bmale|david|daniel|alex|fred|guy|mark|ryan|thomas|google uk english male/i;
      const v = vs.find(x => (line.who === 'mika' ? girl : boy).test(x.name)) || vs[0]; if (v) u.voice = v; u.pitch = c.pitch; u.rate = 1.05; u.volume = .95;
      let fin = false; const end = () => { if (!fin) { fin = true; done(); } }; u.onend = end; u.onerror = end; setTimeout(end, 2500 + line.text.length * 90); ss.speak(u); } catch (e) { done(); } }
  function rec(line, done) { const a = new Audio(base + line.id + '.mp3'); let fin = false; const end = () => { if (!fin) { fin = true; done(); } };
    a.volume = .95; a.onended = end; a.onerror = () => { ok[line.id] = false; if (!fin) { fin = true; tts(line, done); } };
    a.play().then(() => { ok[line.id] = true; }).catch(() => { if (!fin) { fin = true; ok[line.id] = false; tts(line, done); } }); setTimeout(end, 25000); cur = a; }
  function next() { if (!enabled) { q.length = 0; busy = false; sub(null); return; } const line = q.shift(); if (!line) { busy = false; setTimeout(() => { if (!busy) sub(null); }, 1200); return; } busy = true; sub(line);
    try { api.radio && api.radio(); } catch (e) {}
    const done = () => setTimeout(next, 280); if (ok[line.id] === false) tts(line, done); else rec(line, done); }
  function play(ev, opts = {}) { const set = SET[ev]; if (!set || !enabled) return false; const st = api.state(), now = Date.now();
    if (opts.once && st) { st.said = st.said || {}; if (st.said[ev]) return false; st.said[ev] = 1; }
    if (opts.cool && last[ev] && now - last[ev] < opts.cool * 1000) return false; if (busy && opts.skipIfBusy) return false; last[ev] = now;
    const conv = set[Math.floor(Math.random() * set.length)]; if (opts.urgent) { q.length = 0; try { cur && cur.pause(); speechSynthesis.cancel(); } catch (e) {} busy = false; }
    q.push(...conv); if (!busy) next(); return true; }
  function stop() { q.length = 0; busy = false; try { cur && cur.pause(); window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} sub(null); }
  return { play, stop, get busy() { return busy; }, set on(v) { enabled = v; if (!v) stop(); } };
}
