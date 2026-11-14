// Red Dust Outpost · Adventure "space-tech" HUD skin.
// A layer on top of the base Adventure styles: angular holographic panels, a glowing frame with corner brackets,
// faint scanlines, rotating rings on the action buttons, a compass tape on foot and boot-up animations.
// Only looks change here; every size and position rule for phones stays in adventure.js.

export const TECH_CSS = `
#adv{--hc:#7df9ff;--hc2:rgba(125,249,255,.55);--hcl:rgba(125,249,255,.16);--hbg:rgba(4,12,24,.72);--hbg2:rgba(8,22,40,.55);--hw:#ffcf4a;--cut:9px}
/* ---- panels: cut corners, glass, a glowing inner edge and a fine grid ---- */
#adv .ab,#adv #aMis,#adv #aSuit,#adv #aSpd,#adv #aLd,#adv #aToast{border-radius:0!important;clip-path:polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut));
  background:linear-gradient(135deg,var(--hbg2),var(--hbg)),repeating-linear-gradient(0deg,transparent 0 3px,rgba(125,249,255,.035) 3px 4px);border:1px solid var(--hc2);
  box-shadow:inset 0 0 0 1px rgba(125,249,255,.08),inset 0 0 18px rgba(125,249,255,.12);text-shadow:0 0 6px rgba(125,249,255,.35);letter-spacing:.04em}
#adv #aTop .ab{position:relative}
#adv .ab::before{content:'';position:absolute;left:0;top:0;width:10px;height:10px;border-left:2px solid var(--hc);border-top:2px solid var(--hc);pointer-events:none;filter:drop-shadow(0 0 3px var(--hc))}
#adv .ab:hover{background:linear-gradient(135deg,rgba(20,60,90,.75),rgba(6,18,34,.8));border-color:var(--hc)}
#adv .ab:active{transform:translateY(1px)}
#adv #aLand,#adv #aDrv{background:linear-gradient(180deg,#ffe28a,#d89a2a)!important;color:#1c1003;text-shadow:none;border-color:#fff3c8}
#adv #aFly{background:linear-gradient(180deg,#9ffcff,#2f8fd8)!important;color:#03101c;text-shadow:none}
#adv #aMis{border-left:3px solid var(--hc)}
#adv #aMis b{font-family:var(--disp,system-ui);letter-spacing:.24em}
#adv #aMis b::before{content:'◆ ';color:var(--hw)}
#adv #aSuit{border-left:3px solid var(--hc);font-family:ui-monospace,'Cascadia Mono',Menlo,monospace}
#adv #aSuit .jb{letter-spacing:-.05em;color:var(--hc)}#adv #aSuit .jb.on{color:#fff;text-shadow:0 0 8px var(--hc)}#adv #aSuit .jb.w{color:var(--hw)}#adv #aSuit .jb.d{color:#ff6a5a}
#adv.helm #aSuit{clip-path:none;background:none!important;border:0;box-shadow:none}
#adv #aToast{border-left:3px solid var(--hw);border-color:rgba(255,207,74,.6);background:linear-gradient(90deg,rgba(40,30,4,.85),rgba(6,10,22,.85))}
#adv #aSpd{font-family:ui-monospace,'Cascadia Mono',Menlo,monospace;letter-spacing:.06em}
/* ---- menus and cards ---- */
#adv .crd{border-radius:0;clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px);
  background:linear-gradient(180deg,rgba(10,22,44,.97),rgba(4,10,24,.97)),linear-gradient(var(--hcl) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,var(--hcl) 1px,transparent 1px) 0 0/22px 22px;
  background-blend-mode:normal,screen,screen;border:1px solid var(--hc2);box-shadow:inset 0 0 40px rgba(125,249,255,.08);animation:tBoot .38s cubic-bezier(.2,.9,.3,1) both}
#adv .crd .ey{font-family:ui-monospace,'Cascadia Mono',Menlo,monospace;letter-spacing:.3em}#adv .crd .ey::before{content:'// ';opacity:.6}
#adv .crd h2{letter-spacing:.04em;text-shadow:0 0 14px rgba(125,249,255,.35)}
#adv .crd button{border-radius:0;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);background:rgba(125,249,255,.07);border-color:rgba(125,249,255,.35);letter-spacing:.04em}
#adv .crd button:hover{background:rgba(125,249,255,.18);border-color:var(--hc)}
#adv .crd button.pr{background:linear-gradient(180deg,#38a8f0,#1a5f9e);border-color:var(--hc);box-shadow:inset 0 0 12px rgba(160,240,255,.35)}
#adv .pnl{background:radial-gradient(ellipse at 50% 50%,rgba(6,20,40,.55),rgba(1,4,12,.85))}
/* ---- round action buttons: reactor rings ---- */
#adv .rbtn{overflow:visible;letter-spacing:.06em;text-shadow:0 1px 2px rgba(0,0,0,.6);box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 22px rgba(125,249,255,.25),inset 0 0 14px rgba(255,255,255,.25)}
#adv .rbtn::before{content:'';position:absolute;inset:-7px;border-radius:50%;border:1.5px dashed rgba(200,250,255,.55);animation:tSpin 9s linear infinite;pointer-events:none}
#adv .rbtn::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(255,255,255,.25);pointer-events:none}
#adv .rbtn:active::before{animation-duration:1.2s;border-color:#fff}
#adv #aJoy .k{border:1.5px solid var(--hc2);background:radial-gradient(circle,rgba(125,249,255,.10),rgba(125,249,255,.02) 70%);box-shadow:0 0 18px rgba(125,249,255,.18)}
#adv #aJoy .k::before{content:'';position:absolute;inset:8px;border-radius:50%;border:1px dashed rgba(125,249,255,.35)}
#adv #aJoy .k i{box-shadow:0 0 14px var(--hc)}
/* ---- frame: corner brackets, scanlines, a slow sweep, a compass tape ---- */
#adv #aFrame{position:absolute;inset:0;pointer-events:none;z-index:2}
#adv #aFrame .fc{position:absolute;width:34px;height:34px;border:2px solid var(--hc);opacity:.55;filter:drop-shadow(0 0 4px var(--hc))}
#adv #aFrame .fc.a{left:calc(4px + env(safe-area-inset-left));top:calc(4px + env(safe-area-inset-top));border-right:0;border-bottom:0}
#adv #aFrame .fc.b{right:calc(4px + env(safe-area-inset-right));top:calc(4px + env(safe-area-inset-top));border-left:0;border-bottom:0}
#adv #aFrame .fc.c{left:calc(4px + env(safe-area-inset-left));bottom:calc(4px + env(safe-area-inset-bottom));border-right:0;border-top:0}
#adv #aFrame .fc.d{right:calc(4px + env(safe-area-inset-right));bottom:calc(4px + env(safe-area-inset-bottom));border-left:0;border-top:0}
#adv #aFrame .sl{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,6,14,.10) 0 1px,transparent 1px 3px)}
#adv #aFrame .sw{position:absolute;left:0;right:0;top:0;height:18vh;transform:translateY(-20vh);background:linear-gradient(180deg,transparent,rgba(125,249,255,.035),transparent);animation:tSweep 7s linear infinite;will-change:transform}
#adv #aFrame .vg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 62%,rgba(0,8,20,.35) 100%)}
#adv #aCmp{position:absolute;left:50%;top:calc(56px + env(safe-area-inset-top));width:340px;height:30px;margin-left:-170px;overflow:hidden;display:none;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent);mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)}
#adv #aCmp .st{position:absolute;left:0;top:0;height:100%;white-space:nowrap;will-change:transform}
#adv #aCmp .st i{position:absolute;bottom:0;width:1px;height:6px;background:var(--hc2)}#adv #aCmp .st i.m{height:10px;background:var(--hc)}
#adv #aCmp .st b{position:absolute;top:0;transform:translateX(-50%);font:700 11px var(--disp,system-ui);color:#d8fbff;letter-spacing:.08em;text-shadow:0 0 6px var(--hc)}#adv #aCmp .st b.n{color:var(--hw);text-shadow:0 0 6px var(--hw)}
#adv #aCmp::after{content:'';position:absolute;left:50%;bottom:0;margin-left:-5px;border:5px solid transparent;border-bottom-color:var(--hw);filter:drop-shadow(0 0 4px var(--hw))}
@media (min-width:1100px) and (hover:hover){#adv.onfoot #aCmp{display:block}#adv.onfoot #aLd{top:calc(94px + env(safe-area-inset-top))}}
#adv.cine #aFrame,#adv.photo #aFrame,#adv.intro #aFrame,#adv.helm #aFrame .fc{display:none}
#adv.cine #aCmp,#adv.photo #aCmp{display:none!important}
/* ---- boot-up: panels flicker on like a powered display ---- */
#adv #aSuit,#adv #aMis,#adv #aFly,#adv #aDrv{animation:tBoot .5s steps(6,end) both}
#adv #aToast{animation:tBoot .3s steps(4,end) both}
@keyframes tBoot{0%{opacity:0;filter:brightness(2.5)}30%{opacity:.8}45%{opacity:.25}70%{opacity:1;filter:brightness(1.6)}100%{opacity:1;filter:none}}
@keyframes tSpin{to{transform:rotate(360deg)}}
@keyframes tSweep{to{transform:translateY(120vh)}}
@media (prefers-reduced-motion:reduce){#adv .rbtn::before,#adv #aFrame .sw{animation:none}#adv *{animation-duration:.01s!important}}
@media (pointer:coarse),(max-width:760px){#adv{--cut:6px}#adv #aFrame .fc{width:22px;height:22px;opacity:.4}#adv .ab::before{width:7px;height:7px}#adv .rbtn::before{inset:-5px}}
/* ---- scan card and the full-screen discovery view it opens into ---- */
#adv .crd.dsc .fx,#adv .crd.dsc .vh{display:none}
#adv .crd.dsc .dv{position:relative}
#adv .pnl.full{padding:0;background:rgba(1,4,12,.94)}
#adv .pnl.full .crd.dsc{width:100vw;max-width:none;height:100vh;max-height:none;clip-path:none;border:0;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,1fr);gap:0;padding:0;animation:tGrow .45s cubic-bezier(.2,.9,.3,1) both}
#adv .pnl.full .crd.dsc .dv{height:100vh;background:radial-gradient(ellipse at 50% 45%,#122440,#02050d 72%);border-right:1px solid var(--hc2)}
#adv .pnl.full .crd.dsc .vw{width:100%;height:100%;margin:0;border-radius:0;background:none;cursor:grab}
#adv .pnl.full .crd.dsc .vw:active{cursor:grabbing}
#adv .pnl.full .crd.dsc .vh{display:block;position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));text-align:center;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.12em;color:rgba(200,240,255,.55);pointer-events:none}
#adv .pnl.full .crd.dsc .inf{overflow:auto;padding:calc(28px + env(safe-area-inset-top)) 28px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
#adv .pnl.full .crd.dsc .sm{display:none}
#adv .pnl.full .crd.dsc .fx{display:block;flex:1}
#adv .pnl.full .crd.dsc h2{font-size:clamp(22px,2.6vw,34px);margin:4px 0 6px}
#adv .crd.dsc .fx p{margin:0 0 4px;font-size:14px;line-height:1.5;color:#d8e6f5}
#adv .crd.dsc .fx dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0;font-size:14px}
#adv .crd.dsc .fx dt{color:#7df9ff;font:700 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;padding-top:2px}
#adv .crd.dsc .fx dd{margin:0;color:#e6eef8}
#adv .crd.dsc .fx h4.sh{border-bottom:1px solid rgba(125,249,255,.18);padding-bottom:4px;margin-top:18px}
@keyframes tGrow{from{opacity:.4;transform:scale(.92)}to{opacity:1;transform:none}}
@media (max-width:760px),(orientation:portrait){#adv .pnl.full .crd.dsc{grid-template-columns:1fr;grid-template-rows:46vh 1fr;overflow:hidden}#adv .pnl.full .crd.dsc .dv{height:46vh;border-right:0;border-bottom:1px solid var(--hc2)}#adv .pnl.full .crd.dsc .inf{padding:16px 16px calc(16px + env(safe-area-inset-bottom))}}
`;

