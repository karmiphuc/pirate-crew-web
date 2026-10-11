import { drawPixelShip } from "./ship-art";
import { SeaTransit, SHIP_SEPARATION, inWater, seaX } from "../sim/sea";
import Phaser from "phaser";
import {
  paintWeapon,
  WEAPON_FRAMES,
  WEAPON_WIDTH,
  WEAPON_POSES,
  WEAPON_ANIMATIONS,
  WEAPON_ATLAS_HEIGHT,
} from "./equipment-art";
import {
  paintPirate,
  paintGrip,
  GRIP_FRAMES,
  type PirateFrame,
  prepareCharacters,
  characterIndex,
  pirateCharacter,
  PIRATE_WIDTH,
  PIRATE_HEIGHT,
  pirateVariant,
  PIRATE_VARIANTS,
  PIRATE_FRAMES,
} from "./pirate-art";
import { HAND_POSES, WEAPON_GRIPS, type HandPose } from "./weapon-handling";
import {
  Campaign,
  Furniture,
  nodeX,
  nodeY,
  Pirate,
  Ship,
  Station,
  Tile,
  WEAPONS,
} from "../sim/model";
import { intact } from "../sim/navigation";
import { Lifetime } from "../app/lifetime";
export const TILE = 18;
export const HOME_X = 230;
export const ENEMY_X = HOME_X + SHIP_SEPARATION * TILE;
export const SHIP_Y = 300;
export interface ViewHost {
  state(): Campaign;
  selected(): readonly number[];
  seaPosition(id: number): Readonly<SeaTransit> | undefined;
  draft(): Tile[] | null;
  draftStations(): Station[] | null;
  draftFurniture(): Furniture[] | null;
  reducedMotion(): boolean;
  update(delta: number): number;
  click(
    shipId: number,
    x: number,
    y: number,
    pirateId: number | null,
    queue: boolean,
  ): void;
  assetFailed(): void;
  contextLost(): void;
  contextRestored(): void;
}
function createTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists("pirate-equipment")) {
    const texture = scene.textures.createCanvas(
      "pirate-equipment",
      WEAPON_WIDTH * WEAPON_FRAMES.length,
      WEAPON_ATLAS_HEIGHT,
    )!;
    WEAPON_POSES.forEach((pose, row) =>
      WEAPON_FRAMES.forEach((weapon, column) => {
        const x = column * WEAPON_WIDTH,
          y = row * PIRATE_HEIGHT;
        texture.context.save();
        texture.context.translate(x, y);
        paintWeapon(texture.context, weapon, pose);
        texture.context.restore();
        texture.add(
          WEAPON_ANIMATIONS[weapon][pose],
          0,
          x,
          y,
          WEAPON_WIDTH,
          PIRATE_HEIGHT,
        );
      }),
    );
    texture.refresh();
  }
  document.documentElement.style.setProperty(
    "--pirate-equipment",
    `url("${(scene.textures.get("pirate-equipment").getSourceImage() as HTMLCanvasElement).toDataURL()}")`,
  );
  if (!scene.textures.exists("pirate-grips")) {
    const frames = Object.keys(PIRATE_FRAMES) as PirateFrame[];
    const texture = scene.textures.createCanvas(
      "pirate-grips",
      PIRATE_WIDTH * frames.length,
      PIRATE_HEIGHT * 6,
    )!;
    for (let character = 0; character < 6; character++) {
      frames.forEach((frame, column) => {
        const x = column * PIRATE_WIDTH,
          y = character * PIRATE_HEIGHT;
        texture.context.save();
        texture.context.translate(x, y);
        paintGrip(texture.context, character, frame);
        texture.context.restore();
        texture.add(
          GRIP_FRAMES[frame][character],
          0,
          x,
          y,
          PIRATE_WIDTH,
          PIRATE_HEIGHT,
        );
      });
    }
    texture.refresh();
  }
  document.documentElement.style.setProperty(
    "--pirate-grips",
    `url("${(scene.textures.get("pirate-grips").getSourceImage() as HTMLCanvasElement).toDataURL()}")`,
  );
  const needsBodies = [0, 1, 2, 3].some(
    (i) => !scene.textures.exists(`pirate-${i}`),
  );
  const sources = needsBodies
    ? prepareCharacters(
        scene.cache.custom["crew-source"].get("sheet") as HTMLImageElement,
      )
    : [];
  for (let i = 0; i < 4; i++) {
    const key = `pirate-${i}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(
        key,
        PIRATE_WIDTH * Object.keys(PIRATE_FRAMES).length,
        PIRATE_HEIGHT * PIRATE_VARIANTS,
      )!;
      for (let variant = 0; variant < PIRATE_VARIANTS; variant++) {
        let column = 0;
        for (const frame of Object.keys(
          PIRATE_FRAMES,
        ) as (keyof typeof PIRATE_FRAMES)[]) {
          const x = column++ * PIRATE_WIDTH;
          texture.context.save();
          texture.context.translate(x, variant * PIRATE_HEIGHT);
          const character = characterIndex(i, variant);
          paintPirate(texture.context, sources[character], character, frame);
          texture.context.restore();
          texture.add(
            PIRATE_FRAMES[frame][variant],
            0,
            x,
            variant * PIRATE_HEIGHT,
            PIRATE_WIDTH,
            PIRATE_HEIGHT,
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
  scene.cache.custom["crew-source"]?.remove("sheet");
}
export class SeaScene extends Phaser.Scene {
  private scope = new Lifetime();
  private artReady = false;
  private background!: Phaser.GameObjects.Image;
  private scenery!: Phaser.GameObjects.Graphics;
  private waves!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private actors = new Map<number, Phaser.GameObjects.Sprite>();
  private equipment = new Map<number, Phaser.GameObjects.Sprite>();
  private grips = new Map<number, Phaser.GameObjects.Sprite>();
  private seenEnemyRevision = -1;
  private seenRevision = -1;
  private seenPhase = "";
  private seenLocation = -1;
  private draftRef: Tile[] | null = null;
  private stationRef: Station[] | null = null;
  private furnitureRef: Furniture[] | null = null;
  private phaseLabel!: Phaser.GameObjects.Text;
  private shipLabel!: Phaser.GameObjects.Text;
  private enemyLabel!: Phaser.GameObjects.Text;
  private clouds: Phaser.GameObjects.Graphics[] = [];
  constructor(private host: ViewHost) {
    super("sea");
  }
  preload() {
    if ([0, 1, 2, 3].some((i) => !this.textures.exists(`pirate-${i}`))) {
      const cache = this.cache.addCustom("crew-source");
      const file = new Phaser.Loader.FileTypes.ImageFile(this.load, {
        key: "crew-reference",
        url: new URL("./assets/crew-source.png", import.meta.url).href,
      });
      // Decode the large original on the CPU; only the small final atlases reach the GPU.
      file.addToCache = () => {
        cache.add("sheet", file.data);
      };
      this.load.addFile(file);
    }
    if (!this.textures.exists("sea-backdrop"))
      this.load.image(
        "sea-backdrop",
        new URL("./assets/harbour.webp", import.meta.url).href,
      );
  }
  create() {
    this.scope = new Lifetime();
    this.artReady = false;
    const release = () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, release);
      this.events.off(Phaser.Scenes.Events.DESTROY, release);
      this.release();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
    this.events.once(Phaser.Scenes.Events.DESTROY, release);
    const needsBodies = [0, 1, 2, 3].some(
      (i) => !this.textures.exists(`pirate-${i}`),
    );
    if (
      (needsBodies && !this.cache.custom["crew-source"]?.exists("sheet")) ||
      !this.textures.exists("sea-backdrop")
    ) {
      this.cache.custom["crew-source"]?.remove("sheet");
      this.add
        .text(
          640,
          250,
          "Artwork could not load.\nReload to retry; your checkpoint is safe.",
          {
            fontFamily: "monospace",
            fontSize: "20px",
            color: "#fff0c8",
            align: "center",
          },
        )
        .setOrigin(0.5);
      this.host.assetFailed();
      return;
    }
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
        if (Math.abs(p.x - px) < 22 && p.y > py - 60 && p.y < py + 8) {
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
    this.seenRevision = -1;
    this.drawScenery();
    this.artReady = true;
  }
  private release() {
    this.artReady = false;
    this.cache?.custom?.["crew-source"]?.remove("sheet");
    this.scope.dispose();
    for (let i = 0; i < 4; i++)
      document.documentElement.style.removeProperty(`--pirate-${i}`);
    document.documentElement.style.removeProperty("--pirate-equipment");
    document.documentElement.style.removeProperty("--pirate-grips");
    for (const grip of this.grips.values()) grip.destroy();
    this.grips.clear();
    for (const item of this.equipment.values()) item.destroy();
    this.equipment.clear();
    for (const actor of this.actors.values()) actor.destroy();
    this.actors.clear();
    this.clouds.length = 0;
    this.seenRevision = -1;
    this.draftRef = null;
    this.stationRef = null;
    this.furnitureRef = null;
  }
  get counters() {
    return {
      artwork: this.artReady,
      sourceImages: this.cache?.custom?.["crew-source"]?.getKeys().length ?? 0,
      actors: this.actors.size,
      equipment: this.equipment.size,
      grips: this.grips.size,
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
    for (const [index, label] of [this.shipLabel, this.enemyLabel].entries()) {
      const ship = s.ships[index];
      if (!ship) continue;
      const hull = (index === 0 ? (draft ?? ship.tiles) : ship.tiles).filter(
        (t) => t.kind === "hull" && ((index === 0 && draft) || intact(t)),
      );
      if (!hull.length) continue;
      const left = Math.min(...hull.map((t) => t.x));
      const right = Math.max(...hull.map((t) => t.x));
      const bottom = SHIP_Y + (Math.max(...hull.map((t) => t.y)) + 1) * TILE;
      label.setPosition(
        (index === 0 ? HOME_X : ENEMY_X) + ((left + right + 1) * TILE) / 2,
        Math.min(494, Math.max(465, bottom + 16)),
      );
    }
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
    drawPixelShip(
      { rect: (x, y, w, h, color) => this.rect(g, x, y, w, h, color) },
      ship,
      tiles,
      ship.id === 1
        ? (this.host.draftStations() ?? ship.stations)
        : ship.stations,
      ox,
      SHIP_Y,
      TILE,
      draft !== null,
      ship.id === 1
        ? (this.host.draftFurniture() ?? ship.furnishings)
        : ship.furnishings,
    );
  }

  update(_time: number, delta: number) {
    if (!this.artReady) return;
    const alpha = this.host.update(delta),
      s = this.host.state(),
      draft = this.host.draft();
    if (
      this.seenRevision !== s.ships[0].revision ||
      this.seenEnemyRevision !== (s.ships[1]?.revision ?? -1) ||
      this.seenPhase !== s.phase ||
      this.seenLocation !== s.location ||
      this.draftRef !== draft ||
      this.stationRef !== this.host.draftStations() ||
      this.furnitureRef !== this.host.draftFurniture()
    ) {
      this.drawScenery();
      this.seenRevision = s.ships[0].revision;
      this.seenEnemyRevision = s.ships[1]?.revision ?? -1;
      this.seenPhase = s.phase;
      this.seenLocation = s.location;
      this.draftRef = draft;
      this.stationRef = this.host.draftStations();
      this.furnitureRef = this.host.draftFurniture();
    }
    const g = this.overlay;
    g.clear();
    if (s.ships.length > 1) {
      for (const pirate of s.pirates) {
        const crossing = this.host.seaPosition(pirate.id);
        if (crossing?.mode !== "rope") continue;
        const startX = HOME_X + crossing.startX * TILE + 9,
          startY = SHIP_Y + (crossing.startY + 1) * TILE,
          endX =
            HOME_X +
            seaX(crossing.targetShip, nodeX(crossing.targetNode)) * TILE +
            9,
          endY = SHIP_Y + (nodeY(crossing.targetNode) + 1) * TILE;
        g.lineStyle(2, 0xc7b987, 0.85);
        g.beginPath();
        g.moveTo(startX, startY);
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          g.lineTo(
            startX + (endX - startX) * t,
            startY + (endY - startY) * t + Math.sin(Math.PI * t) * 0.6 * TILE,
          );
        }
        g.strokePath();
        break;
      }
    }
    for (const ship of s.ships)
      if (ship.kind === "ship") {
        const ox = ship.id === 1 ? HOME_X : ENEMY_X;
        const label = ship.id === 1 ? this.shipLabel : this.enemyLabel;
        this.rect(g, label.x - 120, label.y + 17, 240, 5, 0x1e3f47);
        this.rect(
          g,
          label.x - 120,
          label.y + 17,
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
        this.equipment.get(p.id)?.destroy();
        this.equipment.delete(p.id);
        this.grips.get(p.id)?.destroy();
        this.grips.delete(p.id);
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
        this.equipment.set(
          p.id,
          this.add.sprite(0, 0, "pirate-equipment", p.weapon).setOrigin(0.5, 1),
        );
        this.grips.set(
          p.id,
          this.add
            .sprite(0, 0, "pirate-grips", GRIP_FRAMES.idle[pirateCharacter(p)])
            .setOrigin(0.5, 1),
        );
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
      const transit = this.host.seaPosition(p.id),
        submerged = inWater(transit);
      if (submerged && !this.host.reducedMotion())
        y += Math.floor(s.tick / 5) % 2;
      actor.setPosition(Math.round(x), Math.round(y));
      if (submerged) {
        actor.setCrop(0, 0, PIRATE_WIDTH, 34);
        g.lineStyle(2, 0x87afb1, 0.9);
        g.lineBetween(x - 15, y - 20, x + 15, y - 20);
      } else actor.setCrop();
      this.equipment
        .get(p.id)!
        .setVisible(!transit && p.status !== "Hauling rescue line");
      this.grips.get(p.id)!.setVisible(!transit);
      if (transit?.rescuerId !== null && transit?.rescuerId !== undefined) {
        const rescuer = s.pirates.find(
          (actor) => actor.id === transit.rescuerId,
        );
        if (rescuer) {
          g.lineStyle(1, 0xe9bf68, 0.8);
          g.lineBetween(
            HOME_X +
              seaX(rescuer.shipId, rescuer.x) * TILE +
              9 +
              (transit.x < seaX(rescuer.shipId, rescuer.x) ? -1 : 1) *
                (HAND_POSES.attack[pirateCharacter(rescuer)][0] -
                  PIRATE_WIDTH / 2),
            SHIP_Y +
              (rescuer.y + 1) * TILE +
              HAND_POSES.attack[pirateCharacter(rescuer)][1] -
              PIRATE_HEIGHT,
            x,
            y - 24,
          );
        }
      }
      const moving =
        Math.abs(p.x - p.previousX) + Math.abs(p.y - p.previousY) > 0.001;
      const reducedMotion = this.host.reducedMotion();
      const walking = moving && !reducedMotion && Math.floor(s.tick / 5) % 2;
      const blinking =
        !moving && !reducedMotion && (s.tick + p.id * 11) % 110 < 3;
      const target =
        p.targetId !== null
          ? s.pirates.find((t) => t.id === p.targetId)
          : undefined;
      const fighting =
        (s.phase === "encounter" || s.phase === "aftermath") &&
        (p.status === "Fighting" || p.status === "Firing pistol");
      const sinceAttack = WEAPONS[p.weapon].cooldown - p.cooldown;
      const pose =
        !reducedMotion && fighting && !moving && p.cooldown > 0
          ? sinceAttack >= 0 && sinceAttack < 3
            ? "attack"
            : target &&
                target.hp > 0 &&
                s.phase === "encounter" &&
                p.cooldown <= 3
              ? "ready"
              : "idle"
          : "idle";
      const handPose: HandPose =
        p.weapon === "pistol" && pose !== "idle"
          ? pose === "ready"
            ? "aim"
            : "fire"
          : pose;
      const bodyPose: PirateFrame =
        p.status === "Hauling rescue line"
          ? "attack"
          : handPose !== "idle"
            ? handPose
            : walking
              ? "walk"
              : blinking
                ? "blink"
                : "idle";
      const frame = PIRATE_FRAMES[bodyPose][pirateVariant(p)];
      if (actor.frame.name !== frame) actor.setFrame(frame);
      if (moving) actor.setFlipX(p.x < p.previousX);
      else if (target && target.hp > 0)
        actor.setFlipX(seaX(target.shipId, target.x) < seaX(p.shipId, p.x));
      const item = this.equipment.get(p.id)!;
      const itemFrame = WEAPON_ANIMATIONS[p.weapon][pose];
      if (item.frame.name !== itemFrame) item.setFrame(itemFrame);
      const character = pirateCharacter(p),
        hand = HAND_POSES[handPose][character],
        reference = HAND_POSES[handPose][0],
        offsetX = hand[0] - reference[0],
        offsetY = hand[1] - reference[1];
      item
        .setPosition(
          actor.x + offsetX * (actor.flipX ? -1 : 1),
          actor.y + offsetY + (walking ? 1 : 0),
        )
        .setFlipX(actor.flipX);
      const grip = this.grips.get(p.id)!,
        gripFrame = GRIP_FRAMES[bodyPose][character];
      if (grip.frame.name !== gripFrame) grip.setFrame(gripFrame);
      grip.setPosition(actor.x, actor.y).setFlipX(actor.flipX);
      if (pose === "attack" && p.weapon === "pistol" && sinceAttack === 0) {
        const direction = actor.flipX ? -1 : 1,
          anchor = WEAPON_GRIPS.fire,
          muzzleX = item.x + direction * (anchor[0] + 12 - WEAPON_WIDTH / 2),
          muzzleY = item.y + anchor[1] - 5 - PIRATE_HEIGHT;
        this.rect(g, muzzleX, muzzleY, 3, 2, 0xffe1b0);
        this.rect(g, muzzleX + direction * 3, muzzleY - 1, 2, 4, 0xe9bf68);
      }
      if (this.host.selected().includes(p.id)) {
        g.lineStyle(2, 0xe8d394);
        g.strokeEllipse(x, y + (submerged ? -19 : 1), 25, 6);
      }
      this.rect(g, x - 13, y - 60, 26, 3, 0x203b40);
      this.rect(
        g,
        x - 13,
        y - 60,
        (26 * p.hp) / p.maxHp,
        3,
        p.side === "enemy" ? 0xc77865 : 0x9fc288,
      );
    }
    for (const [id, actor] of this.actors)
      if (!s.pirates.some((p) => p.id === id && p.hp > 0)) {
        actor.destroy();
        this.actors.delete(id);
        this.equipment.get(id)?.destroy();
        this.equipment.delete(id);
        this.grips.get(id)?.destroy();
        this.grips.delete(id);
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
