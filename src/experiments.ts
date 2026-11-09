import { cool, separate, mass, balance, type State } from "./engine";
import { minerals, oxides, modelVersion, type Mineral } from "./data";

export type ExperimentCommand =
  | { kind: "cool"; targetC: number; rate: "fast" | "slow" }
  | { kind: "separate"; mineral: Mineral; fraction: number };
export type ExperimentRun = {
  id: string;
  modelVersion: string;
  initial: State;
  commands: ExperimentCommand[];
  parent?: { runId: string; commandIndex: number };
};
export function beginRun(
  initial: State,
  id: string,
  parent?: ExperimentRun,
): ExperimentRun {
  return {
    id,
    modelVersion: initial.version,
    initial: structuredClone(initial),
    commands: [],
    ...(parent
      ? { parent: { runId: parent.id, commandIndex: parent.commands.length } }
      : {}),
  };
}
export function executeCommand(
  state: State,
  command: ExperimentCommand,
): State {
  if (
    command.kind === "cool" &&
    ["fast", "slow"].includes(command.rate) &&
    command.targetC < state.temperature
  )
    return cool(state, command.targetC, command.rate);
  if (
    command.kind === "separate" &&
    minerals.some((m) => m.id === command.mineral) &&
    command.fraction > 0
  )
    return separate(state, command.mineral, command.fraction);
  throw Error("无法重放：操作或冷却方向无效");
}
export function replay(run: ExperimentRun, count = run.commands.length): State {
  if (
    run.modelVersion !== modelVersion ||
    run.initial.version !== modelVersion ||
    !Array.isArray(run.commands) ||
    run.commands.length > 2000 ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > run.commands.length
  )
    throw Error("重放版本或命令长度不兼容");
  return run.commands
    .slice(0, count)
    .reduce(executeCommand, structuredClone(run.initial));
}
// Compare actual inventories and path, not UI names or chamber letters.
export function sameState(a: State, b: State): boolean {
  return (
    a.version === b.version &&
    Math.abs(a.temperature - b.temperature) < 1e-8 &&
    Math.abs(a.pressure - b.pressure) < 1e-10 &&
    JSON.stringify(a.path) === JSON.stringify(b.path) &&
    [
      a.initial,
      a.liquid,
      ...minerals.flatMap((m) => [a.crystals[m.id], a.removed[m.id]]),
    ].every((v, i) =>
      oxides.every(
        (o) =>
          Math.abs(
            v[o] -
              [
                b.initial,
                b.liquid,
                ...minerals.flatMap((m) => [b.crystals[m.id], b.removed[m.id]]),
              ][i][o],
          ) < 1e-8,
      ),
    )
  );
}
export function verifyRun(run: ExperimentRun, expected: State): boolean {
  try {
    const valid = (s: State) =>
      s.version === modelVersion &&
      Number.isFinite(s.temperature) &&
      s.temperature >= 650 &&
      s.temperature <= 1300 &&
      s.pressure === 0.1 &&
      Array.isArray(s.path) &&
      s.path.every(
        (p) =>
          Number.isFinite(p.temperature) &&
          p.temperature >= 650 &&
          p.temperature <= 1300 &&
          ["fast", "slow"].includes(p.rate),
      ) &&
      Math.abs(mass(s.initial) - 100) < 1e-8 &&
      balance(s).every((r) => Math.abs(r.error) < 1e-8) &&
      [
        s.initial,
        s.liquid,
        ...minerals.flatMap((m) => [s.crystals[m.id], s.removed[m.id]]),
      ].every((c) =>
        oxides.every((o) => Number.isFinite(c[o]) && c[o] >= -1e-8),
      );
    return (
      valid(run.initial) && valid(expected) && sameState(replay(run), expected)
    );
  } catch {
    return false;
  }
}
export function witnesses(run: ExperimentRun) {
  let state = structuredClone(run.initial);
  return run.commands.flatMap((command, i) => {
    const before = state;
    state = executeCommand(before, command);
    return command.kind === "separate"
      ? [
          {
            before,
            after: state,
            commandIndex: i,
            continuedCooling: run.commands
              .slice(i + 1)
              .some((c) => c.kind === "cool" && c.targetC < state.temperature),
          },
        ]
      : [];
  });
}
