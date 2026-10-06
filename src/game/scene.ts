import Phaser from "phaser";
import {
  Campaign,
  nodeX,
  nodeY,
  Pirate,
  Ship,
  Station,
  Tile,
} from "../sim/model";
import { Lifetime } from "../app/lifetime";
export const TILE = 18;
export const HOME_X = 230;
export const ENEMY_X = 800;
export const SHIP_Y = 300;
export interface ViewHost {
  state(): Campaign;
  selected(): readonly number[];
  draft(): Tile[] | null;
  draftStations(): Station[] | null;
  reducedMotion(): boolean;
  update(delta: number): number;
  click(
    shipId: number,
    x: number,
    y: number,
    pirateId: number | null,
    queue: boolean,
  ): void;
  contextLost(): void;
  contextRestored(): void;
}
const COLORS = ["#dfbc77", "#ca5c4e", "#91a8aa", "#79a18c"];
function createTextures(scene: Phaser.Scene) {
  const pattern = [
    "      HHHHH     ",
    "    HHHHHHHHH   ",
    "    HHHHHHHHH   ",
    "     SSSSSSS    ",
    "     SXSSXSS    ",
    "     SSSSSSS    ",
    "      SSSSS     ",
    "     CCCCCCC    ",
    "   CCCCCCCCCCC  ",
    "   SCCCGCCCSS   ",
    "   SCCCCCCCSS   ",
    "    CCCCCCC W   ",
    "    BBBBBBB WW  ",
    "     BB BB  W   ",
    "     BB BB      ",
    "    DDD DDD     ",
  ];
  for (let i = 0; i < 4; i++) {
    const key = `pirate-${i}`;
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, 32, 20)!;
    const ctx = texture.context;
    const palette: Record<string, string> = {
      H: i === 0 ? "#192e35" : "#6a453a",
      S: "#efbb8f",
      X: "#152d34",
      C: COLORS[i],
      G: "#efd488",
      B: "#253b45",
      D: "#13272f",
      W: "#dae7db",
    };
    for (let frame = 0; frame < 2; frame++)
      for (let y = 0; y < pattern.length; y++)
        for (let x = 0; x < 16; x++) {
          let c = pattern[y][x];
          if (frame === 1 && y >= 13)
            c = (y === 15 ? "   DDD   DDD    " : "    BB   BB     ")[x];
          if (palette[c]) {
            ctx.fillStyle = palette[c];
            ctx.fillRect(x + frame * 16, y + 4, 1, 1);
          }
        }
    texture.add("idle", 0, 0, 0, 16, 20);
    texture.add("walk", 0, 16, 0, 16, 20);
    texture.refresh();
  }
}
export class SeaScene extends Phaser.Scene {
  private scope = new Lifetime();
  private scenery!: Phaser.GameObjects.Graphics;
  private waves!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private actors = new Map<number, Phaser.GameObjects.Sprite>();
  private seenRevision = -1;
  private seenPhase = "";
  private seenLocation = -1;
  private draftRef: Tile[] | null = null;
  private stationRef: Station[] | null = null;
  private phaseLabel!: Phaser.GameObjects.Text;
  private shipLabel!: Phaser.GameObjects.Text;
  private enemyLabel!: Phaser.GameObjects.Text;
  private clouds: Phaser.GameObjects.Graphics[] = [];
  constructor(private host: ViewHost) {
    super("sea");
  }
  create() {
    this.scope = new Lifetime();
    createTextures(this);
    this.scenery = this.add.graphics();
    this.waves = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      const cloud = this.add.graphics();
      cloud.fillStyle(0xf6e9c8, 0.4);
      cloud.fillRect(0, 10, 90, 14);
      cloud.fillRect(20, 0, 50, 14);
      cloud.setPosition(80 + i * 420, 45 + (i % 2) * 30);
      this.clouds.push(cloud);
    }
    this.shipLabel = this.add
      .text(390, 465, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#c4e1d4",
      })
      .setOrigin(0.5);
    this.enemyLabel = this.add
      .text(970, 465, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#efcba0",
      })
      .setOrigin(0.5);
    this.phaseLabel = this.add
      .text(640, 28, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#426563",
      })
      .setOrigin(0.5);
    this.overlay = this.add.graphics();
    const pointer = (p: Phaser.Input.Pointer) => {
      if (p.downElement !== this.game.canvas) return;
      let id: number | null = null,
        shipId = 1,
        x = 0,
        y = 0;
      for (const actor of this.host.state().pirates) {
        const px =
            (actor.shipId === 1 ? HOME_X : ENEMY_X) + actor.x * TILE + TILE / 2,
          py = SHIP_Y + actor.y * TILE + TILE;
        if (Math.abs(p.x - px) < 15 && p.y > py - 42 && p.y < py + 8) {
          id = actor.id;
          shipId = actor.shipId;
          break;
        }
      }
      if (id === null) shipId = p.x >= ENEMY_X - 20 ? 2 : 1;
      x = Math.floor((p.x - (shipId === 1 ? HOME_X : ENEMY_X)) / TILE);
      y = Math.floor((p.y - SHIP_Y) / TILE);
      this.host.click(
        shipId,
        x,
        y,
        id,
        p.event.shiftKey || p.rightButtonDown(),
      );
    };
    this.input.on("pointerdown", pointer);
    this.scope.own(() => this.input.off("pointerdown", pointer));
    this.scope.listen(this.game.canvas, "contextmenu", (e) =>
      e.preventDefault(),
    );
    this.scope.listen(this.game.canvas, "webglcontextlost", (e) => {
      e.preventDefault();
      this.host.contextLost();
    });
    this.scope.listen(this.game.canvas, "webglcontextrestored", () =>
      this.host.contextRestored(),
    );
    const release = () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, release);
      this.events.off(Phaser.Scenes.Events.DESTROY, release);
      this.release();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
    this.events.once(Phaser.Scenes.Events.DESTROY, release);
    this.seenRevision = -1;
    this.drawScenery();
  }
  private release() {
    this.scope.dispose();
    for (const actor of this.actors.values()) actor.destroy();
    this.actors.clear();
    this.clouds.length = 0;
    this.seenRevision = -1;
  }
  get counters() {
    return {
      actors: this.actors.size,
      subscriptions: this.scope.count,
      clouds: this.clouds.length,
      textures: this.textures?.getTextureKeys().length ?? 0,
      shutdownHandlers: this.events.listenerCount(
        Phaser.Scenes.Events.SHUTDOWN,
      ),
      destroyHandlers: this.events.listenerCount(Phaser.Scenes.Events.DESTROY),
    };
  }
  private rect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha = 1,
  ) {
    g.fillStyle(color, alpha);
    g.fillRect(x, y, w, h);
  }
  private drawScenery() {
    const g = this.scenery,
      s = this.host.state();
    g.clear();
    this.rect(g, 0, 0, 1280, 325, 0xa8cbbd);
    this.rect(g, 0, 170, 1280, 155, 0x8db8aa);
    this.rect(g, 0, 282, 1280, 65, 0x75a69c);
    // Distant island silhouettes, drawn once per scene revision.
    g.fillStyle(0x729f91);
    g.fillTriangle(740, 315, 835, 205, 950, 315);
    g.fillTriangle(830, 315, 965, 230, 1100, 315);
    g.fillStyle(0x86b1a0);
    g.fillTriangle(750, 315, 835, 236, 885, 315);
    this.rect(g, 0, 342, 1280, 198, 0x315f66);
    this.rect(g, 0, 342, 1280, 14, 0x568d85);
    this.rect(g, 0, 356, 1280, 24, 0x427b79);
    this.rect(g, 0, 430, 1280, 110, 0x28545e);
    if (s.phase === "port") this.drawPort(g);
    this.drawShip(g, s.ships[0], HOME_X, this.host.draft());
    if (s.ships.length > 1) this.drawShip(g, s.ships[1], ENEMY_X, null);
    const draft = this.host.draft();
    if (draft) {
      g.lineStyle(1, 0xefe6c5, 0.25);
      for (let x = 0; x <= 32; x++)
        g.lineBetween(
          HOME_X + x * TILE,
          SHIP_Y,
          HOME_X + x * TILE,
          SHIP_Y + 10 * TILE,
        );
      for (let y = 0; y <= 10; y++)
        g.lineBetween(
          HOME_X,
          SHIP_Y + y * TILE,
          HOME_X + 32 * TILE,
          SHIP_Y + y * TILE,
        );
    }
    this.shipLabel.setText(s.ships[0].name.toUpperCase());
    this.enemyLabel.setText(
      s.ships.length > 1 ? s.ships[1].name.toUpperCase() : "",
    );
    this.phaseLabel.setText(
      s.phase === "port"
        ? "SALTWATER HARBOUR  ·  SAFE WATERS"
        : s.phase === "travel"
          ? "UNDER SAIL  ·  A NEW HORIZON"
          : s.phase === "encounter"
            ? s.ships[1]?.kind === "island"
              ? "ISLAND LANDFALL  ·  TREASURE AWAITS"
              : "HOSTILE WATERS  ·  ALL HANDS ON DECK"
            : s.phase === "aftermath"
              ? "BRING THE CREW HOME  ·  CLAIM YOUR PRIZE"
              : "THE SEA IS YOURS TO EXPLORE",
    );
  }
  private drawPort(g: Phaser.GameObjects.Graphics) {
    this.rect(g, 0, 312, 160, 34, 0x72965d);
    this.rect(g, 0, 340, 150, 60, 0x6b7760);
    this.rect(g, 0, 393, 130, 16, 0x465f50);
    // Tavern and shipwright.
    this.rect(g, 19, 247, 88, 66, 0xb69c73);
    this.rect(g, 14, 241, 99, 10, 0x633f38);
    this.rect(g, 24, 225, 77, 16, 0x784a3e);
    this.rect(g, 35, 213, 55, 12, 0x83523f);
    this.rect(g, 49, 278, 25, 35, 0x493b33);
    this.rect(g, 29, 260, 14, 18, 0xe5c880);
    this.rect(g, 80, 260, 14, 18, 0xe5c880);
    this.rect(g, 25, 294, 13, 3, 0x735644);
    this.rect(g, 116, 276, 53, 37, 0x8d8061);
    this.rect(g, 110, 265, 64, 12, 0x62473a);
    this.rect(g, 135, 285, 13, 27, 0x453e34);
    this.rect(g, 102, 325, 139, 8, 0x806346);
    for (let x = 115; x < 240; x += 31) {
      this.rect(g, x, 333, 7, 52, 0x584935);
      this.rect(g, x, 331, 7, 3, 0xa58255);
    }
    this.rect(g, 180, 305, 22, 20, 0x8d6545);
    this.rect(g, 178, 310, 26, 3, 0x3d453d);
    this.rect(g, 178, 320, 26, 3, 0x3d453d);
    // Palm, pixel leaves and trunk.
    for (let y = 0; y < 8; y++)
      this.rect(g, 155 + y * 2, 209 + y * 12, 6, 14, 0x786e45);
    this.rect(g, 126, 198, 70, 9, 0x3f7154);
    this.rect(g, 115, 207, 91, 7, 0x497e56);
    this.rect(g, 133, 186, 15, 19, 0x4d805a);
    this.rect(g, 174, 187, 14, 23, 0x4d805a);
  }
  private drawShip(
    g: Phaser.GameObjects.Graphics,
    ship: Ship,
    ox: number,
    draft: Tile[] | null,
  ) {
    const tiles = draft ?? ship.tiles;
    if (ship.kind === "island") {
      for (const t of tiles) {
        const x = ox + t.x * TILE,
          y = SHIP_Y + t.y * TILE;
        this.rect(g, x, y, TILE, TILE, t.y === 4 ? 0x748347 : 0x9a8159);
        if (t.y === 4) this.rect(g, x, y, TILE, 5, 0x9dae63);
        else this.rect(g, x + 3, y + 7, 6, 3, 0x756e50);
      }
      for (const tx of [3, 9, 18]) {
        const x = ox + tx * TILE;
        for (let y = 0; y < 7; y++)
          this.rect(g, x + y * 2, 293 - y * 12, 7, 13, 0x87734a);
        this.rect(g, x - 17, 216, 75, 8, 0x467657);
        this.rect(g, x - 29, 226, 90, 7, 0x527f52);
        this.rect(g, x + 6, 203, 15, 18, 0x52845b);
      }
      const x = ox + 14 * TILE,
        y = SHIP_Y + 4 * TILE;
      this.rect(g, x - 4, y - 16, 27, 16, 0x79553a);
      this.rect(
        g,
        x - 5,
        y - (this.host.state().phase === "aftermath" ? 25 : 20),
        29,
        6,
        0xa67b49,
      );
      this.rect(g, x, y - 19, 3, 19, 0xdec075);
      this.rect(g, x + 15, y - 19, 3, 19, 0xdec075);
      return;
    }
    // Mast and sail. Shared geometry, no per-frame generated textures.
    this.rect(g, ox + 9 * TILE + 4, 117, 6, SHIP_Y + 4 * TILE - 117, 0x675440);
    this.rect(g, ox + 6 * TILE, 143, 146, 5, 0x584734);
    g.fillStyle(ship.id === 1 ? 0xe9dfb6 : 0x343e42);
    g.fillTriangle(
      ox + 9 * TILE + 5,
      151,
      ox + 9 * TILE + 5,
      288,
      ox + 4 * TILE,
      288,
    );
    g.fillTriangle(
      ox + 9 * TILE + 11,
      151,
      ox + 9 * TILE + 11,
      288,
      ox + 16 * TILE,
      288,
    );
    this.rect(
      g,
      ox + 7 * TILE,
      233,
      36,
      26,
      ship.id === 1 ? 0x4e665f : 0xe2d7b4,
    );
    this.rect(
      g,
      ox + 7 * TILE + 5,
      238,
      7,
      6,
      ship.id === 1 ? 0xe9dfb6 : 0x343e42,
    );
    this.rect(
      g,
      ox + 7 * TILE + 24,
      238,
      7,
      6,
      ship.id === 1 ? 0xe9dfb6 : 0x343e42,
    );
    this.rect(
      g,
      ox + 7 * TILE + 11,
      257,
      14,
      5,
      ship.id === 1 ? 0x4e665f : 0xe2d7b4,
    );
    this.rect(
      g,
      ox + 9 * TILE + 7,
      113,
      51,
      16,
      ship.id === 1 ? 0xbf6050 : 0x323d42,
    );
    this.rect(
      g,
      ox + 9 * TILE + 7,
      129,
      31,
      7,
      ship.id === 1 ? 0xbf6050 : 0x323d42,
    );
    for (const t of tiles) {
      const x = ox + t.x * TILE,
        y = SHIP_Y + t.y * TILE;
      if (t.kind === "ladder") {
        this.rect(g, x + 3, y, 3, TILE, 0xb7a276);
        this.rect(g, x + 12, y, 3, TILE, 0xb7a276);
        this.rect(g, x + 4, y + 4, 10, 2, 0x7b6349);
        this.rect(g, x + 4, y + 12, 10, 2, 0x7b6349);
      } else {
        this.rect(g, x, y, TILE, TILE, ship.id === 1 ? 0x72543d : 0x5d4540);
        this.rect(
          g,
          x + 1,
          y + 1,
          TILE - 2,
          4,
          ship.id === 1 ? 0xa78355 : 0x8b6550,
        );
        this.rect(g, x + 2, y + 7, TILE - 4, 1, 0x4b4033);
        this.rect(g, x + 4, y + 12, 3, 2, 0x453e33);
      }
    }
    for (const station of ship.id === 1
      ? (this.host.draftStations() ?? ship.stations)
      : ship.stations) {
      const x = ox + station.x * TILE,
        y = SHIP_Y + (station.y + 1) * TILE;
      if (station.kind === "cannon") {
        this.rect(g, x - 5, y - 13, 35, 8, 0x283d41);
        this.rect(g, x - 3, y - 8, 25, 5, 0x596264);
        this.rect(g, x, y - 5, 7, 5, 0x293539);
        this.rect(g, x + 19, y - 5, 7, 5, 0x293539);
      }
      if (station.kind === "food") {
        this.rect(g, x, y - 18, 16, 18, 0x82613d);
        this.rect(g, x - 1, y - 14, 18, 3, 0x36463e);
        this.rect(g, x - 1, y - 5, 18, 3, 0x36463e);
      }
      if (station.kind === "medical") {
        this.rect(g, x, y - 16, 20, 16, 0xd1c49c);
        this.rect(g, x + 8, y - 14, 4, 11, 0xad5244);
        this.rect(g, x + 4, y - 10, 12, 4, 0xad5244);
      }
    }
  }
  update(_time: number, delta: number) {
    const alpha = this.host.update(delta),
      s = this.host.state(),
      draft = this.host.draft();
    if (
      this.seenRevision !== s.ships[0].revision ||
      this.seenPhase !== s.phase ||
      this.seenLocation !== s.location ||
      this.draftRef !== draft ||
      this.stationRef !== this.host.draftStations()
    ) {
      this.drawScenery();
      this.seenRevision = s.ships[0].revision;
      this.seenPhase = s.phase;
      this.seenLocation = s.location;
      this.draftRef = draft;
      this.stationRef = this.host.draftStations();
    }
    const g = this.overlay;
    g.clear();
    if (s.ships.length > 1) {
      g.lineStyle(2, 0xc7b987, 0.7);
      g.lineBetween(
        HOME_X + 18 * TILE,
        SHIP_Y + 4 * TILE - 2,
        ENEMY_X,
        SHIP_Y + 4 * TILE - 2,
      );
    }
    for (const ship of s.ships)
      if (ship.kind === "ship") {
        const ox = ship.id === 1 ? HOME_X : ENEMY_X;
        this.rect(g, ox + 25, 482, 240, 5, 0x1e3f47);
        this.rect(
          g,
          ox + 25,
          482,
          (240 * ship.hp) / ship.maxHp,
          5,
          ship.hp < ship.maxHp * 0.35 ? 0xd88066 : 0xa7bd84,
        );
        if (ship.hp < ship.maxHp) {
          const cracks = Math.min(8, Math.ceil((1 - ship.hp / ship.maxHp) * 8));
          g.lineStyle(2, 0x332f29);
          for (let i = 0; i < cracks; i++) {
            const x = ox + (2 + i * 2) * TILE,
              y = SHIP_Y + 5 * TILE;
            g.lineBetween(x, y, x + 5, y + 5);
            g.lineBetween(x + 5, y + 5, x + 1, y + 12);
          }
        }
        for (let i = 0; i < Math.min(5, Math.floor(ship.dirt / 20)); i++)
          this.rect(
            g,
            ox + (3 + i * 3) * TILE,
            SHIP_Y + 4 * TILE - 3,
            8,
            3,
            0x756134,
          );
      }
    for (const p of s.pirates) {
      if (p.hp <= 0) {
        this.actors.get(p.id)?.destroy();
        this.actors.delete(p.id);
        continue;
      }
      let actor = this.actors.get(p.id);
      if (!actor) {
        actor = this.add
          .sprite(
            0,
            0,
            `pirate-${p.side === "enemy" ? 1 : p.role === "captain" ? 0 : p.role === "gunner" ? 2 : 3}`,
            "idle",
          )
          .setScale(2)
          .setOrigin(0.5, 1);
        this.actors.set(p.id, actor);
      }
      const x =
        (p.shipId === 1 ? HOME_X : ENEMY_X) +
        (p.previousX + (p.x - p.previousX) * alpha) * TILE +
        9;
      const y = SHIP_Y + (p.previousY + (p.y - p.previousY) * alpha + 1) * TILE;
      actor.setPosition(Math.round(x), Math.round(y));
      const moving =
        Math.abs(p.x - p.previousX) + Math.abs(p.y - p.previousY) > 0.001;
      actor.setFrame(
        moving && !this.host.reducedMotion() && Math.floor(s.tick / 5) % 2
          ? "walk"
          : "idle",
      );
      actor.setFlipX(
        moving
          ? p.x < p.previousX
          : p.targetId !== null &&
              s.pirates.some((t) => t.id === p.targetId && t.x < p.x),
      );
      if (this.host.selected().includes(p.id)) {
        g.lineStyle(2, 0xe8d394);
        g.strokeEllipse(x, y + 3, 29, 8);
      }
      this.rect(g, x - 13, y - 44, 26, 3, 0x203b40);
      this.rect(
        g,
        x - 13,
        y - 44,
        (26 * p.hp) / p.maxHp,
        3,
        p.side === "enemy" ? 0xc77865 : 0x9fc288,
      );
    }
    for (const [id, actor] of this.actors)
      if (!s.pirates.some((p) => p.id === id && p.hp > 0)) {
        actor.destroy();
        this.actors.delete(id);
      }
    this.waves.clear();
    const t = this.host.reducedMotion() ? 0 : _time * 0.012;
    for (let i = 0; i < 45; i++) {
      const x = ((i * 83 + t) % 1360) - 40,
        y = 363 + (i % 7) * 23;
      this.rect(
        this.waves,
        x,
        y,
        14 + (i % 4) * 7,
        2,
        0xa4c6b0,
        i % 3 === 0 ? 0.3 : 0.13,
      );
    }
    if (!this.host.reducedMotion())
      for (let i = 0; i < this.clouds.length; i++)
        this.clouds[i].x = ((80 + i * 420 + _time * 0.002) % 1400) - 70;
  }
}
