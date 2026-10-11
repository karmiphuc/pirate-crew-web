import { WEAPONS, type Pirate, type Campaign, type Weapon } from "../sim/model";
import { ACCESSORY_KINDS, ITEMS } from "../sim/items";
import { itemIcon } from "./item-icons";
import { attackDamage } from "../sim/progression";

export function loadoutMarkup(p: Pirate, s: Campaign) {
  const port = s.phase === "port" && p.hp > 0;
  const melee = p.meleeWeapon,
    ranged = p.rangedWeapon,
    accessory = p.accessory;
  const slot = (
    label: string,
    key: string,
    gear: Weapon | "boots" | "diaper" | null,
    canStow: boolean,
  ) =>
    `<article class="loadout-slot" data-slot="${key}"><span class="slot-label">${label}</span>${gear ? itemIcon(gear) : '<span class="empty-slot" aria-hidden="true">＋</span>'}<h4>${gear ? (gear in WEAPONS ? WEAPONS[gear as Weapon].name : ITEMS[gear as "boots" | "diaper"].name) : "Empty slot"}</h4><p>${gear === "boots" || gear === "diaper" ? (gear === "boots" ? "+25% deck movement" : "No home-deck dirt") : gear ? `${attackDamage(p, gear as Weapon)} damage · ${WEAPONS[gear as Weapon].range} range` : "Choose gear below"}</p><button data-action="${key === "accessory" ? "equip-accessory" : "stow-weapon"}" data-id="${p.id}" data-kind="${key === "accessory" ? "none" : key}" ${port && canStow ? "" : "disabled"}>Stow ${label.toLowerCase()}</button></article>`;
  return `<h3>Carried equipment</h3><div class="loadout-grid">${slot("Melee", "melee", melee, !!melee && !!ranged)}${slot("Ranged", "ranged", ranged, !!melee && !!ranged)}${slot("Accessory", "accessory", accessory, !!accessory)}</div><p class="loadout-hand">In hand: <strong>${WEAPONS[p.weapon].name}</strong> · In combat, nearby foes use melee; distant foes use ranged gear.</p><h3>Personal weapon locker</h3><div class="settings-grid">${Object.entries(
    WEAPONS,
  )
    .map(([key, w]) => {
      const equipped = key === melee || key === ranged;
      return `<button data-action="equip" data-id="${p.id}" data-kind="${key}" ${!port || equipped ? "disabled" : ""}>${w.name} · ${equipped ? "Equipped" : p.ownedWeapons.includes(key as Weapon) ? "Equip owned" : key !== "cutlass" && s.itemStock[key as "sabre" | "pistol"] > 0 ? "Equip from hold" : `${w.price} gold`}<small>${w.range > 2 ? "Ranged slot" : "Melee slot"} · ${attackDamage(p, key as Weapon)} damage</small></button>`;
    })
    .join(
      "",
    )}<button data-action="armor" data-id="${p.id}" ${!port || p.armor >= 8 ? "disabled" : ""}>Armor · ${p.armor}/8 protection<small>Upgrade +4 · 50 gold</small></button></div><h3>Personal accessories</h3><div class="accessory-grid">${ACCESSORY_KINDS.map((kind) => `<article>${itemIcon(kind)}<div><strong>${ITEMS[kind].name}</strong><p>${kind === "boots" ? "Walk and climb 25% faster." : "Adds no dirt to the home deck."}</p><button data-action="equip-accessory" data-id="${p.id}" data-kind="${kind}" ${!port || accessory === kind ? "disabled" : ""}>${accessory === kind ? "Equipped" : p.ownedAccessories.includes(kind) ? "Equip owned" : s.itemStock[kind] > 0 ? "Equip from hold" : `Buy & equip · ${ITEMS[kind].price} gold`}</button></div></article>`).join("")}</div><p class="muted">Each slot is independent. Stowed gear stays in this pirate’s locker; shared hold items transfer only on first equip. Keep at least one weapon carried. Gear changes require port.</p>`;
}
