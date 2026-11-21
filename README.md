# makefun-csv-reader-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/BOTTL3WAT3R/makefun-csv-reader-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/BOTTL3WAT3R/makefun-csv-reader-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, make.fun's own CSV reader. `solve.js` exports `run(input)`, which returns csv-reader's exact answer `{columns, rows, errors}` for every input `{text, header}` — the same broken-row policy (stray CRs dropped, quote junk appended, unterminated quotes read again as unquoted, short and long rows recorded and reshaped to the first record's width) — read in one left-to-right pass that cuts fields out with `slice()` between structural characters instead of building them a character at a time. `main.ts` is the harness driver: it reads every case from `/input/cases.json`, answers each with `run`, and writes `/output/answers.json`.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=beyt0vmy&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
