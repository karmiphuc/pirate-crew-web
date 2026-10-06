import Phaser from "phaser";
import { Soundscape } from "./app/sound";
import "./style.css";
import {
  Campaign,
  DUTIES,
  DUTY_NAMES,
  Duty,
  WEAPONS,
  Weapon,
  createCampaign,
  LIMITS,
  notify,
  Tile,
  Station,
  tileNode,
} from "./sim/model";
import { Simulation } from "./sim/engine";
import {
  acquireWriter,
  checkpoint,
  openDatabase,
  SaveWriter,
  validateSave,
} from "./storage/save";
import { Lifetime, Samples } from "./app/lifetime";
import { SeaScene, ViewHost } from "./game/scene";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="masthead"><a class="brand" href="#" aria-label="Pixel Privateer home"><span class="brand-mark">☠</span><span><strong>PIXEL PRIVATEER<span class="beta">02</span></strong><small>A PIRATE’S LIFE · UNOFFICIAL BROWSER REMAKE</small></span></a><nav><button data-action="help" class="text-button">Captain’s guide</button><button data-action="settings" class="text-button">⚙ Settings</button><button data-action="save" class="save-button">↓ Save voyage</button></nav></header>
<main>
 <section class="supplies" aria-label="Ship supplies"><div class="location"><span class="live-dot"></span><span id="location">Saltwater Harbour</span><small id="phase">IN PORT</small></div><div class="resources"><span><i class="coin">●</i><b id="gold">420</b> <small>GOLD</small></span><span><i>▣</i><b id="food">18</b> <small>FOOD</small></span><span><i>●</i><b id="ammo">12</b> <small>AMMO</small></span><span><i>✚</i><b id="medicine">5</b> <small>MEDICINE</small></span><span><i>▰</i><b id="parts">12</b> <small>TIMBER</small></span></div></section>
 <section class="voyage" aria-label="Side-view pirate game"><div class="scene-top"><div><span class="eyebrow">THE WAYWARD GULL</span><h1 id="scene-title">A small ship. A grand adventure.</h1><p id="objective">Stock the hold, gather your crew, and see what lies beyond the harbour.</p></div><button data-action="pause" id="pause" class="pause-button">Ⅱ Pause <kbd>SPACE</kbd></button></div><div id="game"></div><div id="scene-banner" class="scene-banner" hidden></div><div id="build-tools" class="build-tools" hidden><span>SHIPWRIGHT <small>Click grid to place / remove</small></span><button data-action="hull" class="active">Hull</button><button data-action="ladder">Ladder</button><button data-action="station-food">Move galley</button><button data-action="station-cannon">Move cannon</button><button data-action="station-medical">Move clinic</button><button data-action="apply-build" class="primary">Apply refit</button><button data-action="cancel-build">Cancel</button></div><div class="sea-compass" aria-hidden="true">N<br>✧</div><div class="scene-bottom"><span id="hint">Click a pirate to select · Click a deck to move · Space to pause</span><span id="ship-readout"></span><span id="save-state">Preparing logbook…</span></div></section>
 <section class="actionbar" aria-label="Crew actions"><div class="command-group"><button data-action="select-all">♟ Select crew</button><button data-action="board" id="board">⚔ Board / go ashore</button><button data-action="cannon" id="cannon">● Fire cannon</button><button data-action="retreat" id="retreat">↶ Retreat</button><button data-action="heal">✚ Treat wounds</button><button data-action="collect" id="collect" hidden>✦ Collect chest</button><button data-action="plunder" id="plunder" hidden>✦ Plunder / take spoils</button><button data-action="capture" id="capture" hidden>⚑ Capture ship</button><button data-action="escape" id="escape" hidden>↗ Break off</button></div><div class="command-group"><button data-action="build" id="build">▦ Build ship</button><button data-action="map" class="primary" id="chart">◇ Chart a course <span>→</span></button></div></section>
 <section class="below-deck"><div class="crew-panel"><div class="panel-heading"><h2>Your crew <span id="crew-count">3 / 12</span></h2><button data-action="recruit" id="recruit">+ Recruit <small>70 gold</small></button></div><div id="crew" class="crew-list"></div><div class="port-tools"><button data-action="crew-settings">☷ Duties & equipment</button><button data-action="shop">▣ Harbour market</button><button data-action="rest">☾ Tavern & repairs <small>25 gold</small></button><span id="crew-summary">Three souls, one horizon.</span></div></div><aside class="log-panel"><div class="panel-heading"><h2>Captain’s log</h2><span id="day">DAY 01</span></div><div id="journal" aria-live="polite"></div></aside></section>
 <footer><span>Built for the love of pirate adventures.</span><button data-action="credits">Pixel Piracy tribute · Credits & attribution ↗</button><span id="diagnostics"></span></footer>
