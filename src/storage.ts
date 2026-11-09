import { verifyRun, type ExperimentRun } from "./experiments";
import { type ResearchBoard } from "./research";
import {
  initialNarrative,
  emptyNarrative,
  startLevel,
  validNarrative,
  type NarrativeState,
} from "./narrative/events";
import { createState, balance, mass, type State } from "./engine";
import { modelVersion, oxides, minerals } from "./data";
export type RecordEntry = {
  id: string;
  name: string;
  kind: "chamber" | "liquid" | "cumulate";
  state: State;
  date: string;
  run?: ExperimentRun;
};
export type Save = {
  version: 1;
  runs?: ExperimentRun[];
  research?: ResearchBoard;
  narrative: NarrativeState;
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
    !["A", "B", "C", "D", "E", "free"].includes(s.level) ||
    s.states.length !== 2 ||
    !s.states.every(validState) ||
    !Array.isArray(s.records) ||
    !s.records.every(
      (r) =>
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        typeof r.date === "string" &&
        ["chamber", "liquid", "cumulate"].includes(r.kind) &&
        validState(r.state) &&
        (!r.run || verifyRun(r.run, r.state)),
    ) ||
    !Array.isArray(s.completed)
  )
    throw new Error("存档格式或模型版本不兼容");
  if (
    s.runs &&
    (s.runs.length !== 2 ||
      !s.runs.every((run, i) => verifyRun(run, s.states[i])))
  )
    throw Error("实验操作日志与库存不一致");
  if (
    s.research &&
    (typeof s.research !== "object" ||
      Object.values(s.research).some(
        (id) => typeof id !== "string" || !s.records.some((r) => r.id === id),
      ))
  )
    throw Error("研究板引用了缺失记录");
  if (!s.narrative) s.narrative = startLevel(emptyNarrative(), s.level);
  if (!validNarrative(s.narrative)) throw new Error("叙事存档格式不兼容");
  return s;
}
export function initialSave(): Save {
  return {
    version: 1,
    narrative: initialNarrative(),
    level: "A",
    states: [createState("basalt", "A"), createState("basalt", "B")],
    records: [],
    completed: [],
  };
}
