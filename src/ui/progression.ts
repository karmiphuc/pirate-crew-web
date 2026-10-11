import type { Campaign, Pirate } from "../sim/model";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_INFO,
  ATTRIBUTE_CAP,
  CREW_GROUPS,
} from "../sim/progression";

export function progressionMarkup(p: Pirate, s: Campaign, open = false) {
  const port = s.phase === "port" && p.hp > 0;
  return `<details class="progression-panel" ${open ? "open" : ""}><summary><span>Attributes & crew group</span><strong>${p.trainingPoints} training point${p.trainingPoints === 1 ? "" : "s"}</strong></summary><div class="progression-content"><p>Earn 4 points per level. Spend one point to raise an attribute in port.</p><div class="attribute-grid">${ATTRIBUTE_KEYS.map((k) => `<article class="attribute-card" data-attribute="${k}"><span class="attribute-code">${k.toUpperCase()}</span><div><h4>${ATTRIBUTE_INFO[k].name}<strong>${p.attributes[k]}<small> / ${ATTRIBUTE_CAP}</small></strong></h4><p>${ATTRIBUTE_INFO[k].effect}</p></div><button data-action="train-attribute" data-id="${p.id}" data-kind="${k}" aria-label="Train ${ATTRIBUTE_INFO[k].name}, one point" ${port && p.trainingPoints > 0 && p.attributes[k] < ATTRIBUTE_CAP && (k !== "vit" || p.maxHp < 1000) ? "" : "disabled"}>+1</button></article>`).join("")}</div><h3>Command group</h3><p>Select a group below the ship, or press 1–4. Groups share direct orders; each pirate keeps their own duty.</p><div class="group-assignment" role="group" aria-label="Assign command group">${CREW_GROUPS.map((g) => `<button class="crew-group" data-group="${g}" data-action="assign-group" data-id="${p.id}" data-kind="${g}" aria-pressed="${p.group === g}" ${!port || p.group === g ? "disabled" : ""}><span aria-hidden="true">⚑</span> Group ${g}${p.group === g ? " · assigned" : ""}</button>`).join("")}</div><p class="muted">Attribute training and group assignments are saved in port.</p></div></details>`;
}
