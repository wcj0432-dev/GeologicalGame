import { describe, it, expect } from "vitest";
import keepRaw from "./packs/morb-retain.json?raw";
import removeRaw from "./packs/morb-remove.json?raw";
import {
  validatePack,
  audit,
  elements,
  sumComponents,
  advancePack,
  liquidComposition,
} from "./pack";
describe("真实MELTS资料包与拒绝边界", () => {
  it.each([keepRaw, removeRaw])("内置完整路径每节点守恒且非负", (raw) => {
    const p = validatePack(JSON.parse(raw));
    expect(p.frames).toHaveLength(26);
    for (const f of p.frames) {
      expect(
        audit(
          p.basis.initialComponentsKg,
          sumComponents([
            sumComponents(f.retainedPhases.map((x) => x.componentsKg)),
            f.cumulativeRemovedComponentsKg,
          ]),
        ),
      ).toBeLessThan(1e-6);
      for (const x of f.equilibratedPhases)
        expect(x.massKg).toBeGreaterThanOrEqual(0);
    }
  });
  it("相同样品两条真实路径产生不同液相，分离库存未丢失", () => {
    const a = validatePack(JSON.parse(keepRaw)),
      b = validatePack(JSON.parse(removeRaw));
    expect(a.basis.initialComponentsKg).toEqual(b.basis.initialComponentsKg);
    expect(
      Math.abs(
        liquidComposition(a.frames.at(-1)!).wtPct.sio2 -
          liquidComposition(b.frames.at(-1)!).wtPct.sio2,
      ),
    ).toBeGreaterThan(0.1);
    expect(b.frames.at(-1)!.cumulativeRemovedComponentsKg.sio2).toBeGreaterThan(
      0,
    );
  });
  it("允许内部铁价态形式变化，以Fe与O元素守恒作准", () => {
    const a = elements({ feo: 71.8464 }),
      b = elements({ fe2o3: 159.6922 / 2 });
    expect(a.Fe).toBeCloseTo(b.Fe, 9);
    expect(a.O).not.toEqual(b.O);
    expect(() => audit({ feo: 71.8464 }, { fe2o3: 159.6922 / 2 })).toThrow();
  });
  it.each([
    "phase",
    "pressure",
    "partial",
    "negative",
    "cumulative",
    "partition",
    "weights",
    "normalization",
    "missing-frame",
  ])("拒绝破坏账本或边界：%s", (kind) => {
    const p = JSON.parse(removeRaw);
    if (kind === "phase") p.frames[20].equilibratedPhases.pop();
    if (kind === "pressure") p.frames[0].pressureBar = 0.05;
    if (kind === "partial") p.status = "partial";
    if (kind === "negative")
      p.frames[0].equilibratedPhases[0].componentsKg.sio2 = -1;
    if (kind === "cumulative")
      p.frames[20].cumulativeRemovedComponentsKg.sio2 += 1;
    if (kind === "partition") p.frames[20].removedThisStep = [];
    if (kind === "weights") p.basis.atomicWeights.Fe = 54;
    if (kind === "normalization") p.basis.normalizationFactor = 1;
    if (kind === "missing-frame") p.frames.splice(4, 1);
    expect(() => validatePack(p)).toThrow();
  });
  it("不支持的任意分离操作不能沿用预计算曲线", () => {
    const p = validatePack(JSON.parse(keepRaw));
    expect(advancePack(p, 0, "next")).toBe(1);
    expect(() => advancePack(p, 0, "separate-half")).toThrow(
      "OUTSIDE_PACK_COVERAGE",
    );
    expect(() => advancePack(p, 25, "next")).toThrow("OUTSIDE_PACK_COVERAGE");
  });
});
