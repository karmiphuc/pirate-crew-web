# Persistence and browser lifecycle

## Save envelope

Proposed fields: schemaVersion, buildVersion, contentVersion, generatorVersion, campaignId, checkpointId, savedAt, tick, rngState, phase, world, ships, pirates, inventory, activeRoute, and encounterOutcomes. `savedAt` is metadata only; elapsed real time never changes gameplay.

Include enough state to resume the supported checkpoint. Do not serialize textures, DOM nodes, Phaser objects, cached paths, or graph instances. Rebuild derived structures and validate references on load.

## Checkpoint policy

MVP checkpoints occur at safe boundaries: departure, before encounter setup, after atomic resolution/loot, arrival, and port transactions. No arbitrary mid-combat save is required initially. UI labels manual save as a checkpoint and explains possible lost encounter progress.

Save the new snapshot and slot metadata in one IndexedDB transaction; retain the previous valid checkpoint. Do not mark the checkpoint current until the transaction succeeds. Show saving/saved/failed feedback and allow export after failure. Never overwrite a recoverable living checkpoint solely because captain death was processed.

## Import and compatibility

Validate envelope version, maximum payload size, ranges, content IDs, uniqueness, and references before replacing state. Reject unsupported newer schemas with an explanation. Older supported schemas migrate through explicit version steps. Invalid imports preserve existing saves.

Provide export/import of a versioned JSON file. Browser storage can be cleared or evicted; export offers a user-controlled backup. Cloud sync is deferred.

## Lifecycle

On visibility loss: pause immediately and attempt a safe checkpoint if available. Do not rely on unload events or an asynchronous save completing when a tab closes. Resume with a paused overlay; require player input to continue. Cap foreground frame-stall catch-up.

Reference: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Acceptance scenarios

- Round-trip preserves exact authoritative checkpoint state and RNG state.
- Simulated failed writes retain the previous valid checkpoint.
- Malformed or oversized imports cannot replace an existing campaign.
- Hidden-tab time does not advance any simulation system.
- Post-loot reload does not award loot again.
- Death recovery restores the pre-encounter state without duplicating inventory.

## Write ordering and transition barriers

One application-owned writer serializes saves. Each snapshot has campaign generation and monotonic revision; completion may update UI only for that generation/revision. Prepare an immutable supported-boundary snapshot before opening a transaction. Never clone/serialize the campaign every frame. Coalesce ordinary pending saves into one latest snapshot; required pre-encounter/transition saves are barriers and cannot be dropped.

Freeze inputs that mutate the boundary while capturing it. Queue all required object-store writes and metadata changes within one transaction; await its completion, not only a request's success. Perform validation, unrelated asynchronous preparation, and migrations before opening it; do not await network/timers inside an active transaction. IndexedDB transactions have active/inactive windows. Reference: [IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).

Encounter entry in standard recovery mode requires a successfully committed living pre-encounter checkpoint. If storage fails, remain at the boundary and offer retry/export; do not silently enter combat without the promised recovery. Retain current plus previous checkpoint and the separately pinned pre-encounter checkpoint while it is needed. Prune obsolete records in a bounded transaction. Transaction completion is not a guarantee against OS/storage destruction; export remains useful.

## Writable-tab ownership

Use an origin-scoped Web Lock for the save database writer, and record the chosen supported-browser behavior in B01. Other tabs show a read-only notice rather than running a second writable campaign. A tab owns the lock across play; release on application disposal. If the required locking API is unavailable, disable persistent play with a clear compatibility message rather than using an unsafe localStorage lease. Use HTTPS (or a supported trustworthy local development origin) and verify API support before establishing the browser matrix. Reference: [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). Acquire without stealing; only an explicit user action attempts acquisition from a read-only tab, then reloads fresh persisted state before enabling mutation.

Campaign replacement waits for the writer to settle and invalidates outstanding callbacks. The persisted pointer changes only after validated replacement commits. Do not let late writes from the prior campaign update current metadata.

## Additional acceptance scenarios

- Rapid saves cannot leave an older revision current.
- Loading/new game while a write completes does not apply old campaign feedback or data.
- Two tabs cannot concurrently mutate the same save database.
- Quota/unavailable storage blocks unsafe encounter entry while preserving play at the boundary.
- Snapshot size and collection limits are checked before import replacement.
- Closing/restarting panels and exporting files release listeners and object URLs.

## Version 0.2 compatibility

Schema 2 validates meals, ship dirt/cannon cooldown, learned skills, assigned duty, owned weapon locker, equipped weapon, and armor. Schema 1 migrates through a bounded copy, retaining crew/map/hull/gold and introducing six starter meals and guard duty; migration never mutates the imported object. Unsupported schemas are rejected. Current/previous slots and the database name remain unchanged. Work claims, progress, paths, and audio state are runtime resources and are rebuilt rather than serialized. Combat and `aftermath` are unsafe save phases; successful prize handling returns to a safe checkpoint.

## Version 0.3 compatibility

Schema 3 adds bounded unique trait arrays and per-tile wear. Schema 1 first takes the existing schema-2 migration; schema 2 then copies crew into schema 3 with neutral traits, preserving the map, RNG, inventory, hull health, and loadouts. Migration never mutates the caller. Missing legacy wear normalizes to zero; supplied wear must be an integer in 0..100 and ladders cannot carry wear. Unknown, duplicate, excess, or opposing food traits reject the import before replacement. Supported safe phases, database name, two-slot backup, and writer ownership remain unchanged. Runtime job targets/claims/progress are cleared when making checkpoints.

## Version 0.4 compatibility

Schema 4 changes damage 100 from cosmetic maximum wear to a destroyed support. Schema 3 imports migrate 100 to 99 so old checkpoints keep their valid floors. The existing v1→v2→v3 steps still run first. Validation checks the complete design blueprint, then the surviving navigation graph and actual supported crew positions. Disabled stations can persist, but unsupported or disconnected crew cannot replace a safe save. Falling and intermediate gap crossing are not safe checkpoint positions.

Port repair is a recovery transaction: its pre-repair rollback snapshot may be temporarily unsafe, but is never written as a checkpoint. Failed storage restores both the prior state and transient fall origins; successful repair must pass normal supported-position validation before commit. Other purchases continue to require a safe prior checkpoint.

Legacy diagonal ladder-corner samples snap to the already-validated rounded standing cell during v3 migration. Normal supported deck/ladder fractions are retained. New movement paths reach the current grid waypoint before changing axes, and new checkpoints reject unsupported corner samples.