export const FRAME_HTML = '<div id="aFrame"><div class="vg"></div><div class="sl"></div><div class="sw"></div><i class="fc a"></i><i class="fc b"></i><i class="fc c"></i><i class="fc d"></i></div><div id="aCmp"><div class="st"></div></div>';

// compass tape: 720 px per full turn, three turns laid out so any heading has tape on both sides
const PX = 2, LAB = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
export function buildCompass(root) {
  const st = root.querySelector('#aCmp .st'); if (!st || st.childElementCount) return; let h = '';
  for (let d = -360; d <= 720; d += 5) { const x = (d + 360) * PX, n = ((d % 360) + 360) % 360;
    h += `<i class="${n % 15 ? '' : 'm'}" style="left:${x}px"></i>`;
    if (n % 45 === 0) h += `<b class="${n ? '' : 'n'}" style="left:${x}px">${LAB[n]}</b>`; else if (n % 15 === 0) h += `<b style="left:${x}px;font-size:8.5px;opacity:.6;top:3px">${n}</b>`; }
  st.innerHTML = h; }
export function setCompass(root, headingDeg) {
  const st = root.querySelector('#aCmp .st'); if (!st) return; const w = 340, x = -((headingDeg % 360 + 360) % 360 + 360) * PX + w / 2;
  if (st._x !== Math.round(x)) { st._x = Math.round(x); st.style.transform = `translateX(${st._x}px)`; } }