</main><div id="toast" role="status" hidden></div><div id="modal" class="modal-backdrop" hidden></div>`;
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const el = (id: string) => document.getElementById(id)!;
function motionPreference() {
  try {
    return localStorage.getItem("privateer-motion") === "reduced";
  } catch {
    return false;
  }
}
class Application implements ViewHost {
  sim = new Simulation(createCampaign());
  private scope = new Lifetime();
  private sound = new Soundscape();
  private soundNotice = 0;
  private writer: SaveWriter | null = null;
  private releaseLock: (() => void) | null = null;
  private game: Phaser.Game | null = null;
  private sea: SeaScene | null = null;
  private selection: number[] = [3];
  private draftTiles: Tile[] | null = null;
  private brush: "hull" | "ladder" | Station["kind"] = "hull";
  private draftStationList: Station[] | null = null;
  paused = false;
  private busy = false;
  private storageReady = false;
  private storageError = "";
  private graphicsLost = false;
  private modalKind = "";
  private modalWasPaused = false;
  private accumulator = 0;
  private uiTime = 0;
  private uiRevision = -1;
  private closed = false;
  private generation = 0;
  private bannerPhase = "";
  private toastTimer: number | undefined;
  private frames = new Samples();
  private ticks = new Samples();
  private stalls = 0;
  private lockState = "not-ready";
  private lowMotion = motionPreference();
  private modalFocus: HTMLElement | null = null;
  constructor() {
    try {
      this.sound.setEnabled(localStorage.getItem("privateer-sound") !== "off");
    } catch {
      /* Session preference remains available. */
    }
    this.scope.listen(app, "click", (e) => {
      void this.sound.unlock();
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-action]",
      );
      if (target) void this.action(target.dataset.action!, target.dataset);
    });
    this.scope.listen(document, "keydown", (e) => {
      const event = e as KeyboardEvent;
      if (!event.repeat) void this.sound.unlock();
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.code === "Tab" && this.modalKind) {
        const focusable = el("modal").querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,a,summary",
        );
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!this.modalKind && !this.draftTiles) this.togglePause();
      }
      if (
        !this.modalKind &&
        !this.draftTiles &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const shortcut = (
          {
            KeyB: "board",
            KeyR: "retreat",
            KeyC: "cannon",
            KeyQ: "select-all",
            KeyI: "crew-settings",
            KeyM: "map",
            KeyF: "collect",
            KeyP: "plunder",
          } as Record<string, string>
        )[event.code];
        if (shortcut) {
          event.preventDefault();
          void this.action(shortcut);
        }
      }
      if (event.code === "Escape") {
        if (this.modalKind) this.closeModal();
        else if (this.draftTiles) this.cancelBuild();
        else this.togglePause();
      }
    });
    this.scope.listen(document, "visibilitychange", () => {
      if (document.hidden) {
        this.sound.suspend();
        this.paused = true;
        this.accumulator = 0;
        this.renderUI(true);
      }
    });
    this.scope.listen(window, "pagehide", (e) => {
      if (!(e as PageTransitionEvent).persisted) void this.dispose();
    });
    this.scope.listen(el("modal"), "change", (e) => {
      const input = e.target as HTMLInputElement;
      if (input.id === "import-file" && input.files?.[0])
        void this.importFile(input.files[0]);
    });
  }
  async start() {
    this.sea = new SeaScene(this);
    this.game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: "game",
      width: 1280,
      height: 540,
      backgroundColor: "#315f66",
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [this.sea],
      audio: { noAudio: true },
      fps: { target: 60 },
    });
    try {
      this.releaseLock = await acquireWriter();
      if (this.closed) {
        this.releaseLock();
        this.releaseLock = null;
        return;
      }
      this.lockState = "initializing";
      this.writer = new SaveWriter(await openDatabase());
      if (this.closed) {
        await this.writer.close();
        this.releaseLock?.();
        this.releaseLock = null;
        return;
      }
      try {
        const saved = await this.writer.load();
        this.replace(saved);
        this.showToast("Your voyage has been restored.");
        this.paused = true;
      } catch (error) {
        if ((error as Error).message === "No checkpoint in this slot yet.")
          await this.writer.save(checkpoint(this.state()));
        else {
          try {
            this.replace(await this.writer.load("previous"));
            this.showToast("Recovered the previous valid checkpoint.");
          } catch {
            this.showToast(
              "Checkpoint unreadable. Import a backup or explicitly start a new voyage in Settings.",
            );
          }
          this.paused = true;
        }
      }
      if (this.closed) return;
      this.storageReady = true;
      this.lockState = "owned";
      el("save-state").textContent = "✓ Logbook ready";
    } catch (error) {
      if (this.closed) return;
      this.storageError = (error as Error).message;
      this.lockState = this.releaseLock ? "storage-error" : "read-only";
      this.paused = true;
      el("save-state").textContent = "Local saves unavailable";
      this.showToast(this.storageError);
    }
    this.renderUI(true);
  }
  state() {
    return this.sim.state;
  }
  selected() {
    return this.selection;
  }
  draft() {
    return this.draftTiles;
  }
  draftStations() {
    return this.draftStationList;
  }
  reducedMotion() {
    return this.lowMotion;
  }
  update(delta: number) {
    if (this.closed) return 1;
    this.frames.add(delta);
    if (delta > 100) this.stalls++;
    if (!this.paused && !this.busy && !this.graphicsLost && !document.hidden) {
      this.accumulator = Math.min(100, this.accumulator + delta);
      let count = 0;
      while (this.accumulator >= 50 && count++ < 2) {
        const before = performance.now();
        this.sim.tick();
        this.ticks.add(performance.now() - before);
        this.accumulator -= 50;
      }
    } else this.accumulator = 0;
    this.uiTime += delta;
    if (this.uiTime >= 100) {
      this.uiTime = 0;
      this.renderUI();
    }
    return this.paused || this.busy ? 1 : this.accumulator / 50;
  }
  click(
    shipId: number,
    x: number,
    y: number,
    id: number | null,
    queue: boolean,
  ) {
    if (this.busy || this.modalKind || !this.storageReady) return;
    if (this.draftTiles) {
      if (shipId !== 1 || x < 0 || x >= 32 || y < 0 || y >= 10) return;
      if (this.brush !== "hull" && this.brush !== "ladder") {
        this.draftStationList = this.draftStationList!.map((t) =>
          t.kind === this.brush ? { ...t, x, y } : { ...t },
        );
        return;
      }
      if (y < 1) return;
      const existing = this.draftTiles.findIndex((t) => t.x === x && t.y === y);
      const next = this.draftTiles.map((t) => ({ ...t }));
      if (existing >= 0) next.splice(existing, 1);
      else next.push({ x, y, kind: this.brush });
      this.draftTiles = next;
      return;
    }
    if (id !== null) {
      const actor = this.state().pirates.find((p) => p.id === id)!;
      if (actor.side === "ally") {
        if (queue) {
          if (this.selection.includes(id))
            this.selection = this.selection.filter((i) => i !== id);
          else this.selection.push(id);
        } else this.selection = [id];
        this.renderUI(true);
      } else if (
        this.sim.queue(
          this.selection,
          { action: "attack", targetId: id },
          queue,
        )
      ) {
        this.showToast(
          "Attack order queued. Board first if your crew is on another ship.",
        );
      }
      return;
    }
    if (
      this.sim.queue(
        this.selection,
        { action: "move", shipId, node: tileNode(x, y) },
        queue,
      )
    )
      this.showToast(
        this.paused
          ? "Move order queued. Resume to execute."
          : "Crew moving to position.",
      );
  }
  contextLost() {
    this.graphicsLost = true;
    this.paused = true;
    this.showToast(
      "Graphics context lost. Your checkpoint is safe. Waiting for restoration.",
    );
    this.renderUI(true);
  }
  contextRestored() {
    this.graphicsLost = false;
    this.showToast("Graphics restored. Resume when ready.");
    this.renderUI(true);
  }
  private replace(state: Campaign) {
    if (this.closed) return;
    this.sim.dispose();
    this.sim = new Simulation(state);
    this.generation++;
    this.selection = [state.pirates[0].id];
    this.accumulator = 0;
    this.uiRevision = -1;
    this.bannerPhase = "";
    this.soundNotice = state.noticeId;
  }
  private togglePause() {
    if (!this.storageReady || this.busy || this.graphicsLost) return;
    this.paused = !this.paused;
    this.accumulator = 0;
    this.renderUI(true);
  }
  private showToast(message: string) {
    if (this.closed) return;
    const toast = el("toast");
    toast.textContent = message;
    toast.hidden = false;
    if (this.toastTimer !== undefined) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      this.toastTimer = undefined;
    }, 4500);
  }
  private async save() {
    if (!this.writer || !this.storageReady)
      throw new Error(this.storageError || "Local saves are not ready.");
    const token = this.generation;
    el("save-state").textContent = "Writing logbook…";
    await this.writer.save(checkpoint(this.state()));
    if (token === this.generation)
      el("save-state").textContent = "✓ Voyage saved";
  }
  private async guarded(work: () => Promise<void>) {
    if (this.busy || this.closed) return;
    this.busy = true;
    this.accumulator = 0;
    this.renderUI(true);
    try {
      await work();
    } catch (error) {
      this.showToast((error as Error).message);
      el("save-state").textContent = "Save failed · retry or export";
    } finally {
      this.busy = false;
      this.renderUI(true);
    }
  }
  async action(action: string, data: DOMStringMap = {}) {
    if (action === "close") {
      this.closeModal();
      return;
    }
    if (["help", "credits", "settings", "crew-settings"].includes(action)) {
      this.openModal(action);
      return;
    }
    if (action === "sound") {
      this.sound.setEnabled(!this.sound.enabled);
      if (this.sound.enabled) void this.sound.unlock();
      try {
        localStorage.setItem(
          "privateer-sound",
          this.sound.enabled ? "on" : "off",
        );
      } catch {
        /* Session preference remains available. */
      }
      this.openModal("settings");
      return;
    }
    if (action === "motion") {
      this.lowMotion = !this.lowMotion;
      try {
        localStorage.setItem(
          "privateer-motion",
          this.lowMotion ? "reduced" : "normal",
        );
      } catch {
        this.showToast("Motion preference applies for this session.");
      }
      this.openModal("settings");
      return;
    }
    if (action === "export") {
      this.export();
      return;
    }
    if (action === "destination") {
      this.destination(Number(data.id));
      return;
    }
    if (action === "new") {
      if (!this.storageReady) {
        this.showToast(this.storageError);
        return;
      }
      await this.guarded(async () => {
        const state = createCampaign(
          Date.now() >>> 0 || 1,
          `voyage-${Date.now()}`,
        );
        await this.writer!.save(checkpoint(state));
        this.replace(state);
        this.closeModal();
        this.paused = false;
      });
      return;
    }
    if (action === "load" || action === "recover") {
      if (!this.storageReady) return;
      await this.guarded(async () => {
        const state = await this.writer!.load(
          action === "recover" ? "previous" : "current",
        );
        this.replace(state);
        this.closeModal();
        this.paused = true;
        this.showToast("Checkpoint restored. Press Space to resume.");
      });
      return;
    }
    if (this.busy) {
      this.showToast("Finish writing the logbook first.");
      return;
    }
    if (!this.storageReady) {
      this.showToast(this.storageError || "Local saves are not ready yet.");
      return;
    }
    switch (action) {
      case "pause":
        this.togglePause();
        break;
      case "save":
        await this.guarded(async () => {
          await this.save();
          this.showToast("Voyage saved at a safe checkpoint.");
        });
        break;
      case "select-all":
        this.selection = this.state()
          .pirates.filter((p) => p.side === "ally" && p.hp > 0)
          .map((p) => p.id);
        break;
      case "select":
        this.selection = [Number(data.id)];
        break;
      case "board":
      case "retreat":
        if (this.sim.queue(this.selection, { action }, false))
          this.showToast(
            this.paused
              ? "Order queued. Resume to execute."
              : action === "board"
                ? "Grappling lines ready. Crew boarding."
                : "Crew returning aboard.",
          );
        break;
      case "duty":
        if (this.state().phase === "port") {
          await this.guarded(async () => {
            const before = checkpoint(this.state());
            if (this.sim.assignDuty(Number(data.id), data.kind as Duty)) {
              try {
                await this.save();
              } catch (e) {
                this.replace(before);
                throw e;
              }
            }
          });
        } else this.sim.assignDuty(Number(data.id), data.kind as Duty);
        this.openModal("crew-settings");
        break;
      case "collect":
        this.sim.collect(this.selection);
        break;
      case "plunder":
      case "capture":
        this.sim.finishEncounter(action === "capture");
        break;
      case "cannon":
        if (this.paused) {
          this.showToast("Resume before firing the cannon.");
          break;
        }
        this.sim.cannon();
        break;
      case "escape":
        this.sim.escape();
        break;
      case "heal":
        if (this.paused && this.state().phase === "encounter") {
          this.showToast("Resume before treating battle wounds.");
          break;
        }
        this.sim.heal();
        break;
      case "map":
        this.openModal("map");
        break;
      case "shop":
        this.openModal("shop");
        break;
      case "recruit":
      case "rest":
      case "upgrade":
      case "buy":
      case "teach":
      case "equip":
      case "armor":
        await this.guarded(async () => {
          const before = checkpoint(this.state());
          let changed = false;
          if (action === "recruit") changed = this.sim.recruit();
          if (action === "rest") changed = this.sim.rest();
          if (action === "upgrade")
            changed = this.sim.upgrade(this.selection[0]);
          if (action === "buy") changed = this.sim.buy(data.kind as "food");
          if (action === "teach")
            changed = this.sim.teach(Number(data.id), data.kind as Duty);
          if (action === "equip")
            changed = this.sim.equip(Number(data.id), data.kind as Weapon);
          if (action === "armor") changed = this.sim.armor(Number(data.id));
          if (changed) {
            try {
              await this.save();
            } catch (e) {
              this.replace(before);
              throw e;
            }
          }
        });
        if (this.modalKind === "shop") this.openModal("shop");
        if (this.modalKind === "crew-settings") this.openModal("crew-settings");
        break;
      case "sail":
        await this.guarded(async () => {
          const id = Number(data.id),
            cost = this.sim.routeCost(id);
          if (!cost) return;
          const before = checkpoint(this.state());
          await this.save();
          if (this.closed) return;
          if (this.sim.sail(id)) {
            try {
              await this.save();
            } catch (e) {
              this.replace(before);
              throw e;
            }
            this.closeModal();
            this.paused = false;
          }
        });
        break;
      case "build":
        if (this.state().phase !== "port") {
          this.showToast("Visit port to refit your ship.");
          break;
        }
        this.modalWasPaused = this.paused;
        this.paused = true;
        this.draftTiles = this.state().ships[0].tiles.map((t) => ({ ...t }));
        this.draftStationList = this.state().ships[0].stations.map((t) => ({
          ...t,
        }));
        el("build-tools").hidden = false;
        break;
      case "hull":
      case "ladder":
      case "station-food":
      case "station-cannon":
      case "station-medical":
        this.brush = action.replace("station-", "") as typeof this.brush;
        el("build-tools")
          .querySelectorAll("button")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.action === action),
          );
        break;
      case "cancel-build":
        this.cancelBuild();
        break;
      case "apply-build":
        await this.guarded(async () => {
          if (!this.draftTiles) return;
          const before = checkpoint(this.state());
          const error = this.sim.edit(
            this.draftTiles,
            this.draftStationList ?? undefined,
          );
          if (error) {
            this.showToast(error);
            return;
          }
          try {
            await this.save();
            this.cancelBuild();
          } catch (e) {
            this.replace(before);
            throw e;
          }
        });
        break;
    }
    this.renderUI(true);
  }
  private cancelBuild() {
    this.draftTiles = null;
    this.draftStationList = null;
    el("build-tools").hidden = true;
    this.paused = this.modalWasPaused;
    this.accumulator = 0;
    this.renderUI(true);
  }
  private openModal(kind: string) {
    if (this.draftTiles) {
      this.showToast("Apply or cancel your ship refit first.");
      return;
    }
    if (!this.modalKind) {
      this.modalWasPaused = this.paused;
      this.modalFocus = document.activeElement as HTMLElement;
    }
    this.modalKind = kind;
    this.paused = true;
    this.accumulator = 0;
    const modal = el("modal");
    modal.hidden = false;
    const s = this.state();
    let title = "",
      body = "",
      cls = "";
    if (kind === "map") {
      title = "Chart a course";
      cls = "wide";
      body = `<p class="modal-intro">The sea rewards the prepared. Choose your next destination.</p><div class="world-map"><span class="map-label">THE SALTWATER ARCHIPELAGO</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${s.world
        .slice(1)
        .map((n) => `M${s.world[0].x} ${s.world[0].y} L${n.x} ${n.y}`)
        .join(
          " ",
        )}"/></svg>${s.world.map((n) => `<button data-action="destination" data-id="${n.id}" class="map-node ${n.kind} ${n.cleared ? "cleared" : ""} ${s.location === n.id ? "here" : ""}" style="left:${n.x}%;top:${n.y}%" aria-label="${escape(n.name)}"><span>${n.kind === "port" ? "⚓" : n.kind === "island" ? "✦" : n.kind === "boss" ? "☠" : "⚔"}</span><small>${escape(n.name)}</small></button>`).join("")}<span class="map-rose">N<br>✧<br>S</span></div><div id="route-details" class="route-details"><span>Select a destination on the chart.</span><small>Raw provisions: ${s.food} · Meals: ${s.meals} · Gold: ${s.gold}</small></div>`;
    } else if (kind === "crew-settings") {
      title = "Crew duties & equipment";
      const p = s.pirates.find(
        (p) => p.id === this.selection[0] && p.side === "ally",
      );
      if (!p) body = "<p>Select a crew member first.</p>";
      else
        body = `<p class="modal-intro"><strong>${escape(p.name)}</strong> · ${p.role} · Level ${p.level} · ${p.xp} XP · Gold ${s.gold}<br>Direct movement and combat orders interrupt work. Choose a duty to resume it.</p><h3>Duty roster</h3><div class="duty-grid">${DUTIES.map((d) => `<div class="duty-item ${p.duty === d ? "active" : ""}"><strong>${DUTY_NAMES[d]}</strong><p>${{ guard: "Free for boarding and fighting.", cook: "Galley: 1 raw provision → 2 cooked meals.", clean: "Clean decks protect crew morale.", repair: "1 timber repairs 12 hull health.", medic: "1 medicine restores 25 crew health.", gunner: "Works at the cannon and fires when ready." }[d]}</p><button data-action="${p.skills.includes(d) ? "duty" : "teach"}" data-id="${p.id}" data-kind="${d}" ${(!p.skills.includes(d) && s.phase !== "port") || p.duty === d ? "disabled" : ""}>${p.duty === d ? "Assigned" : p.skills.includes(d) ? "Assign duty" : "Skill book · 60 gold"}</button></div>`).join("")}</div><h3>Weapon locker</h3><div class="settings-grid">${Object.entries(
          WEAPONS,
        )
          .map(
            ([key, w]) =>
              `<button data-action="equip" data-id="${p.id}" data-kind="${key}" ${s.phase !== "port" || p.weapon === key ? "disabled" : ""}>${w.name} · ${p.weapon === key ? "Equipped" : p.ownedWeapons.includes(key as Weapon) ? "Equip owned" : `${w.price} gold`}<small>${w.range > 2 ? "Ranged" : "Melee"} · ${p.damage + w.bonus} damage</small></button>`,
          )
          .join(
            "",
          )}<button data-action="armor" data-id="${p.id}" ${s.phase !== "port" || p.armor >= 8 ? "disabled" : ""}>Armor · ${p.armor}/8 protection<small>Upgrade +4 · 50 gold</small></button></div><p class="muted">Books and equipment are sold in port. Bought weapons stay in this pirate’s locker; switching back is free. Work slows below 30 morale.</p>`;
    } else if (kind === "shop") {
      title = "Harbour market";
      body = `<p class="modal-intro">Provisions for the voyage. Keep a little gold aside for wages.</p><div class="shop-grid">${[
        ["food", "Provisions", "10 portions", "20", "▣"],
        ["ammo", "Cannonballs", "6 rounds", "24", "●"],
        ["medicine", "Medicine", "4 treatments", "30", "✚"],
        ["parts", "Ship timber", "10 blocks", "25", "▰"],
      ]
        .map(
          ([kind, name, amount, price, icon]) =>
            `<div class="shop-item"><i>${icon}</i><h3>${name}</h3><p>${amount}</p><button data-action="buy" data-kind="${kind}" ${s.phase !== "port" ? "disabled" : ""}>Buy · ${price} gold</button></div>`,
        )
        .join(
          "",
        )}</div><p class="muted">In your hold: ${s.food} raw provisions · ${s.meals} cooked meals · ${s.ammo} ammo · ${s.medicine} medicine · ${s.parts} timber</p>`;
    } else if (kind === "settings") {
      title = "Your logbook";
      body = `<p class="modal-intro">Local checkpoints live in this browser. Export a backup to keep your voyage safe.</p><div class="settings-grid"><button data-action="save">↓ Save checkpoint</button><button data-action="load">↶ Restore checkpoint</button><button data-action="recover">↶ Previous checkpoint</button><button data-action="export">↗ Export backup</button><label class="file-button">↙ Import backup<input id="import-file" type="file" accept="application/json,.json"></label><button data-action="sound">Sound effects: ${this.sound.enabled ? "ON" : "OFF"}</button><button data-action="motion">Reduced motion: ${this.lowMotion ? "ON" : "OFF"}</button></div><details class="new-voyage"><summary>Start another voyage</summary><p>Your current checkpoint becomes the previous backup. Export it first if you want to keep it.</p><button data-action="new">Start fresh voyage</button></details>`;
    } else if (kind === "help") {
      title = "Captain’s guide";
      body = `<p class="modal-intro">A ship is only as good as the pirates aboard it.</p><ol class="guide"><li><strong>Prepare in port.</strong> Recruit for 70 gold. Buy food, cannonballs and timber at the market. Tavern rest repairs the ship and heals everyone.</li><li><strong>Refit your ship.</strong> Build ship pauses the game. Click a block to remove it, or an empty grid cell to place hull/ladder. Keep every station and pirate reachable.</li><li><strong>Choose your adventure.</strong> Chart a course previews food and wages. Castaway Cay is an unguarded island to explore; the Crooked Cutlass is the easiest battle.</li><li><strong>Command your crew.</strong> Click pirates or crew cards to select. Shift-click adds to selection. Click a deck to move, or an enemy to attack. Select crew then Board ship to cross.</li><li><strong>Fight and survive.</strong> Assign a trained Cannoneer to work at the cannon. Incoming fire damages hull; a Shipwright uses timber to repair it. Use Treat wounds and Retreat. Pause with Space to plan; queued orders execute on resume.</li><li><strong>Bring home the spoils.</strong> Once enemies fall, return every survivor with Retreat, then Plunder to claim rewards or Capture ship to take an intact hull. On islands, go ashore and Collect chest first. Sail back to the harbour, train your weapons, and prepare for Admiral Blackthorn.</li></ol><p class="muted">Duties & equipment assigns trained cooks, cleaners, shipwrights, doctors, and cannoneers. Food must be cooked to feed the crew. Captain death restores from a living checkpoint. Hidden tabs pause. Sound effects can be muted in Settings. Hotkeys: Q select crew, B board, R return, C cannon, F chest, P plunder, I crew, M map.</p>`;
    } else {
      title = "Made for the pirate life";
      body = `<p class="modal-intro">An unofficial personal-use browser tribute to Pixel Piracy.</p><p>Reference-game credit: Quadro Delta (Vitali Kirpu and Alexander Poysky), Re-Logic, and the creators credited by the original game. Current Steam listing: Vitali Kirpu.</p><p>Gameplay draws on its ship-building, crew-management, exploration and boarding loop. All visuals in this build are newly drawn procedural pixel art. No Steam assets or source code are included.</p><p>Intended sharing: free and noncommercial, with proper attribution. No official endorsement is implied.</p><a href="https://store.steampowered.com/app/264140/Pixel_Piracy/" target="_blank" rel="noreferrer">Visit Pixel Piracy on Steam ↗</a>`;
    }
    modal.innerHTML = `<section class="modal-card ${cls}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><span class="eyebrow">CAPTAIN’S QUARTERS</span><button data-action="close" aria-label="Close dialog">×</button></div><h2 id="modal-title">${title}</h2>${body}</section>`;
    modal.querySelector<HTMLButtonElement>("button")?.focus();
    this.renderUI(true);
  }
  private destination(id: number) {
    const n = this.state().world.find((n) => n.id === id),
      cost = this.sim.routeCost(id);
    if (!n || !cost) return;
    el("route-details").innerHTML =
      `<div><strong>${escape(n.name)}</strong><p>${n.kind === "port" ? "Safe harbour · Recruitment & supplies" : n.cleared ? "Charted waters · No new loot" : n.kind === "island" ? `Explore ashore · ${n.danger > 1 ? "Guarded chest" : "Unguarded chest"}` : `${"★".repeat(n.danger)} · ${n.kind === "boss" ? "Legendary captain" : "Hostile pirate ship"}`}</p></div><div><small>${cost.food} food · ${cost.wages} gold wages · ${Math.ceil(cost.ticks / 20)} sec voyage</small><button data-action="sail" data-id="${id}" class="primary" ${this.state().location === id || !["port", "victory"].includes(this.state().phase) ? "disabled" : ""}>Set sail →</button></div>`;
  }
  private closeModal() {
    el("modal").hidden = true;
    el("modal").innerHTML = "";
    this.modalKind = "";
    this.paused = this.modalWasPaused;
    this.accumulator = 0;
    this.modalFocus?.focus();
    this.modalFocus = null;
    this.renderUI(true);
  }
  private export() {
    try {
      const state = checkpoint(this.state());
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "pixel-privateer-voyage.json";
      a.click();
      URL.revokeObjectURL(url);
      this.showToast("Backup exported.");
    } catch (e) {
      this.showToast((e as Error).message);
    }
  }
  private async importFile(file: File) {
    if (!this.storageReady) return;
    await this.guarded(async () => {
      if (file.size > LIMITS.importBytes)
        throw new Error("Backup exceeds the 2 MiB limit.");
      const state = validateSave(JSON.parse(await file.text()));
      await this.writer!.save(state);
      this.replace(state);
      this.closeModal();
      this.paused = true;
      this.showToast("Backup imported. Press Space to resume.");
    });
  }
  private renderUI(force = false) {
    if (this.closed) return;
    const s = this.state();
    if (!force && this.uiRevision === s.revision) return;
    this.uiRevision = s.revision;
    for (const key of ["gold", "food", "ammo", "medicine", "parts"] as const)
      el(key).textContent = String(s[key]);
    el("location").textContent =
      s.world.find((n) => n.id === (s.destination ?? s.location))?.name ??
      "At sea";
    el("phase").textContent = this.busy
      ? "SAVING"
      : this.paused
        ? "PAUSED"
        : s.phase.toUpperCase();
    el("pause").innerHTML =
      `${this.paused ? "▶ Resume" : "Ⅱ Pause"} <kbd>SPACE</kbd>`;
    el("day").textContent =
      `DAY ${String(1 + Math.floor(s.tick / 2400)).padStart(2, "0")}`;
    const titles = {
      port: "A small ship. A grand adventure.",
      travel: "Following the horizon.",
      encounter: "Give them a taste of the pirate life.",
      aftermath: "Victory is only half the story.",
      victory: "Another tale for the tavern.",
      gameover: "A captain’s luck runs out.",
      won: "The sea remembers your name.",
    };
    el("scene-title").textContent = titles[s.phase];
    el("objective").textContent =
      s.phase === "port"
        ? "Stock the hold, gather your crew, and see what lies beyond the harbour."
        : s.phase === "travel"
          ? `Sailing to ${s.world.find((n) => n.id === s.destination)?.name}. The crew’s wages are paid.`
          : s.phase === "encounter"
            ? s.ships[1]?.kind === "island"
              ? "Go ashore, defeat any guards, then order the crew to collect the chest."
              : "Keep a cannoneer aboard or send your fighters across. Watch hull health and assign repairs."
            : s.phase === "aftermath"
              ? s.ships[1]?.kind === "island"
                ? "Return every survivor to your ship, then take the treasure chest’s spoils."
                : "Return every survivor to your ship. Plunder the prize or capture an intact enemy vessel."
              : s.phase === "victory"
                ? `Spoils secured: ${s.reward} gold. ${s.world.filter((n) => n.kind === "boss" && !n.cleared).length} pirate lords remain. Return to port or chart another adventure.`
                : s.phase === "won"
                  ? "All four pirate lords are defeated. Your crew has earned a place in pirate legend."
                  : "Restore your checkpoint and try a different battle plan.";
    this.selection = this.selection.filter((id) =>
      s.pirates.some((p) => p.id === id && p.side === "ally" && p.hp > 0),
    );
    if (
      !this.selection.length &&
      s.pirates.some((p) => p.side === "ally" && p.hp > 0)
    )
      this.selection = [
        s.pirates.find((p) => p.side === "ally" && p.hp > 0)!.id,
      ];
    const crew = s.pirates.filter((p) => p.side === "ally" && p.hp > 0);
    el("ship-readout").textContent =
      `HULL ${Math.ceil(s.ships[0].hp)}/${s.ships[0].maxHp} · DIRT ${s.ships[0].dirt}% · MEALS ${s.meals}`;
    el("crew-count").textContent = `${crew.length} / 12`;
    // Small UI projection only; never clones authoritative world state.
    const signature = crew
      .map(
        (p) =>
          `${p.id}:${p.hp}:${p.hunger}:${p.morale}:${p.level}:${p.duty}:${p.weapon}:${p.status}:${this.selection.includes(p.id)}`,
      )
      .join("|");
    if (el("crew").dataset.signature !== signature) {
      el("crew").dataset.signature = signature;
      el("crew").innerHTML = crew
        .map(
          (p) =>
            `<button class="crew-card ${this.selection.includes(p.id) ? "selected" : ""}" data-action="select" data-id="${p.id}" aria-pressed="${this.selection.includes(p.id)}"><span class="portrait ${p.role}"><i></i></span><span class="crew-info"><strong>${escape(p.name)} <small>LV.${p.level}</small></strong><span>${p.role.toUpperCase()} · ${DUTY_NAMES[p.duty]}</span><span class="health"><i style="width:${(100 * p.hp) / p.maxHp}%"></i></span><small>${Math.ceil(p.hp)} / ${p.maxHp} HP · ${escape(p.status)}</small><small>FOOD ${p.hunger}% · MORALE ${p.morale}%</small></span></button>`,
        )
        .join("");
    }
    for (const notice of s.notices)
      if (notice.id > this.soundNotice) {
        if (/Broadside|cannonball/.test(notice.text)) this.sound.play("cannon");
        else if (/fell in battle/.test(notice.text)) this.sound.play("hit");
        else if (/secured|captured|plundered/.test(notice.text))
          this.sound.play("loot");
      }
    this.soundNotice = s.noticeId;
    const last = s.notices.slice(-3);
    const journalSig = last.map((n) => n.id).join(",");
    if (el("journal").dataset.signature !== journalSig) {
      el("journal").dataset.signature = journalSig;
      el("journal").innerHTML = last
        .reverse()
        .map(
          (n) =>
            `<p class="log-entry ${n.tone}"><span>${n.tone === "good" ? "✦" : n.tone === "bad" ? "!" : "›"}</span>${escape(n.text)}</p>`,
        )
        .join("");
    }
    el("crew-summary").textContent = this.selection.length
      ? `${this.selection.length} selected · Weapon ${s.pirates.find((p) => p.id === this.selection[0])?.damage ?? 0} dmg`
      : "";
    el("escape").hidden = !["encounter", "aftermath"].includes(s.phase);
    el("collect").hidden =
      s.phase !== "encounter" || s.ships[1]?.kind !== "island";
    el("plunder").hidden = s.phase !== "aftermath";
    el("capture").hidden =
      s.phase !== "aftermath" ||
      s.ships[1]?.kind !== "ship" ||
      s.ships[1].hp <= 0;
    for (const id of ["collect", "plunder", "capture", "escape"])
      (el(id) as HTMLButtonElement).disabled = this.busy;
    const port = s.phase === "port";
    for (const id of ["recruit", "build"])
      (el(id) as HTMLButtonElement).disabled = !port || this.busy;
    for (const id of ["board", "retreat"])
      (el(id) as HTMLButtonElement).disabled =
        !["encounter", "aftermath"].includes(s.phase) || this.busy;
    (el("cannon") as HTMLButtonElement).disabled =
      s.phase !== "encounter" || s.ships[1]?.kind !== "ship" || this.busy;
    (el("chart") as HTMLButtonElement).disabled =
      !["port", "victory"].includes(s.phase) || this.busy;
    el("hint").textContent = this.draftTiles
      ? "Refit paused · Keep the hull connected and stations reachable"
      : this.paused
        ? "Paused · Plan your orders, then press Space to resume"
        : s.phase === "travel"
          ? `Arrival in ${Math.ceil(s.travelTicks / 20)} seconds`
          : "Click pirate to select · Click deck to move · Shift-click to add · Space to pause";
    if (this.bannerPhase !== s.phase) {
      this.bannerPhase = s.phase;
      const banner = el("scene-banner");
      banner.hidden = !["victory", "gameover", "won"].includes(s.phase);
      banner.innerHTML =
        s.phase === "gameover"
          ? '<span>CAPTAIN OVERBOARD</span><button data-action="load">Restore living checkpoint →</button>'
          : s.phase === "victory"
            ? '<span>THE SPOILS ARE YOURS</span><button data-action="map">Chart the next voyage →</button>'
            : '<span>LEGEND OF THE SALTWATER SEA</span><button data-action="settings">Open logbook →</button>';
      if (s.phase === "victory" || s.phase === "won")
        void this.guarded(async () => {
          await this.save();
        });
    }
    if (import.meta.env.DEV)
      el("diagnostics").textContent =
        `20 Hz · ${this.sea?.counters.actors ?? 0} actors`;
  }
  diagnostics() {
    return {
      frameMs: this.frames.summary(),
      tickMs: this.ticks.summary(),
      stalls: this.stalls,
      views: this.sea?.counters,
      graphs: this.sim.graphCount,
      searches: this.sim.pendingCount,
      commands: this.sim.commandCount,
      audioVoices: this.sound.activeCount,
      tasks: this.sim.taskCount,
      claims: this.sim.claimCount,
      listeners: this.scope.count,
      saveWrites: this.writer?.activeCount ?? 0,
      lock: this.lockState,
      tick: this.state().tick,
      phase: this.state().phase,
    };
  }
  async dispose() {
    if (this.closed) return;
    this.closed = true;
    this.generation++;
    this.scope.dispose();
    if (this.toastTimer !== undefined) clearTimeout(this.toastTimer);
    this.sim.dispose();
    this.game?.destroy(true);
    this.game = null;
    await this.sound.dispose();
    await this.writer?.close();
    this.releaseLock?.();
    this.releaseLock = null;
    this.lockState = "released";
    el("modal").innerHTML = "";
    if (import.meta.env.DEV) delete (window as any).__privateer;
  }
}
const application = new Application();
// A weapon upgrade stays visible alongside port services.
const train = document.createElement("button");
train.dataset.action = "upgrade";
train.textContent = "⚔ Train weapon · 45 gold";
document.querySelector(".port-tools")!.insertBefore(train, el("crew-summary"));
if (import.meta.env.DEV) (window as any).__privateer = application;
void application.start();
