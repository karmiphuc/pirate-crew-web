import Phaser from "phaser";
import {
  paintPirate,
  pirateVariant,
  PIRATE_VARIANTS,
  PIRATE_FRAMES,
} from "./pirate-art";
import {
  Campaign,
  nodeX,
  nodeY,
  Pirate,
  Ship,
  Station,
  Tile,
} from "../sim/model";
import { intact } from "../sim/navigation";
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
function createTextures(scene: Phaser.Scene) {
  for (let i = 0; i < 4; i++) {
    const key = `pirate-${i}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(
        key,
        96,
        40 * PIRATE_VARIANTS,
      )!;
      for (let variant = 0; variant < PIRATE_VARIANTS; variant++) {
        for (const [frame, walking, x] of [
          ["idle", false, 0],
          ["walk", true, 32],
          ["blink", false, 64],
        ] as const) {
          texture.context.save();
          texture.context.translate(x, variant * 40);
          paintPirate(texture.context, i, walking, variant, frame === "blink");
          texture.context.restore();
          texture.add(
            PIRATE_FRAMES[frame][variant],
            0,
            x,
            variant * 40,
            32,
            40,
          );
        }
      }
      texture.refresh();
    }
    const canvas = scene.textures
      .get(key)
      .getSourceImage() as HTMLCanvasElement;
    document.documentElement.style.setProperty(
      `--pirate-${i}`,
      `url("${canvas.toDataURL()}")`,
    );
  }
}
export class SeaScene extends Phaser.Scene {
  private scope = new Lifetime();
  private background!: Phaser.GameObjects.Image;
  private scenery!: Phaser.GameObjects.Graphics;
  private waves!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private actors = new Map<number, Phaser.GameObjects.Sprite>();
  private seenEnemyRevision = -1;
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
  preload() {
    if (!this.textures.exists("sea-backdrop"))
      this.load.image(
        "sea-backdrop",
        new URL("./assets/harbour.webp", import.meta.url).href,
      );
  }
  create() {
    this.scope = new Lifetime();
    createTextures(this);
    const backdrop = this.textures.get("sea-backdrop");
    if (!backdrop.has("open-sea"))
      backdrop.add("open-sea", 0, 450, 0, 1481, 625);
    this.background = this.add
      .image(0, 0, "sea-backdrop")
      .setOrigin(0)
      .setDisplaySize(1280, 540);
    this.scenery = this.add.graphics();
    this.waves = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      const cloud = this.add.graphics();
      cloud.fillStyle(0xf6e9c8, 0.06);
      cloud.fillEllipse(40, 15, 90, 15);
      cloud.fillEllipse(27, 9, 39, 19);
      cloud.fillEllipse(52, 7, 47, 20);
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
        color: "#f0dec1",
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
        if (Math.abs(p.x - px) < 22 && p.y > py - 44 && p.y < py + 8) {
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
    for (let i = 0; i < 4; i++)
      document.documentElement.style.removeProperty(`--pirate-${i}`);
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
    this.background
      .setFrame(s.phase === "port" ? "__BASE" : "open-sea")
      .setDisplaySize(1280, 540);
    // The shared environment asset owns the landscape; foreground remains interactive geometry.
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
  private drawPalm(
    g: Phaser.GameObjects.Graphics,
    x: number,
    ground: number,
    scale: number,
  ) {
    const crownX = x - 17 * scale,
      crownY = ground - 125 * scale;
    g.fillStyle(0x6a5540);
    g.fillPoints(
      [
        { x: x - 5 * scale, y: ground },
        { x: x + 4 * scale, y: ground },
        { x: crownX + 3 * scale, y: crownY },
        { x: crownX - 3 * scale, y: crownY },
      ],
      true,
    );
    g.lineStyle(2, 0xb09161, 0.7);
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      g.lineBetween(
        x - 4 - 17 * t * scale,
        ground - 125 * t * scale,
        x + 2 - 17 * t * scale,
        ground - 125 * t * scale - 2,
      );
    }
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI + (i * Math.PI) / 7,
        length = (43 + (i % 3) * 8) * scale;
      const tipX = crownX + Math.cos(angle) * length,
        tipY = crownY + Math.sin(angle) * 24 * scale + 12 * scale;
      const points: Phaser.Types.Math.Vector2Like[] = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        points.push({
          x: crownX + (tipX - crownX) * t,
          y: crownY + (tipY - crownY) * t - 17 * Math.sin(Math.PI * t) * scale,
        });
      }
      for (let j = 8; j >= 0; j--) {
        const t = j / 8;
        points.push({
          x: crownX + (tipX - crownX) * t,
          y: crownY + (tipY - crownY) * t - 7 * Math.sin(Math.PI * t) * scale,
        });
      }
      g.fillStyle(i % 2 ? 0x447b58 : 0x2b5949);
      g.fillPoints(points, true);
      g.lineStyle(1, 0x91a76a, 0.7);
      g.lineBetween(crownX, crownY, tipX, tipY - 3);
    }
    g.fillStyle(0x684b35);
    g.fillCircle(crownX - 3, crownY + 3, 3 * scale);
    g.fillCircle(crownX + 3, crownY + 5, 3 * scale);
  }
  private drawIslandTerrain(
    g: Phaser.GameObjects.Graphics,
    tiles: Tile[],
    ox: number,
  ) {
    if (!tiles.length) return;
    const occupied = new Set(tiles.map((t) => `${t.x}:${t.y}`));
    const minX = Math.min(...tiles.map((t) => t.x)),
      maxX = Math.max(...tiles.map((t) => t.x)),
      bottomY = Math.max(...tiles.map((t) => t.y));
    const center = ox + ((minX + maxX + 1) * TILE) / 2;
    // Static contact shadow and broken foam ground the island in the same water as the ship.
    g.fillStyle(0x143e45, 0.35);
    g.fillEllipse(
      center,
      SHIP_Y + (bottomY + 1) * TILE,
      (maxX - minX + 1) * TILE + 24,
      18,
    );
    for (const t of tiles) {
      const x = ox + t.x * TILE,
        y = SHIP_Y + t.y * TILE;
      const top = !occupied.has(`${t.x}:${t.y - 1}`),
        bottom = !occupied.has(`${t.x}:${t.y + 1}`),
        left = !occupied.has(`${t.x - 1}:${t.y}`),
        right = !occupied.has(`${t.x + 1}:${t.y}`);
      // The silhouette stays inside actual support cells: decorative sand never bridges a gap.
      g.fillStyle(top ? 0xbfa77a : t.y % 2 ? 0x777762 : 0x58655b);
      g.fillPoints(
        [
          { x: x + (top && left ? 6 : 0), y },
          { x: x + TILE - (top && right ? 6 : 0), y },
          { x: x + TILE, y: y + (top && right ? 8 : 0) },
          { x: x + TILE, y: y + TILE - (bottom && right ? 8 : 0) },
          { x: x + TILE - (bottom && right ? 8 : 0), y: y + TILE },
          { x: x + (bottom && left ? 8 : 0), y: y + TILE },
          { x, y: y + TILE - (bottom && left ? 8 : 0) },
          { x, y: y + (top && left ? 8 : 0) },
        ],
        true,
      );
      if (top) {
        // Low dune ridges, sparse grass and warm sand replace the repeated green tile cap.
        const inset = left || right ? 6 : 0;
        g.fillStyle(0xe0c996);
        g.fillPoints(
          [
            { x: x + inset, y },
            { x: x + 8, y: y - (t.x % 4 === 1 ? 2 : 0) },
            { x: x + TILE - inset, y },
            { x: x + TILE - inset, y: y + 5 },
            { x: x + 6, y: y + 6 + (t.x % 3) },
            { x: x + inset, y: y + 5 },
          ],
          true,
        );
        if (t.x % 3 === 1) {
          g.lineStyle(1, 0x6e8156);
          for (const dx of [-3, 0, 4])
            g.lineBetween(x + 9, y + 2, x + 9 + dx, y - 4 - Math.abs(dx));
        }
        g.lineStyle(1, 0x927e59, 0.5);
        if (t.x % 2) g.lineBetween(x + 5, y + 12, x + 15, y + 10);
      } else if ((t.x * 3 + t.y) % 4 === 1) {
        const n = (t.x * 7 + t.y * 3) % 8;
        g.fillStyle(t.y % 2 ? 0x92917a : 0x718071, 0.6);
        g.fillPoints(
          [
            { x: x + n, y: y + 3 },
            { x: x + 15, y: y + 2 },
            { x: x + 17, y: y + 8 },
            { x: x + 11, y: y + 11 },
            { x: x + n + 1, y: y + 8 },
          ],
          true,
        );
        g.lineStyle(1, 0x3c514d, 0.5);
        g.lineBetween(x + 2, y + 14, x + 12, y + 12);
      }
      if (bottom) {
        g.lineStyle(2, 0xb4d6c1, 0.55);
        g.lineBetween(x + 3, y + TILE + 1, x + TILE - 2, y + TILE - 1);
      }
    }
    // Sparse foliage sits behind crew without changing walkable terrain.
    const ground = SHIP_Y + 4 * TILE;
    for (const tx of [4, 10, 18]) {
      if (!occupied.has(`${tx}:4`)) continue;
      const x = ox + tx * TILE;
      g.fillStyle(0x365e4d);
      g.fillEllipse(x, ground - 3, 34, 10);
      g.fillEllipse(x - 7, ground - 8, 13, 15);
      g.fillEllipse(x + 8, ground - 7, 18, 14);
      g.lineStyle(1, 0x849867, 0.7);
      g.lineBetween(x - 8, ground - 12, x - 2, ground - 5);
      g.lineBetween(x + 6, ground - 11, x + 11, ground - 5);
    }
  }
  private drawShip(
    g: Phaser.GameObjects.Graphics,
    ship: Ship,
    ox: number,
    draft: Tile[] | null,
  ) {
    const tiles = (draft ?? ship.tiles).filter((t) => draft || intact(t));
    if (ship.kind === "island") {
      this.drawIslandTerrain(g, tiles, ox);
      for (const tx of [3, 9, 18])
        this.drawPalm(g, ox + tx * TILE, SHIP_Y + 4 * TILE, tx === 9 ? 0.8 : 1);
      const x = ox + 14 * TILE,
        y = SHIP_Y + 4 * TILE;
      g.fillStyle(0x302c28);
      g.fillRoundedRect(x - 6, y - 20, 30, 21, 3);
      g.fillStyle(0x805237);
      g.fillRoundedRect(x - 4, y - 18, 26, 17, 2);
      g.fillStyle(0xb58a50);
      g.fillRoundedRect(
        x - 5,
        y - (this.host.state().phase === "aftermath" ? 29 : 23),
        28,
        9,
        4,
      );
      for (const band of [x, x + 15]) {
        this.rect(g, band, y - 23, 3, 23, 0xd6b575);
        this.rect(g, band, y - 23, 1, 23, 0xf3d8a0);
      }
      this.rect(g, x + 8, y - 13, 5, 6, 0xd6b575);
      this.rect(g, x + 10, y - 11, 1, 3, 0x453831);
      return;
    }
    const occupied = new Set(
      tiles.filter((t) => t.kind === "hull").map((t) => `${t.x}:${t.y}`),
    );
    const mast = ox + 9 * TILE + 8,
      friendly = ship.id === 1;
    if (tiles.length) {
      const hull = tiles.filter((t) => t.kind === "hull");
      if (hull.length) {
        const low = Math.max(...hull.map((t) => t.y)) + 1,
          minX = Math.min(...hull.map((t) => t.x)),
          maxX = Math.max(...hull.map((t) => t.x)),
          center = ox + ((minX + maxX + 1) * TILE) / 2;
        g.fillStyle(0x0e333c, 0.3);
        g.fillEllipse(
          center,
          SHIP_Y + low * TILE + 3,
          (maxX - minX + 1) * TILE * 0.9,
          15,
        );
        for (const t of hull) {
          if (occupied.has(`${t.x}:${t.y + 1}`)) continue;
          g.lineStyle(1, 0xb9d6bd, 0.4);
          g.lineBetween(
            ox + t.x * TILE + 3,
            SHIP_Y + (t.y + 1) * TILE + 1,
            ox + (t.x + 1) * TILE - 2,
            SHIP_Y + (t.y + 1) * TILE + 2,
          );
        }
      }
    }
    // Bent cloth contours, seams, rigging and contrasting mast light create depth.
    this.rect(g, mast - 4, 108, 9, 264, 0x342f29);
    this.rect(g, mast - 2, 109, 3, 263, 0xa28254);
    this.rect(g, ox + 5 * TILE, 154, 181, 5, 0x403329);
    this.rect(g, ox + 5 * TILE, 154, 181, 1, 0xb79a68);
    const cloth: Phaser.Types.Math.Vector2Like[] = [];
    const left = ox + 5 * TILE,
      right = ox + 15 * TILE;
    cloth.push({ x: left, y: 160 }, { x: right, y: 160 });
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      cloth.push({ x: right - 12 * Math.sin(Math.PI * t), y: 160 + 137 * t });
    }
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      cloth.push({
        x: right + (left - right) * t,
        y: 297 - 12 * Math.sin(Math.PI * t),
      });
    }
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      cloth.push({ x: left + 10 * Math.sin(Math.PI * t), y: 297 - 137 * t });
    }
    g.fillStyle(friendly ? 0xe7d7ac : 0x34484c);
    g.fillPoints(cloth, true);
    g.lineStyle(2, friendly ? 0xb4a078 : 0x172b32);
    g.strokePoints(cloth, true);
    g.fillStyle(friendly ? 0x9e805a : 0x132730, 0.16);
    g.fillPoints(
      [
        { x: right - 20, y: 162 },
        { x: right - 5, y: 162 },
        { x: right - 16, y: 280 },
        { x: right - 3, y: 297 },
        { x: right - 31, y: 293 },
      ],
      true,
    );
    g.fillStyle(0xffedc5, friendly ? 0.24 : 0.04);
    g.fillPoints(
      [
        { x: left + 13, y: 162 },
        { x: left + 48, y: 162 },
        { x: left + 55, y: 280 },
        { x: left + 18, y: 290 },
      ],
      true,
    );
    // Narrow fabric panels and sunlit hem, avoiding a flat triangular sail.
    for (let i = 1; i < 5; i++) {
      const x = left + ((right - left) * i) / 5;
      g.lineStyle(1, friendly ? 0xcbb991 : 0x4d6465, 0.65);
      g.lineBetween(x, 162, x + 3 * Math.sin(i), 287);
    }
    g.lineStyle(2, 0xf1dfb7, 0.7);
    g.lineBetween(left + 3, 162, right - 3, 162);
    g.lineStyle(1, 0xb2a381, 0.8);
    g.lineBetween(mast, 111, ox + TILE, SHIP_Y + 4 * TILE);
    g.lineBetween(mast, 111, ox + 17 * TILE, SHIP_Y + 4 * TILE);
    g.lineBetween(left, 155, ox + 3 * TILE, SHIP_Y + 4 * TILE);
    g.lineBetween(right, 155, ox + 16 * TILE, SHIP_Y + 4 * TILE);
    // A small skull emblem uses rounded eye sockets and bones.
    g.fillStyle(friendly ? 0x687366 : 0xd6ccad);
    g.fillEllipse(mast, 219, 32, 27);
    this.rect(g, mast - 11, 225, 22, 9, friendly ? 0x687366 : 0xd6ccad);
    g.fillStyle(friendly ? 0xe7d7ac : 0x34484c);
    g.fillCircle(mast - 7, 218, 4);
    g.fillCircle(mast + 7, 218, 4);
    for (let x = -6; x <= 6; x += 6)
      this.rect(g, mast + x - 1, 229, 2, 5, friendly ? 0xe7d7ac : 0x34484c);
    g.lineStyle(3, friendly ? 0x687366 : 0xd6ccad);
    g.lineBetween(mast - 18, 244, mast + 18, 254);
    g.lineBetween(mast - 18, 254, mast + 18, 244);
    g.fillStyle(friendly ? 0xa85746 : 0x27343c);
    g.fillPoints(
      [
        { x: mast + 4, y: 111 },
        { x: mast + 49, y: 113 },
        { x: mast + 38, y: 122 },
        { x: mast + 49, y: 130 },
        { x: mast + 4, y: 127 },
      ],
      true,
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
        const exposed = !occupied.has(`${t.x}:${t.y - 1}`),
          bottom = !occupied.has(`${t.x}:${t.y + 1}`);
        const leftEdge = !occupied.has(`${t.x - 1}:${t.y}`),
          rightEdge = !occupied.has(`${t.x + 1}:${t.y}`);
        const tone = friendly
          ? t.y % 2
            ? 0x70513c
            : 0x856044
          : t.y % 2
            ? 0x453d35
            : 0x655045;
        g.fillStyle(tone);
        g.fillPoints(
          [
            { x, y },
            { x: x + TILE, y },
            { x: x + TILE, y: y + TILE - (bottom && rightEdge ? 6 : 0) },
            { x: x + TILE - (bottom && rightEdge ? 5 : 0), y: y + TILE },
            { x: x + (bottom && leftEdge ? 5 : 0), y: y + TILE },
            { x, y: y + TILE - (bottom && leftEdge ? 6 : 0) },
          ],
          true,
        );
        if (exposed) {
          this.rect(g, x, y, TILE, 3, 0xc1a073);
          this.rect(g, x, y + 3, TILE, 2, 0x382e28);
        }
        this.rect(g, x, y + 9, TILE, 1, 0x49392e);
        if ((t.x + t.y) % 3 === 0) this.rect(g, x + 8, y + 2, 1, 6, 0x49392e);
        if ((t.x + t.y) % 3 === 1) this.rect(g, x + 3, y + 10, 1, 7, 0x3d302b);
        for (let i = 0; i < 2; i++) {
          const grain = (t.x * 13 + t.y * 7 + i * 5) % 12;
          this.rect(g, x + grain, y + 5 + i * 8, 4, 1, 0xb48b5e, 0.3);
        }
        if (bottom) {
          this.rect(g, x + 3, y + TILE - 2, TILE - 6, 2, 0x312e2b);
        }
      }
    }
    for (const tx of [7, 10, 13])
      if (occupied.has(`${tx}:5`)) {
        const x = ox + tx * TILE + 9,
          y = SHIP_Y + 5 * TILE + 8;
        g.fillStyle(0x332f28);
        g.fillCircle(x, y, 4);
        g.lineStyle(1, 0xb3925d);
        g.strokeCircle(x, y, 4);
        g.fillStyle(0x416768);
        g.fillCircle(x, y, 2);
      }
    for (const station of ship.id === 1
      ? (this.host.draftStations() ?? ship.stations)
      : ship.stations) {
      const x = ox + station.x * TILE,
        y = SHIP_Y + (station.y + 1) * TILE;
      if (station.kind === "cannon") {
        g.fillStyle(0x1e2d33);
        g.fillRoundedRect(x - 4, y - 17, 34, 11, 4);
        this.rect(g, x - 1, y - 16, 29, 2, 0x859794);
        this.rect(g, x + 26, y - 17, 5, 11, 0x13232b);
        this.rect(g, x, y - 8, 24, 5, 0x76523a);
        this.rect(g, x + 2, y - 7, 20, 1, 0xc39a62);
        for (const wheel of [x + 3, x + 21]) {
          g.fillStyle(0x282b2a);
          g.fillCircle(wheel, y - 3, 5);
          g.lineStyle(1, 0xa08059);
          g.strokeCircle(wheel, y - 3, 3);
          g.fillStyle(0xd2b47b);
          g.fillCircle(wheel, y - 3, 1);
        }
      }
      if (station.kind === "food") {
        g.fillStyle(0x3a342b);
        g.fillEllipse(x + 8, y - 1, 20, 4);
        g.fillStyle(0x846344);
        g.fillRoundedRect(x, y - 20, 17, 20, 5);
        g.fillStyle(0xb49665);
        g.fillEllipse(x + 8.5, y - 18, 16, 5);
        g.lineStyle(1, 0x514332);
        g.strokeEllipse(x + 8.5, y - 18, 16, 5);
        g.lineBetween(x + 5, y - 15, x + 5, y - 3);
        g.lineBetween(x + 11, y - 15, x + 11, y - 3);
        this.rect(g, x, y - 13, 17, 2, 0x3b4b47);
        this.rect(g, x, y - 5, 17, 2, 0x3b4b47);
        this.rect(g, x + 1, y - 13, 15, 1, 0x899486);
      }
      if (station.kind === "medical") {
        g.fillStyle(0x524237);
        g.fillRoundedRect(x + 5, y - 21, 10, 7, 2);
        g.fillStyle(0xd1c49c);
        g.fillRoundedRect(x - 1, y - 17, 22, 17, 3);
        this.rect(g, x, y - 4, 20, 3, 0xa08b66);
        this.rect(g, x + 2, y - 15, 2, 14, 0x917451);
        this.rect(g, x + 16, y - 15, 2, 14, 0x917451);
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
      this.seenEnemyRevision !== (s.ships[1]?.revision ?? -1) ||
      this.seenPhase !== s.phase ||
      this.seenLocation !== s.location ||
      this.draftRef !== draft ||
      this.stationRef !== this.host.draftStations()
    ) {
      this.drawScenery();
      this.seenRevision = s.ships[0].revision;
      this.seenEnemyRevision = s.ships[1]?.revision ?? -1;
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
        for (const t of ship.tiles) {
          if (!(t.damage ?? 0) || !intact(t)) continue;
          const x = ox + t.x * TILE,
            y = SHIP_Y + t.y * TILE;
          g.lineStyle(2, (t.damage ?? 0) >= 80 ? 0xc36c48 : 0x332f29);
          g.lineBetween(x + 3, y + 2, x + 10, y + 8);
          g.lineBetween(x + 10, y + 8, x + 4, y + 15);
        }
        if (
          ship.hp < ship.maxHp &&
          !ship.tiles.some((t) => (t.damage ?? 0) > 0)
        ) {
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
            PIRATE_FRAMES.idle[pirateVariant(p)],
          )
          .setScale(1)
          .setOrigin(0.5, 1);
        this.actors.set(p.id, actor);
      }
      const x =
        (p.shipId === 1 ? HOME_X : ENEMY_X) +
        (p.previousX + (p.x - p.previousX) * alpha) * TILE +
        9;
      let y = SHIP_Y + (p.previousY + (p.y - p.previousY) * alpha + 1) * TILE;
      const next = p.path[0];
      if (next !== undefined && Math.abs(p.y - nodeY(next)) < 0.01) {
        const gx = nodeX(next),
          gapX = gx + (p.x < gx ? -1 : 1),
          ship = s.ships.find((t) => t.id === p.shipId);
        if (
          Math.abs(p.x - gx) <= 2 &&
          ship?.tiles.some((t) => t.x === gapX && t.y === p.y + 1 && !intact(t))
        ) {
          y -= Math.sin((Math.PI * Math.abs(p.x - gx)) / 2) * 12;
        }
      }
      actor.setPosition(Math.round(x), Math.round(y));
      const moving =
        Math.abs(p.x - p.previousX) + Math.abs(p.y - p.previousY) > 0.001;
      const reducedMotion = this.host.reducedMotion();
      const walking = moving && !reducedMotion && Math.floor(s.tick / 5) % 2;
      const blinking =
        !moving && !reducedMotion && (s.tick + p.id * 11) % 110 < 3;
      const frames = walking
        ? PIRATE_FRAMES.walk
        : blinking
          ? PIRATE_FRAMES.blink
          : PIRATE_FRAMES.idle;
      const frame = frames[pirateVariant(p)];
      if (actor.frame.name !== frame) actor.setFrame(frame);
      actor.setFlipX(
        moving
          ? p.x < p.previousX
          : p.targetId !== null &&
              s.pirates.some((t) => t.id === p.targetId && t.x < p.x),
      );
      if (this.host.selected().includes(p.id)) {
        g.lineStyle(2, 0xe8d394);
        g.strokeEllipse(x, y + 1, 25, 6);
      }
      this.rect(g, x - 13, y - 42, 26, 3, 0x203b40);
      this.rect(
        g,
        x - 13,
        y - 42,
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
        i % 3 === 0 ? 0.12 : 0.05,
      );
    }
    if (!this.host.reducedMotion())
      for (let i = 0; i < this.clouds.length; i++)
        this.clouds[i].x = ((80 + i * 420 + _time * 0.002) % 1400) - 70;
  }
}
