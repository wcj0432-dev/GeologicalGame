import { describe, it, expect } from "vitest";
import { createState, cool, separate, balance } from "../engine";
import { performAction, type GeologicalAction } from "./actions";
import {
  initialNarrative,
  emptyNarrative,
  startLevel,
  afterAction,
  advance,
  skip,
  requestHint,
  checkObjective,
  validNarrative,
} from "./events";
import { introductions, completions } from "./scripts";
import { currentNode } from "./dialogue";
import { separationEvidence } from "./science";
import { decode, encode, initialSave } from "../storage";
describe("女神引导与科学解说", () => {
  it("分支可推进、跳过不改变模拟，原操作路径不受剧情影响", () => {
    let n = initialNarrative();
    n = advance(n);
    n = advance(n);
    expect(currentNode(n.active!).choices).toHaveLength(2);
    n = advance(n, "slow");
    expect(currentNode(n.active!).text).toContain("缓慢");
    const state = createState();
    expect(
      performAction(
        state,
        { type: "coolMagma", target: 1100, rate: "slow" },
        "A",
      ),
    ).toMatchObject({ ok: true, state: cool(state, 1100) });
    expect(skip(n).active).toBeUndefined();
    expect(state).toEqual(createState());
  });
  it("所有脚本分支可达，next及选项目标存在", () => {
    for (const scene of [
      ...Object.values(introductions),
      ...Object.values(completions),
    ]) {
      const n = {
        ...emptyNarrative(),
        active: { scene, node: scene.nodes[0].id },
        history: [scene],
      };
      expect(validNarrative(n)).toBe(true);
      const seen = new Set<string>();
      function visit(id: string) {
        if (seen.has(id)) return;
        seen.add(id);
        const node = scene.nodes.find((x) => x.id === id)!;
        if (node.choices) node.choices.forEach((c) => visit(c.next));
        else {
          const next =
            node.next ?? scene.nodes[scene.nodes.indexOf(node) + 1]?.id;
          if (next) visit(next);
        }
      }
      visit(scene.nodes[0].id);
      expect(seen.size).toBe(scene.nodes.length);
    }
  });
  it("权能拒绝锁定、无晶体、升温或非法操作，观察返回原状态", () => {
    const s = createState();
    expect(
      performAction(
        s,
        { type: "separateCrystals", mineral: "olivine", fraction: 1 },
        "A",
      ).ok,
    ).toBe(false);
    expect(
      performAction(
        s,
        { type: "separateCrystals", mineral: "olivine", fraction: 1 },
        "C",
      ).ok,
    ).toBe(false);
    expect(
      performAction(
        s,
        { type: "coolMagma", target: 1350, rate: "fast" },
        "free",
      ).ok,
    ).toBe(false);
    expect(
      performAction(
        s,
        { type: "stepTemperature", degrees: -5, rate: "fast" },
        "free",
      ).ok,
    ).toBe(false);
    const inspected = performAction(s, { type: "inspectMinerals" }, "A");
    expect(inspected.ok && inspected.state === s).toBe(true);
  });
  it("分离解说严格读取前后库存，不承诺液相SiO2立即升高", () => {
    const before = cool(createState(), 1100),
      after = separate(before, "olivine", 0.5);
    const e = separationEvidence(before, after);
    expect(e.summary).toContain("差 0.000 个百分点");
    expect(e.annotations.some((x) => x.includes("MgO 转入堆晶"))).toBe(true);
    for (const r of balance(after))
      expect(Math.abs(r.error)).toBeLessThan(1e-8);
  });
  it("首次事件有去重与优先级，通关场景来自实际状态", () => {
    const before = createState(),
      after = cool(before, 650, "fast");
    const action: GeologicalAction = {
      type: "coolMagma",
      target: 650,
      rate: "fast",
    };
    let n = afterAction(initialNarrative(), before, after, action, "A", [
      after,
      createState("basalt", "B"),
    ]);
    const count = n.history.length;
    n = afterAction(n, before, after, action, "A", [
      after,
      createState("basalt", "B"),
    ]);
    expect(n.history.length).toBe(count);
    expect(n.history.some((s) => s.id === "complete:A")).toBe(false);
    const other = cool(createState("basalt", "B"), 650, "slow");
    n = afterAction(n, before, after, action, "A", [after, other]);
    expect(n.active?.scene.id).toBe("complete:A");
  });
  it("自由实验不自动插话；显式提示仍可用", () => {
    const n = startLevel(emptyNarrative(), "free");
    const after = cool(createState(), 1000);
    const updated = afterAction(
      n,
      createState(),
      after,
      { type: "coolMagma", target: 1000, rate: "slow" },
      "free",
      [after, createState()],
    );
    expect(updated.active).toBeUndefined();
    expect(updated.history).toHaveLength(0);
    expect(
      requestHint(updated, "free", [after, createState()], 3).active,
    ).toBeDefined();
  });
  it("失败记录只描述观测事实，三次同类检查提供选项而非自动长讲", () => {
    let n = emptyNarrative();
    for (let i = 0; i < 3; i++)
      n = checkObjective(n, "A", [createState(), createState()]);
    expect(n.failures["A:unfinished"]).toBe(3);
    expect(currentNode(n.active!).text).toContain("第3次");
    expect(currentNode(n.active!).text).not.toContain("你一定");
    expect(n.evidence).toBeUndefined();
  });
  it("叙事进度与跳过可存档，旧版本迁移，不重复开场", () => {
    const save = initialSave();
    save.narrative = skip(save.narrative);
    const restored = decode(encode(save));
    expect(restored.narrative.active).toBeUndefined();
    expect(startLevel(restored.narrative, "A").active).toBeUndefined();
    const legacy = JSON.parse(encode(save));
    delete legacy.narrative;
    expect(decode(JSON.stringify(legacy)).narrative.active?.scene.id).toBe(
      "intro:A",
    );
    const corrupt = JSON.parse(encode(save));
    corrupt.narrative.active = { scene: introductions.A, node: "missing" };
    expect(() => decode(JSON.stringify(corrupt))).toThrow();
  });
  it("播放倍率不参与化学计算；同样推进步数结果一致", () => {
    function run() {
      let s = createState();
      for (let i = 0; i < 30; i++) {
        const r = performAction(
          s,
          { type: "advanceSimulation", rate: "slow" },
          "A",
        );
        if (r.ok) s = r.state;
      }
      return s;
    }
    expect(run()).toEqual(cool(createState(), 1000, "slow"));
  });
});
