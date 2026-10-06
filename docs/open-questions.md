# Open questions and assumptions

## Before implementation expands

| Question | Initial assumption | Resolve by |
| --- | --- | --- |
| Final title and visual identity | `pirate-crew-web` is a repository/working name | Before public marketing |
| Code/asset licensing | Free/noncommercial sharing intended; concrete licenses and third-party permissions to be recorded | Before external distribution or contributions |
| Browser support | Current desktop Chrome/Firefox/Safari candidates | B01 smoke checks |
| Baseline hardware | Ordinary laptop, precise model unspecified | B01/B10 measurement |
| Tile/sprite scale | One coherent pixel grid; exact dimensions unset | B03 visual prototype |
| UI framework | Plain DOM panels initially | First complex management screen |
| Crew cap | Twelve player pirates proposed | B10 profiling and readability |
| Balance values | No authoritative rates selected | B07–B11 playtests |
| Enemy strength and boss counterplay | Different behavior, not only stats | B06/B11 encounter tests |
| First voyage length | Short enough to finish in one sitting | B10 observation |

## Scope decisions already made for the baseline

Single player; desktop first; real time with pause; port-only building; checkpoint saves rather than arbitrary combat saves; standard checkpoint recovery after captain death; no backend; original or suitably licensed assets, personal-use remake intent, free/noncommercial sharing with attribution. Ship capture is implemented in v0.2; permadeath remains deferred. Exact original build/version for frame-by-frame and formula fidelity remains unverified.

## Risks to watch

Navigation changes during destruction; tasks fighting explicit orders; repetitive battles; excessive management overhead; save corruption; late-game entity growth; asset production cost. These risks have corresponding scenarios in the specs and validation plan.

## Future decisions

Tablet controls, cloud saves, monetization, multiplayer, additional campaign regions, and closer reference-game fidelity require new evidence and scope review. Do not treat these as implicit MVP requirements.

## Review follow-up

Resolve pinned Phaser version and shutdown/disposal APIs, Web Locks browser support, baseline hardware, and GPU/audio memory accounting in B01. Prototype validates 20 Hz input feel, operation-budget queue latency, and provisional capacities before scope growth. Memory/GPU budgets and no-leak claims require actual runtime evidence.
