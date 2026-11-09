import { describe, it, expect } from "vitest";
import {
  beginRun,
  executeCommand,
  replay,
  verifyRun,
  type ExperimentCommand,
} from "./experiments";
import { createState } from "./engine";
import { evaluateResearch, type ResearchBoard } from "./research";
import { decode, encode, initialSave, type RecordEntry } from "./storage";
const cooling = (
  targetC: number,
  rate: "fast" | "slow" = "slow",
): ExperimentCommand => ({ kind: "cool", targetC, rate });
function record(
  id: string,
  commands: ExperimentCommand[],
  kind: RecordEntry["kind"] = "liquid",
  initial = createState(),
): RecordEntry {
  const run = { ...beginRun(initial, id), commands };
  return { id, name: id, kind, run, state: replay(run), date: "test" };
}
function submission(t = 1100, f = 1) {
  const records = [
    record("fine", [cooling(650, "fast")], "chamber"),
    record("coarse", [cooling(650)], "chamber"),
    record("retained", [cooling(1000)]),
    record("separated", [
      cooling(t),
      { kind: "separate", mineral: "olivine", fraction: f },
      { kind: "separate", mineral: "pyroxene", fraction: f },
      cooling(1000),
    ]),
  ];
  const board: ResearchBoard = {
    textureA: "fine",
    textureB: "coarse",
    retained: "retained",
    separated: "separated",
    candidate: "separated",
  };
  return { records, board };
}
describe("可重放证据与多解关卡", () => {
  it.each([
    [1100, 1],
    [1150, 0.75],
  ])("独立可行路径：%s°C，分离%s", (t, f) => {
    const { records, board } = submission(t, f);
    expect(evaluateResearch(board, records).passed).toBe(true);
    records.forEach((r) => expect(verifyRun(r.run!, r.state)).toBe(true));
  });
  it("仅改变速度不能伪装成分离证词", () => {
    const { records, board } = submission();
    records[3] = record("separated", [cooling(1000, "fast")]);
    expect(
      evaluateResearch(board, records).checks.find((x) => x.id === "transfer")!
        .passed,
    ).toBe(false);
  });
  it("分离瞬间尚无液相演化，温度不同提示可比较性", () => {
    const { records, board } = submission();
    records[3] = record("separated", [
      cooling(1100),
      { kind: "separate", mineral: "olivine", fraction: 1 },
    ]);
    expect(evaluateResearch(board, records).checks[2].text).toContain(
      "温度不同",
    );
    records[2] = record("retained", [cooling(1100)]);
    const result = evaluateResearch(board, records);
    expect(result.checks[1].passed).toBe(true);
    expect(result.checks[2].passed).toBe(false);
  });
  it("篡改库存、库存类型或不同源样品均不能提交为对照", () => {
    for (const change of [
      (r: RecordEntry) => r.state.liquid.SiO2++,
      (r: RecordEntry) => {
        r.kind = "cumulate";
      },
    ]) {
      const { records, board } = submission();
      change(records[3]);
      expect(evaluateResearch(board, records).passed).toBe(false);
    }
    const { records, board } = submission();
    records[2] = record(
      "retained",
      [cooling(1000)],
      "liquid",
      createState("evolved"),
    );
    expect(evaluateResearch(board, records).checks[1].passed).toBe(false);
  });
  it("完整快照可分支，重放不会修改原实验", () => {
    const parent = record("parent", [cooling(1100)]);
    const fork = beginRun(parent.state, "fork", parent.run);
    const commands: ExperimentCommand[] = [
      { kind: "separate", mineral: "olivine", fraction: 0.75 },
      cooling(1000),
    ];
    expect(replay({ ...fork, commands })).toEqual(
      commands.reduce(executeCommand, parent.state),
    );
    expect(parent.state.temperature).toBe(1100);
    expect(fork.parent?.commandIndex).toBe(1);
  });
  it("证据板、命令日志和旧存档可以往返，篡改日志被拒绝", () => {
    const { records, board } = submission();
    const save = initialSave();
    save.level = "E";
    save.records = records;
    save.research = board;
    expect(decode(encode(save))).toEqual(save);
    expect(decode(encode(initialSave())).records).toEqual([]);
    save.records[0].run!.commands = [cooling(650, "slow")];
    expect(() => decode(encode(save))).toThrow();
  });
});
