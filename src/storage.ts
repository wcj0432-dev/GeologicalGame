import { createState, balance, mass, type State } from "./engine";
import { modelVersion, oxides, minerals } from "./data";
export type RecordEntry = {
  id: string;
  name: string;
  kind: "chamber" | "liquid" | "cumulate";
  state: State;
  date: string;
};
export type Save = {
  version: 1;
  level: string;
  states: State[];
  records: RecordEntry[];
  completed: string[];
};
export const saveKey = "petrogenesis-v1";
export function validState(s: State): boolean {
  try {
    return (
      s.version === modelVersion &&
      typeof s.id === "string" &&
      typeof s.source === "string" &&
      Math.abs(mass(s.initial) - 100) < 1e-8 &&
      balance(s).every((r) => Math.abs(r.error) < 1e-8) &&
      Number.isFinite(s.temperature) &&
      s.temperature >= 650 &&
      s.temperature <= 1300 &&
      [
        s.initial,
        s.liquid,
        ...minerals.flatMap((m) => [s.crystals[m.id], s.removed[m.id]]),
      ].every((c) =>
        oxides.every((o) => Number.isFinite(c[o]) && c[o] >= -1e-8),
      ) &&
      Array.isArray(s.history) &&
      Array.isArray(s.events) &&
      Array.isArray(s.path)
    );
  } catch {
    return false;
  }
}
export function encode(s: Save) {
  return JSON.stringify(s);
}
export function decode(raw: string): Save {
  const s = JSON.parse(raw) as Save;
  if (
    s.version !== 1 ||
    !["A", "B", "C", "D", "free"].includes(s.level) ||
    s.states.length !== 2 ||
    !s.states.every(validState) ||
    !Array.isArray(s.records) ||
    !s.records.every(
      (r) =>
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        typeof r.date === "string" &&
        ["chamber", "liquid", "cumulate"].includes(r.kind) &&
        validState(r.state),
    ) ||
    !Array.isArray(s.completed)
  )
    throw new Error("存档格式或模型版本不兼容");
  return s;
}
export function initialSave(): Save {
  return {
    version: 1,
    level: "A",
    states: [createState("basalt", "A"), createState("basalt", "B")],
    records: [],
    completed: [],
  };
}
