import { describe, it, expect } from "vitest";
import {
  createState,
  cool,
  separate,
  balance,
  mass,
  inventoryMass,
  percent,
  rock,
} from "./engine";
import { oxides, minerals } from "./data";
import { evaluate } from "./levels";
import { decode, encode, initialSave } from "./storage";
describe("教学模拟与四关可达性", () => {
  it("A：快慢冷得到两种结构，封闭系统成分相同", () => {
    const a = cool(createState(), 650, "fast"),
      b = cool(createState(), 650, "slow");
    expect(evaluate("A", [a, b]).passed).toBe(true);
    expect(rock(a).composition).toEqual(rock(b).composition);
    expect(a.liquid).toEqual(b.liquid);
  });
  it("B：三种矿物的出现阶段可观察", () => {
    const a = cool(createState(), 1000);
    expect(evaluate("B", [a]).passed).toBe(true);
    expect(a.events.filter((e) => e.includes("首次")).length).toBe(3);
  });
  it("C：两份相同岩浆在同温度产生可检测的熔体差异", () => {
    let a = cool(createState(), 1100);
    a = separate(a, "olivine", 1);
    a = separate(a, "pyroxene", 1);
    a = cool(a, 1000);
    const b = cool(createState(), 1000);
    expect(evaluate("C", [a, b]).passed).toBe(true);
  });
  it("D：同源堆晶和演化熔体满足目标", () => {
    let a = cool(createState(), 1150);
    a = separate(a, "olivine", 1);
    a = separate(a, "pyroxene", 1);
    a = cool(a, 1050);
    expect(evaluate("D", [a]).passed).toBe(true);
  });
  it("逐步随机路径各组分守恒与非负，确定性", () => {
    function run() {
      let s = createState();
      for (let t = 1290; t >= 650; t -= 10) {
        s = cool(s, t);
        for (const m of minerals) s = separate(s, m.id, (t % 70) / 100);
        for (const c of [
          s.liquid,
          ...minerals.flatMap((m) => [s.crystals[m.id], s.removed[m.id]]),
        ])
          for (const o of oxides) expect(c[o]).toBeGreaterThanOrEqual(-1e-10);
        for (const row of balance(s))
          expect(Math.abs(row.error)).toBeLessThan(1e-8);
        expect(
          mass(s.liquid) + inventoryMass(s.crystals) + inventoryMass(s.removed),
        ).toBeCloseTo(100, 8);
      }
      return s;
    }
    expect(run()).toEqual(run());
  });
  it("分离瞬间不改变液相，改变房内固相库存", () => {
    const s = cool(createState(), 1100),
      a = separate(s, "olivine", 0.5);
    expect(a.liquid).toEqual(s.liquid);
    expect(mass(a.removed.olivine)).toBeCloseTo(
      mass(s.crystals.olivine) / 2,
      8,
    );
  });
  it("成分不同使结晶路径不同", () => {
    const a = cool(createState(), 1180),
      b = cool(createState("evolved"), 1180);
    expect(a.history.at(-1)?.mineralMass).not.toEqual(
      b.history.at(-1)?.mineralMass,
    );
  });
  it("按5°C步进时分段与整体路径一致", () => {
    const a = cool(cool(createState(), 1100), 1000);
    const b = cool(createState(), 1000);
    expect(a.liquid).toEqual(b.liquid);
  });
  it("存档往返包含状态、记录和进度；重置一致", () => {
    const save = initialSave();
    save.states[0] = cool(save.states[0], 1100);
    save.completed = ["B"];
    save.records = [
      {
        id: "1",
        name: "熔体",
        kind: "liquid",
        state: save.states[0],
        date: "test",
      },
    ];
    expect(decode(encode(save))).toEqual(save);
    expect(createState()).toEqual(initialSave().states[0]);
    expect(() => decode("{}")).toThrow();
  });
  it("拒绝非法输入且无熔体时分析不产生NaN", () => {
    expect(() => cool(createState(), 1400)).toThrow();
    expect(() => separate(createState(), "olivine", 2)).toThrow();
    expect(() => createState("custom", "A", { SiO2: 100 } as never)).toThrow();
    expect(
      Object.values(
        percent(Object.fromEntries(oxides.map((o) => [o, 0])) as never),
      ).every((v) => v === 0),
    ).toBe(true);
  });
});
