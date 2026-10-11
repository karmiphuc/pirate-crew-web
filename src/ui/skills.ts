import { SKILLS, type Campaign, type Pirate } from "../sim/model";
import {
  SKILL_NAMES,
  SKILL_RANK_CAP,
  BOOK_PRICE,
  BOOK_STOCK_CAP,
  skillEffect,
} from "../sim/skills";

// Original integer-pixel book cover, sharing the existing inventory icon style.
function bookIcon() {
  return '<svg class="item-icon" viewBox="0 0 28 28" aria-hidden="true" shape-rendering="crispEdges"><path fill="#20383c" d="M5 3h18v20H4V5h1z"/><path fill="#477267" d="M7 5h14v15H7z"/><path fill="#ead7a6" d="M6 20h15v2H6z"/><path fill="#d1a05c" d="M5 5h2v15H5zM11 9h6v2h-6zM11 13h6v1h-6z"/></svg>';
}

export function bookHoldMarkup(p: Pirate | undefined, s: Campaign) {
  const owned = SKILLS.filter((k) => s.bookStock[k] > 0);
  return `<h3>Stored skill books</h3>${owned.length ? `<div class="hold-grid">${owned.map((k) => `<article class="hold-item" data-book="${k}">${bookIcon()}<div><h3>${SKILL_NAMES[k]}<span class="item-count">× ${s.bookStock[k]}</span></h3><p>Reading spends one matching book and one training point in port.</p><button data-action="crew-settings" aria-label="Read ${SKILL_NAMES[k]} in the crew inspector" ${p ? "" : "disabled"}>Read in crew inspector</button></div></article>`).join("")}</div>` : "<p>No skill books stored. Buy books at the harbour market, or buy and read them in the crew inspector.</p>"}`;
}

export function skillsMarkup(p: Pirate, s: Campaign) {
  const port = s.phase === "port" && p.hp > 0;
  return `<h3>Skill books · ${p.trainingPoints} TP available</h3><p>Reading a book spends one training point. Use a matching book from the hold, or buy and read one for ${BOOK_PRICE} gold. Completed crew jobs earn experience; each level earns four points.</p><div class="duty-grid skill-grid">${SKILLS.map(
    (k) => {
      const rank = p.skillRanks[k],
        stock = s.bookStock[k],
        cost = stock > 0 ? "1 TP + owned book" : `1 TP + ${BOOK_PRICE} gold`,
        enabled =
          port &&
          p.trainingPoints > 0 &&
          rank < SKILL_RANK_CAP &&
          (stock > 0 || s.gold >= BOOK_PRICE);
      return `<article class="duty-item" data-skill="${k}"><strong>${SKILL_NAMES[k]} <span class="skill-rank">${rank ? `Rank ${rank} / ${SKILL_RANK_CAP}` : "Unlearned"}</span></strong><p>${skillEffect(k)}.</p><small>${stock} matching book${stock === 1 ? "" : "s"} in hold</small><button data-action="${rank ? "train-skill" : "teach"}" data-id="${p.id}" data-kind="${k}" aria-label="${rank ? "Improve" : "Learn"} ${SKILL_NAMES[k]}, ${cost}" ${enabled ? "" : "disabled"}>${rank >= SKILL_RANK_CAP ? "Maximum rank" : `${rank ? "+1 rank" : "Learn"} · ${cost}`}</button></article>`;
    },
  ).join(
    "",
  )}</div><p class="muted">Improving a learned skill keeps the current duty and orders. Learning a work skill assigns that duty; learning Swimming keeps the current duty.</p>`;
}

export function bookMarketMarkup(s: Campaign) {
  return `<h3>Skill books</h3><p>Keep books in the shared hold, then read them in Duties & equipment. Each reading also needs one training point.</p><div class="shop-grid">${SKILLS.map((k) => `<article class="shop-item">${bookIcon()}<h3>${SKILL_NAMES[k]}</h3><p>${s.bookStock[k]} books in hold</p><button data-action="buy-book" data-kind="${k}" aria-label="Buy ${SKILL_NAMES[k]} book, ${BOOK_PRICE} gold" ${s.phase === "port" && s.gold >= BOOK_PRICE && s.bookStock[k] < BOOK_STOCK_CAP ? "" : "disabled"}>Buy book · ${BOOK_PRICE} gold</button><button data-action="sell-book" data-kind="${k}" aria-label="Sell owned ${SKILL_NAMES[k]} book, ${BOOK_PRICE / 2} gold" ${s.phase === "port" && s.bookStock[k] > 0 ? "" : "disabled"}>Sell owned · ${BOOK_PRICE / 2} gold</button></article>`).join("")}</div>`;
}
