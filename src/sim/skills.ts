import { SKILLS, type Skill, type Pirate } from "./model";

export type SkillRanks = Record<Skill, number>;
export type BookStock = Record<Skill, number>;
export const SKILL_RANK_CAP = 5;
export const BOOK_STOCK_CAP = 99;
export const BOOK_PRICE = 60;
export const SKILL_POINT_COST = 1;
export const SKILL_POINTS_SPENT_CAP = 40; // Eight fixed skills, five ranks each.
export const WORK_UNITS_PER_TICK = 80;
export const SKILL_NAMES: Record<Skill, string> = {
  guard: "Boarding drills",
  cook: "Cooking",
  clean: "Cleaning",
  repair: "Ship repair",
  medic: "Medicine",
  gunner: "Cannon mastery",
  fish: "Fishing",
  swim: "Swimming",
};
export function ranksFor(skills: readonly Skill[]): SkillRanks {
  return Object.fromEntries(
    SKILLS.map((k) => [k, skills.includes(k) ? 1 : 0]),
  ) as SkillRanks;
}
export function emptyBookStock(): BookStock {
  return Object.fromEntries(SKILLS.map((k) => [k, 0])) as BookStock;
}
// Original bounded balance; rank one retains the existing simulation's rates.
export function skillRate(p: Pirate, skill: Skill) {
  return 1 + Math.max(0, p.skillRanks[skill] - 1) / 5;
}
// Exact common denominator for half morale, 5/4 Industrious and fifth-rank steps.
// Integer accumulation prevents a 1.6-rate repair from drifting past tick 50.
export function workUnits(p: Pirate, skill: Skill) {
  return (
    (p.morale < 30 ? 2 : 4) *
    (p.traits.includes("industrious") ? 5 : 4) *
    (4 + Math.max(1, p.skillRanks[skill]))
  );
}
export function skillEffect(skill: Skill) {
  return skill === "guard"
    ? "+1 attack damage per rank above one"
    : skill === "swim"
      ? "+20% swim and rail-climb speed per rank above one"
      : "+20% work rate per rank above one";
}
