import {
  chemistry,
  minerals,
  modelVersion,
  oxides,
  sources,
  zero,
  type Chemistry,
  type Mineral,
} from "./data";
export type Inventory = Record<Mineral, Chemistry>;
export type Snapshot = {
  temperature: number;
  liquid: number;
  solid: number;
  removed: number;
  composition: Chemistry;
  mineralMass: number[];
};
export type State = {
  id: string;
  source: string;
  version: string;
  initial: Chemistry;
  liquid: Chemistry;
  crystals: Inventory;
  removed: Inventory;
  temperature: number;
  pressure: number;
  path: { temperature: number; rate: "fast" | "slow" }[];
  history: Snapshot[];
  events: string[];
};
export const mass = (c: Chemistry) => oxides.reduce((s, o) => s + c[o], 0);
export const inventoryMass = (inv: Inventory) =>
  minerals.reduce((s, m) => s + mass(inv[m.id]), 0);
export const percent = (c: Chemistry): Chemistry =>
  chemistry(oxides.map((o) => (mass(c) > 1e-9 ? (c[o] / mass(c)) * 100 : 0)));
const inventory = (): Inventory =>
  Object.fromEntries(minerals.map((m) => [m.id, zero()])) as Inventory;
export function snapshot(s: State): Snapshot {
  return {
    temperature: s.temperature,
    liquid: mass(s.liquid),
    solid: inventoryMass(s.crystals),
    removed: inventoryMass(s.removed),
    composition: percent(s.liquid),
    mineralMass: minerals.map(
      (m) => mass(s.crystals[m.id]) + mass(s.removed[m.id]),
    ),
  };
}
export function createState(
  source = "basalt",
  id = "A",
  composition?: Chemistry,
): State {
  const initial =
    composition ??
    chemistry((sources.find((s) => s.id === source) ?? sources[0]).composition);
  if (
    oxides.some((o) => !Number.isFinite(initial[o]) || initial[o] < 0) ||
    Math.abs(mass(initial) - 100) > 1e-6
  )
    throw new Error("组成必须包含八种非负氧化物且总和为100 wt.%");
  const s: State = {
    id,
    source,
    version: modelVersion,
    initial: { ...initial },
    liquid: { ...initial },
    crystals: inventory(),
    removed: inventory(),
    temperature: 1300,
    pressure: 0.1,
    path: [],
    history: [],
    events: ["初始化 · 100 kg 无水教学岩浆"],
  };
  s.history.push(snapshot(s));
  return s;
}
function transfer(
  from: Chemistry,
  to: Chemistry,
  amount: number,
  fractions: Chemistry,
) {
  for (const o of oxides) {
    const delta = amount * fractions[o];
    from[o] -= delta;
    to[o] += delta;
  }
}
export function cool(
  input: State,
  target: number,
  rate: "fast" | "slow" = "slow",
): State {
  if (!Number.isFinite(target) || target < 650 || target > input.temperature)
    throw new Error("本模型仅支持650–1300°C单向冷却");
  const s: State = structuredClone(input);
  while (s.temperature > target + 1e-8) {
    const dt = Math.min(5, s.temperature - target);
    s.temperature -= dt;
    // Retained solids undergo limited exchange; separated solids cannot exchange.
    for (const m of minerals) {
      const c = s.crystals[m.id];
      const amount = (mass(c) * 0.015 * dt) / 5;
      if (amount > 0)
        transfer(
          c,
          s.liquid,
          amount,
          chemistry(oxides.map((o) => c[o] / mass(c))),
        );
    }
    const p = percent(s.liquid);
    const onsets = [
      1120 + 10 * p.MgO + 2 * p.FeO,
      1040 + 6 * p.CaO + 3 * p.MgO,
      1030 + 4 * p.Al2O3 + 3 * p.CaO - 2 * p.Na2O,
    ];
    const weights = minerals.map(
      (m, i) =>
        Math.max(0, Math.min(1, (onsets[i] - s.temperature) / 100)) *
        (i === 0 ? p.MgO / 8 : i === 1 ? p.CaO / 12 : p.Al2O3 / 16),
    );
    const budget = Math.min((mass(s.liquid) * 0.035 * dt) / 5, (1.25 * dt) / 5);
    const wsum = weights.reduce((a, b) => a + b, 0);
    minerals.forEach((m, i) => {
      const x = chemistry(m.composition.map((v) => v / 100));
      const limit = Math.min(
        ...oxides
          .filter((o) => x[o] > 0)
          .map((o) => Math.max(0, s.liquid[o]) / x[o]),
      );
      const amount = Math.min(limit, wsum ? (budget * weights[i]) / wsum : 0);
      if (amount > 1e-10) {
        const first = mass(s.crystals[m.id]) + mass(s.removed[m.id]) < 1e-8;
        transfer(s.liquid, s.crystals[m.id], amount, x);
        if (first)
          s.events.push(`${s.temperature.toFixed(0)}°C · 首次观察到${m.name}`);
      }
    });
    s.path.push({ temperature: s.temperature, rate });
    s.history.push(snapshot(s));
  }
  return s;
}
export function separate(
  input: State,
  mineral: Mineral,
  fraction: number,
): State {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw new Error("分离比例必须在0–1之间");
  const s = structuredClone(input);
  const amount = mass(s.crystals[mineral]) * fraction;
  if (amount > 0)
    transfer(
      s.crystals[mineral],
      s.removed[mineral],
      amount,
      chemistry(
        oxides.map((o) => s.crystals[mineral][o] / mass(s.crystals[mineral])),
      ),
    );
  s.events.push(
    `分离${minerals.find((m) => m.id === mineral)!.name} ${amount.toFixed(2)} kg`,
  );
  s.history.push(snapshot(s));
  return s;
}
export function balance(s: State) {
  return oxides
    .map((o) => ({
      oxide: o,
      initial: s.initial[o],
      liquid: s.liquid[o],
      solid: minerals.reduce((v, m) => v + s.crystals[m.id][o], 0),
      removed: minerals.reduce((v, m) => v + s.removed[m.id][o], 0),
    }))
    .map((r) => ({ ...r, error: r.initial - r.liquid - r.solid - r.removed }));
}
export function chamber(s: State): Chemistry {
  return chemistry(
    oxides.map(
      (o) =>
        s.liquid[o] + minerals.reduce((v, m) => v + s.crystals[m.id][o], 0),
    ),
  );
}
export function rock(s: State) {
  const comp = percent(chamber(s));
  const solid = inventoryMass(s.crystals);
  const texture =
    s.path.length &&
    s.path.filter((p) => p.rate === "slow").length / s.path.length > 0.7
      ? "粗粒"
      : "细粒";
  const mafic =
    comp.SiO2 >= 45 &&
    comp.SiO2 <= 53 &&
    comp.MgO + comp.FeO >= 12 &&
    comp.CaO >= 7 &&
    solid > 5 &&
    mass(s.crystals.plagioclase) > 0;
  const name =
    s.temperature > 700
      ? "结晶中的岩浆"
      : mafic
        ? texture === "粗粒"
          ? "辉长质岩石"
          : "玄武质岩石"
        : "演化结晶岩（描述性分类）";
  return { name, texture, composition: comp, glass: mass(s.liquid), solid };
}
