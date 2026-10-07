# Documentation index

Initial baseline: 2026-10-05. Design documents describe the target; the implementation status records which behaviors and checks are actually delivered. No unfamiliar-player playtest has been performed.

| Document | Purpose |
| --- | --- |
| [Measured browser run](validation-results.json) | Scoped timing, heap, listener, and lifecycle evidence |
| [Implementation status](implementation-status.md) | Delivered behavior, departures, verification, and remaining evidence |
| [GitHub Pages](github-pages.md) | Static SPA deployment, production hosting checks, and storage limits |
| [Attribution](attribution.md) | Personal-use/free-noncommercial intent, credits, and material permissions |
| [Character art and combat poses](design/painted-pixel-crew.md) | Original generated source, actual pixel conversion, independent combat poses and asset lifetime |
| [Crew silhouette redraw](design/crew-silhouettes.md) | Rejected baseline, original redesign, portrait scaling and facing corrections |
| [Compact crew and equipment](design/kairosoft-and-equipment.md) | Kairosoft reference observations, original art, independent item layers and ownership |
| [Fidelity tracker](fidelity.md) | Reference mechanics, delivered coverage, and remaining differences |
| [Research](research.md) | Reference-game findings, sources, and evidence limits |
| [Game design](game-design.md) | Audience, pillars, loop, presentation, and combat direction |
| [MVP](mvp.md) | First playable scope and release gates |
| [Architecture](architecture.md) | Stack, module boundaries, simulation, and persistence |
| [Pre-implementation review](pre-implementation-review.md) | Gaps found, corrections, and remaining runtime evidence |
| [Performance and lifecycle](specs/performance-and-lifecycle.md) | Ownership, disposal, GC, capacity, scheduling, and rendering budgets |
| [Ship and navigation](specs/ship-and-navigation.md) | Editor rules, topology, movement, and boarding |
| [Crew and commands](specs/crew-and-commands.md) | Needs, jobs, priorities, and player feedback |
| [Combat](specs/combat.md) | Damage, orders, tactical roles, and encounter outcomes |
| [World and economy](specs/world-and-economy.md) | Generation, travel, supplies, shops, and progression |
| [Persistence](specs/persistence.md) | Save format, checkpoints, recovery, and browser lifecycle |
| [UX and assets](specs/ux-and-assets.md) | Screens, controls, onboarding, and asset requirements |
| [Validation](validation.md) | Automated scenarios, playtests, and performance targets |
| [Roadmap](roadmap.md) | Dependency-ordered work packages and completion criteria |
| [Initial decision](decisions/0001-browser-first.md) | Browser-first direction and tradeoffs |
| [Performance decision](decisions/0002-performance-and-lifetimes.md) | Explicit lifetime and bounded-work requirements |
| [Open questions](open-questions.md) | Unresolved choices and when to resolve them |

## Reading conventions

**Research** means a sourced account of the reference game. **Proposed** means our design. **Provisional** means a value or choice that requires prototype evidence. Requirements in system specs describe the intended MVP, not behavior already implemented.

Changes that affect several systems should update their contracts and acceptance scenarios before implementation. New consequential architecture decisions receive a numbered decision record.
