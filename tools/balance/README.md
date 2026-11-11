# Moon Survival balance simulator

Plays thousands of fast Moon Survival missions with the same rules as `www/js/survival.js` and the numbers in
`www/js/survival_data.js`, on the real terrain (`terrain.json`, sampled from the game every 5 m).

```
node tools/balance/sim.mjs 300 all              # 300 missions each for new, average and good players
TWISTS=leak,scarce node tools/balance/sim.mjs 150 avg   # daily challenge twists, one life
```

It prints, per player type: how many reach the rescue and how fast, deaths and their causes, minutes spent with a
vital below 25% (tension), idle minutes (boredom) and when each objective is done. Change a number in
`survival_data.js`, run it again, compare.

Targets used for tuning (Nov 2026): a new player is rescued in 25–35 min and dies at most once in most runs;
an average player gets low on something at least once (tension) but rarely dies; every daily twist is winnable.
