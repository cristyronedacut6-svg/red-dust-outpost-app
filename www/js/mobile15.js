/* Red Dust Outpost · v15c (Nov 2026) · a minimal story HUD for phones held sideways.
   Goal: the middle of the screen belongs to the game. Everything sits on the edges, small:
   - top-left: one compact status card (wave, money, a big health bar, three mini bars, a one-line objective)
   - top-centre: ONE message slot. Most urgent first: radiation > damage/tip > Mission Control > nothing.
     Log lines and fact cards are not shown on phones (they are still in the pause menu log).
   - top-right: small map with shop / menu
   - bottom: small Choose / Build in the middle, small action buttons bottom-right, abilities bottom-left */
(function () {
  'use strict';
  const $ = q => document.querySelector(q);
  const MQ = matchMedia('(min-aspect-ratio: 1/1) and (max-height: 540px)');
  const M = 'html body.u-mob #stage';
  const css = `
/* ---- status card, top-left ---- */
${M} #top{width:186px!important;gap:3px!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;top:calc(6px + var(--st,0px))!important;left:calc(6px + var(--sl,0px))!important;
  background:rgba(12,10,28,.62)!important;border-radius:10px!important;padding:5px 6px 6px!important;box-sizing:border-box!important}
${M} #top > .row:first-child{grid-column:1/-1!important;flex-wrap:wrap!important;gap:0!important;row-gap:2px!important;overflow:visible!important}
${M} #top > .row:first-child > .chip{height:19px!important;font-size:10.5px!important;padding:0 4px!important;border-width:1px!important;gap:2px!important;background:rgba(0,0,0,.35)!important}
${M} #top > .row:first-child > .chip .ic,${M} #top > .row:first-child > .chip svg{width:11px!important;height:11px!important}
${M} #top #tmp,${M} #top #wave .wn,${M} #top #wave .daybar,${M} #top #wave svg{display:none!important}
${M} #top #misb{margin-right:3px!important}
${M} #top #cr{border-left-width:1px!important;border-radius:6px 0 0 6px!important}
${M} #top #r-hp{grid-column:1/-1!important}
${M} #top #r-hp .mb{height:9px!important;border-width:1px!important}
${M} #top #r-hp .ri{font-size:13px!important;width:14px!important;margin-right:0!important}
${M} #top #r-hp b{font-size:10px!important;min-width:18px!important}
${M} #top #r-pw,${M} #top #r-o2,${M} #top #r-fd,${M} #top #r-rad{grid-column:auto!important;width:auto!important;margin:0!important;grid-template-columns:auto 1fr!important;gap:2px!important}
${M} #top #r-pw b,${M} #top #r-o2 b,${M} #top #r-fd b,${M} #top #r-rad b{display:none!important}
${M} #top #r-pw .mb,${M} #top #r-o2 .mb,${M} #top #r-fd .mb,${M} #top #r-rad .mb{height:6px!important;border-width:1px!important;border-radius:3px!important}
${M} #top #r-fd .mb::after{display:none}
${M} #top .chip.res .ri{font-size:10px!important;width:11px!important}
${M} #top .chip.res .ri .ic,${M} #top .chip.res .ri svg{width:10px!important;height:10px!important}
${M} #top #r-fd{order:4} ${M} #top #r-pw{order:4} ${M} #top #r-o2{order:4}
${M} #top #r-rad.hot{order:5;grid-column:1/-1!important}
${M} #top #r-mo{display:none!important}
${M} #top #u-obj{order:6;grid-column:1/-1!important;min-height:0!important;font-size:10px!important;padding:2px 6px!important;border-radius:6px!important;line-height:1.2!important;
  white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:block!important}
${M} #top #u-obj *{font-size:10px!important;display:inline!important;letter-spacing:0!important}
${M} #top #u-obj > :first-child{display:none!important}
${M} #top #misp{display:none!important}
/* ---- one message slot, top-centre ---- */
${M} #top #feed{position:fixed!important;left:50%!important;transform:translateX(-50%)!important;top:calc(6px + var(--st,0px))!important;
  width:min(330px,calc(100vw - 186px - 22vw - 60px))!important;font-size:11px!important;line-height:1.25!important;display:flex!important;flex-direction:column!important;gap:4px!important}
${M} #top #feed #msg{display:none!important}
${M} #top #feed .ban{padding:4px 8px!important;font-size:11px!important;border-radius:8px!important;max-height:58px!important;overflow:hidden!important}
${M} #top #feed .ban .lab{font-size:9px!important}
${M} #top #feed .ban button{transform:scale(.8)!important}
${M} #top #feed .ban .banpor{width:24px!important;height:24px!important;margin-right:6px!important}
${M} #top #feed.u-busy #ban{display:none!important}
${M} #feed #radw,${M} #feed #u-adv{order:-1;margin:0!important}
${M} #radw{font-size:11px!important;padding:3px 8px!important;border-radius:8px!important;box-shadow:0 0 10px rgba(215,255,58,.4)!important;text-align:center!important}
${M} #radw small{font-size:9.5px!important}
${M} #u-adv{font-size:10.5px!important;padding:3px 5px 3px 7px!important;gap:5px!important;border-width:1px!important;max-width:none!important}
${M} #u-adv .at small{font-size:9.5px!important}
${M} #u-adv .ai .ic{width:16px!important;height:16px!important}
${M} #u-adv button{padding:3px 6px!important;font-size:10px!important}
${M} #u-adv button img{width:14px!important;height:14px!important}
${M} #rfc,${M} #rfc.on{display:none!important}
${M} #wb{transform:scale(.7)!important}
html body.u-mob #wid{transform:translateX(-50%) scale(.68)!important;transform-origin:50% 0!important;top:calc(var(--st,0px) + 22%)!important}
/* ---- map, top-right ---- */
${M} #tr{width:min(150px,20vw)!important;top:calc(6px + var(--st,0px))!important;right:calc(6px + var(--sr,0px))!important;gap:3px!important}
${M} #tr #mm{border-width:1px!important;border-radius:8px!important;opacity:.85!important}
${M} #tr > .r:first-child{top:4px!important;right:4px!important;gap:3px!important}
${M} #tr #bShop,${M} #tr #u-more,${M} #tr #rkb{width:24px!important;height:24px!important;font-size:0!important;border-radius:6px!important;overflow:hidden!important}
${M} #tr #bShop *{font-size:0!important}
${M} #tr #bShop svg,${M} #tr #bShop img,${M} #tr #rkb svg{width:14px!important;height:14px!important}
${M} #tr #u-more{font-size:14px!important}
${M} #tr #rkb *{font-size:10px!important}
${M} #tr #nextw{font-size:10px!important;padding:3px 6px!important}
/* ---- bottom: abilities (left), Choose/Build (centre), actions (right) ---- */
${M} #party{top:auto!important;bottom:calc(8px + var(--sb,0px))!important;left:calc(8px + var(--sl,0px))!important;flex-direction:row!important;gap:5px!important}
${M} #party button{width:34px!important;height:34px!important;font-size:13px!important}
${M} #dock{bottom:calc(6px + var(--sb,0px))!important;gap:6px!important}
${M} #dock #bsel,${M} #dock #bh{width:50px!important;height:50px!important;font-size:10px!important;border-radius:10px!important}
${M} #dock #bsel .g4{grid-template-columns:repeat(2,9px)!important;gap:2px!important;margin-bottom:2px!important}
${M} #dock #bsel .g4 i{width:9px!important;height:9px!important;border-width:1.5px!important}
${M} #dock #bh img{width:22px!important;height:22px!important}
${M} #dock #bh kbd,${M} #dock #bh small{display:none!important}
${M} #act{transform:scale(.56)!important;transform-origin:100% 100%!important;right:calc(6px + var(--sr,0px))!important;bottom:calc(6px + var(--sb,0px))!important}
${M} #u-entB{bottom:calc(var(--sb,0px) + 62px)!important;padding:4px 9px!important;font-size:11px!important;gap:5px!important}
${M} #u-entB small{display:none!important}
${M} #u-place,${M} #u-pur{bottom:calc(var(--sb,0px) + 92px)!important;font-size:10.5px!important;padding:3px 8px!important}
${M} #u-pur .pp b .ic{width:15px!important;height:15px!important} ${M} #u-pur img{width:18px!important;height:18px!important} ${M} #u-pur .pp small{font-size:8.5px!important} ${M} #u-pur .pt{display:none!important}
${M} #radv{background:radial-gradient(ellipse at center,transparent 60%,rgba(190,255,40,.28) 100%)!important}
${M} #insp{max-height:calc(100% - 90px)!important;font-size:11.5px!important}
`;
  const st = document.createElement('style'); st.id = 'mob15css'; st.textContent = css;
  const put = () => document.body.appendChild(st); if (document.body) put(); addEventListener('load', put);

  // move the radiation warning and the tip box into the message slot on phones, back into the status block otherwise
  function home(mob) { const feed = $('#feed'), top = $('#top'); if (!feed || !top) return;
    ['#radw', '#u-adv'].forEach(q => { const e = $(q); if (!e) return; const want = mob ? feed : top; if (e.parentNode !== want) mob ? feed.insertBefore(e, feed.firstChild) : top.appendChild(e); }); }
  function tick() { const mob = MQ.matches; document.body.classList.toggle('u-mob', mob); home(mob);
    // one message at a time: when the radiation warning or a tip/damage box is up, hide the Mission Control banner
    const feed = $('#feed'); if (!feed) return; const vis = q => { const e = $(q); return e && e.parentNode === feed && e.style.display !== 'none' && getComputedStyle(e).display !== 'none'; };
    feed.classList.toggle('u-busy', mob && (vis('#radw') || vis('#u-adv')));
    if (mob && vis('#radw') && vis('#u-adv')) { const a = $('#u-adv'); if (a && !a.classList.contains('hurt')) a.style.display = 'none'; } }
  setInterval(tick, 200); MQ.addEventListener ? MQ.addEventListener('change', tick) : MQ.addListener(tick);
})();
