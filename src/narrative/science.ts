import {
  mass,
  inventoryMass,
  percent,
  balance,
  chamber,
  rock,
  type State,
} from "../engine";
import { minerals, oxides, labels, type Mineral } from "../data";
export type Focus = "minerals" | "chemistry" | "balance" | "compare";
export type Evidence = {
  title: string;
  summary: string;
  focus: Focus;
  annotations: string[];
};
export function separationEvidence(before: State, after: State): Evidence {
  const moved = inventoryMass(after.removed) - inventoryMass(before.removed);
  const delta = percent(after.liquid).SiO2 - percent(before.liquid).SiO2;
  return {
    title: "分离前后：物质去了哪里？",
    focus: "balance",
    summary: `实际移入堆晶 ${moved.toFixed(3)} kg；液相 ${mass(before.liquid).toFixed(3)} → ${mass(after.liquid).toFixed(3)} kg，SiO₂ ${percent(before.liquid).SiO2.toFixed(3)} → ${percent(after.liquid).SiO2.toFixed(3)} wt.%（差 ${delta.toFixed(3)} 个百分点）。分离移动的是已有固体，不会立即改变液相。`,
    annotations: [
      `房内晶体 ${inventoryMass(before.crystals).toFixed(3)} → ${inventoryMass(after.crystals).toFixed(3)} kg`,
      `堆晶 ${inventoryMass(before.removed).toFixed(3)} → ${inventoryMass(after.removed).toFixed(3)} kg`,
      ...oxides.map(
        (o, i) =>
          `${labels[i]} 转入堆晶 ${minerals.reduce((v, m) => v + after.removed[m.id][o] - before.removed[m.id][o], 0).toFixed(3)} kg`,
      ),
      `全系统最大组分误差 ${Math.max(...balance(after).map((r) => Math.abs(r.error))).toExponential(1)} kg`,
    ],
  };
}
export function mineralEvidence(s: State, id?: Mineral): Evidence {
  const selected = minerals.filter((m) => !id || m.id === id);
  return {
    title: id ? "放大矿物观察" : "女神展开结晶记录",
    focus: "minerals",
    summary: `当前 ${s.temperature}°C，未成晶组分 ${mass(s.liquid).toFixed(2)} kg。曲线为各温度的全系统矿物质量，包含已分离库存；不代表所有岩浆通用的结晶序列。`,
    annotations: selected.map(
      (m) =>
        `${m.name}：房内 ${mass(s.crystals[m.id]).toFixed(3)} kg / 已分离 ${mass(s.removed[m.id]).toFixed(3)} kg`,
    ),
  };
}
export function compareEvidence(states: State[]): Evidence {
  const [a, b] = states,
    delta = Math.abs(percent(a.liquid).SiO2 - percent(b.liquid).SiO2);
  return {
    title: "并列观察：结构与组成",
    focus: "compare",
    summary: `A房 ${a.temperature}°C · ${rock(a).name} · ${rock(a).texture}；B房 ${b.temperature}°C · ${rock(b).name} · ${rock(b).texture}。液相 SiO₂ 相差 ${delta.toFixed(3)} 个百分点。`,
    annotations: oxides.map(
      (o, i) =>
        `${labels[i]} 房内总体：A ${percent(chamber(a))[o].toFixed(3)} / B ${percent(chamber(b))[o].toFixed(3)} wt.%`,
    ),
  };
}
export function failureReason(
  level: string,
  states: State[],
): { kind: string; fact: string } {
  const [a, b] = states;
  if (level === "free")
    return {
      kind: "exploration",
      fact: `自由实验没有胜负目标。A房当前 ${a.temperature}°C、未成晶组分 ${mass(a.liquid).toFixed(2)} kg；先改变一个条件，再保留记录比较。`,
    };
  if (level === "A")
    return a.temperature > 650 || b.temperature > 650
      ? {
          kind: "unfinished",
          fact: "两房尚未都到650°C，当前还不能比较最终结构。",
        }
      : {
          kind: "sameTexture",
          fact: `两房结构分别为${rock(a).texture}与${rock(b).texture}。可以让一房快冷、另一房慢冷；无需改变初始组成。`,
        };
  if (level === "B")
    return {
      kind: "fewMinerals",
      fact: `本房已观察到 ${minerals.filter((m) => mass(a.crystals[m.id]) + mass(a.removed[m.id]) > 0.1).length}/3 种矿物。继续降温，检查曲线与首次出现记录。`,
    };
  if (level === "C")
    return Math.abs(a.temperature - b.temperature) > 1e-6
      ? {
          kind: "temperatureMismatch",
          fact: `A房 ${a.temperature}°C，B房 ${b.temperature}°C。先在相同温度比较，避免把温度差当成分离效应。`,
        }
      : {
          kind: "smallDifference",
          fact: `当前液相 SiO₂ 差 ${Math.abs(percent(a.liquid).SiO2 - percent(b.liquid).SiO2).toFixed(3)} 个百分点。分离后继续冷却，才会影响后续交换路径。`,
        };
  return mass(a.liquid) < 15
    ? {
        kind: "littleMelt",
        fact: `未成晶组分只剩 ${mass(a.liquid).toFixed(2)} kg，目标至少15 kg。过度冷却结晶会减少液相；分离已有固体本身不会消耗液相。`,
      }
    : {
        kind: "products",
        fact: `堆晶 ${inventoryMass(a.removed).toFixed(2)} kg，液相 SiO₂ 相对初始变化 ${(percent(a.liquid).SiO2 - percent(a.initial).SiO2).toFixed(2)} 个百分点。检查早期矿物比例、堆晶质量及熔体条件。`,
      };
}
