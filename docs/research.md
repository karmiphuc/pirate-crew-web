# Pixel Piracy research baseline

Research captured 2026-10-05 from store pages, developer announcements, community documentation, and historical reviews. This is desk research: the current build was not played or benchmarked. Community documentation can reflect older versions. Do not copy exact formulas without checking the chosen reference build.

## History and evidence

Pixel Piracy began development in 2013 and entered early access that year. Its original PC release was July 31, 2014; an Enhanced Edition followed April 23, 2015, which is the date now shown on Steam. Console versions followed in February 2016. Originally associated with Quadro Delta and Re-Logic, the current Steam listing identifies Vitali Kirpu as developer and publisher. Sources: [history](https://en.wikipedia.org/wiki/Pixel_Piracy), [Steam](https://store.steampowered.com/app/264140/Pixel_Piracy/).

PC patching resumed in 2023 after a lengthy hiatus. Developer announcements describe interaction icons and save-related fixes. A November 2023 post reports burnout and uncertainty about further updates. Pixel Piracy Online is described separately in subsequent announcements. Announced plans are not evidence of shipped functionality. Source: [developer announcements](https://store.steampowered.com/oldnews/?appgroupname=Pixel+Piracy&appids=264140&feed=steam_community_announcements).

At the initial check Steam displayed Mixed English reviews, 62% positive across 4,181 reviews. This is a cumulative, time-sensitive snapshot, not a current-build quality assessment.

## Systems worth studying

| Observed system | Reference | Rebuild implication (our interpretation) |
| --- | --- | --- |
| Ship parts purchased or recovered through plunder | [Ship parts](https://pixelpiracy.fandom.com/wiki/Ship_Parts) | Tie loot to construction options |
| Crew health, hunger, morale, equipment, and stats | [Getting started](https://pixelpiracy.fandom.com/wiki/Getting_Started) | Expose needs and operating costs before departure |
| Skills involving cooking, fishing, sailing, and combat | [Skills](https://pixelpiracy.fandom.com/wiki/Skills) | Make specializations change actual behavior |
| Crew wages, supplies, ship building, and capture | [2014 review](https://gamersnexus.net/games/1484-pixel-piracy-review-parlay-please) | Let preparation influence expedition outcomes |
| Campaign targeting four notorious pirates | [2016 Xbox review](https://www.bigredbarrel.com/2016/02/29/review-pixel-piracy/) | Use named rivals as understandable progression goals |

## Historical criticism

The Xbox review reports failed movement and boarding, unexplained menus, incomplete onboarding, and repetitive encounters. The PC critique reports weak tactical differentiation, rigid job assignments, and deteriorating performance as objects and crews accumulate. Sources: [Big Red Barrel](https://www.bigredbarrel.com/2016/02/29/review-pixel-piracy/), [The Gemsbok](https://thegemsbok.com/art-reviews-and-articles/mid-week-mission-pixel-piracy-quadro-delta/).

These are older observations, not verified claims that each problem remains in the current PC build. They identify risks to test in our implementation.

## Proposed design response

Preserve the connected ship/crew/expedition fantasy. Make ship layout functional, commands observable, routine work automatic, and encounters tactically distinct. Use an abstract travel map; full sailing physics is unnecessary to validate the core loop.

## Remaining research

Before pursuing close mechanical fidelity, record the version played and inspect current recruitment, travel timing, cannon/boarding transitions, difficulty modes, and capture behavior. Capture original observations in a dated addendum. The user clarified personal-use remake intent with free/noncommercial sharing and attribution. Mechanical fidelity can be checked against a named reference build; the robustness-first MVP is not yet a complete feature-for-feature remake.

## Fidelity follow-up, 2026-10-06

Rechecked the Steam description and community documentation on [skills](https://pixelpiracy.fandom.com/wiki/Skills), [cooking](https://pixelpiracy.fandom.com/wiki/Cooking), [ship repair](https://pixelpiracy.fandom.com/wiki/Ship_Repair), and [plunder](https://pixelpiracy.fandom.com/wiki/Plunder). The pages describe taught crew skills, food preparation, repairs to damaged hull blocks, and a distinct post-battle plunder action. Version 0.2 implements those system categories plus capture and four authored pirate lords, using original content and provisional balance. Repairs are aggregate hull repairs at present; block destruction remains a gap. See the [fidelity tracker](fidelity.md). No current Steam build was executed, and community wiki details are not treated as verified current-build formulas.
