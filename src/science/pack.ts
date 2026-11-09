// A closed-oxygen, discrete-path provider. It never falls back to the teaching engine.
export type Components = Record<string, number>;
export type ScientificPhase = {
  id: string;
  batchId: string;
  category: "liquid" | "solid" | "fluid";
  massKg: number;
  componentsKg: Components;
};
export type ScientificFrame = {
  step: number;
  temperatureC: number;
  pressureBar: number;
  inputComponentsKg: Components;
  equilibratedPhases: ScientificPhase[];
  retainedPhases: ScientificPhase[];
  removedThisStep: ScientificPhase[];
  cumulativeRemovedComponentsKg: Components;
  maxElementErrorKg: number;
};
export type SciencePack = {
  schemaVersion: 1;
  packId: string;
  status: "complete";
  provenance: {
    sourceKind: string;
    sourceUrl: string;
    citation: string;
    sourceVersion: string;
    rawInputSha256: string;
  };
  solver: {
    distribution: string;
    version: string;
    model: string;
    librarySha256: string;
    archiveSha256: string;
  };
  basis: {
    initialMassKg: number;
    originalComponents: Components;
    originalTotal: number;
    normalizationFactor: number;
    initialComponentsKg: Components;
    atomicWeights: Components;
    atomicWeightVersion: string;
    solverMassUnit: string;
    physicalKgPerSolverGram: number;
    oxygenBoundary: string;
  };
  scenario: {
    pressureBar: number;
    liquidusC: number;
    startTemperatureC: number;
    endTemperatureC: number;
    stepC: number;
    solidPolicy: "retain-all" | "remove-all";
    fluidPolicy: string;
    fO2Buffer: string;
  };
  frames: ScientificFrame[];
  termination: { reason: string; lastValidStep: number };
};
export const atomicWeights: Components = {
  O: 15.9994,
  Si: 28.0855,
  Ti: 47.9,
  Al: 26.98154,
  Fe: 55.847,
  Cr: 51.9961,
  Mn: 54.938,
  Mg: 24.305,
  Ni: 58.71,
  Co: 58.9332,
  Ca: 40.08,
  Na: 22.98977,
  K: 39.0983,
  P: 30.97376,
  H: 1.0079,
  C: 12.011,
  S: 32.06,
};
const formula: Record<string, Components> = {
  sio2: { Si: 1, O: 2 },
  tio2: { Ti: 1, O: 2 },
  al2o3: { Al: 2, O: 3 },
  fe2o3: { Fe: 2, O: 3 },
  cr2o3: { Cr: 2, O: 3 },
  feo: { Fe: 1, O: 1 },
  mno: { Mn: 1, O: 1 },
  mgo: { Mg: 1, O: 1 },
  nio: { Ni: 1, O: 1 },
  coo: { Co: 1, O: 1 },
  cao: { Ca: 1, O: 1 },
  na2o: { Na: 2, O: 1 },
  k2o: { K: 2, O: 1 },
  p2o5: { P: 2, O: 5 },
  h2o: { H: 2, O: 1 },
  co2: { C: 1, O: 2 },
  so3: { S: 1, O: 3 },
};
export const total = (c: Components) =>
  Object.values(c).reduce((a, b) => a + b, 0);
export function sumComponents(list: Components[]): Components {
  const out: Components = {};
  for (const c of list)
    for (const [k, v] of Object.entries(c)) out[k] = (out[k] ?? 0) + v;
  return out;
}
export function elements(c: Components): Components {
  if (!c || typeof c !== "object" || Array.isArray(c))
    throw Error("INVALID_COMPONENTS");
  const out: Components = {};
  for (const [key, v] of Object.entries(c)) {
    if (!Number.isFinite(v) || v < -1e-10)
      throw Error("NEGATIVE_OR_INVALID_MASS");
    if (v === 0) continue;
    const f = formula[key];
    if (!f) throw Error(`UNMAPPED_COMPONENT: ${key}`);
    const mw = Object.entries(f).reduce(
      (n, [el, count]) => n + count * atomicWeights[el],
      0,
    );
    for (const [el, count] of Object.entries(f))
      out[el] = (out[el] ?? 0) + (v * count * atomicWeights[el]) / mw;
  }
  return out;
}
function near(a: number, b: number, tolerance = 1e-6) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance)
    throw Error("MASS_BALANCE_FAILED");
}
function componentsEqual(a: Components, b: Components) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
    near(a[k] ?? 0, b[k] ?? 0);
}
export function audit(a: Components, b: Components) {
  const x = elements(a),
    y = elements(b);
  near(total(a), total(b));
  let error = 0;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const delta = Math.abs((x[k] ?? 0) - (y[k] ?? 0));
    if (delta > Math.max(1e-6, Math.abs(x[k] ?? 0) * 1e-8))
      throw Error(`ELEMENT_BALANCE_FAILED: ${k}`);
    error = Math.max(error, delta);
  }
  return error;
}
function phaseSum(phases: ScientificPhase[]) {
  if (!Array.isArray(phases) || phases.length > 100)
    throw Error("INCOMPLETE_PHASE_OUTPUT");
  const ids = new Set<string>();
  for (const p of phases) {
    if (
      typeof p.id !== "string" ||
      typeof p.batchId !== "string" ||
      ids.has(p.batchId) ||
      !["solid", "liquid", "fluid"].includes(p.category)
    )
      throw Error("INVALID_PHASE");
    ids.add(p.batchId);
    elements(p.componentsKg);
    near(p.massKg, total(p.componentsKg));
    if (p.massKg < -1e-10) throw Error("NEGATIVE_MASS");
  }
  return sumComponents(phases.map((p) => p.componentsKg));
}
export function validatePack(raw: unknown): SciencePack {
  const p = raw as SciencePack;
  if (
    !p ||
    p.schemaVersion !== 1 ||
    p.status !== "complete" ||
    p.solver?.distribution !== "alphaMELTS" ||
    !p.solver.version.startsWith("2.3.2 ") ||
    p.solver.model !== "rhyolite-MELTS 1.0.2" ||
    !p.provenance?.citation ||
    ![
      p.provenance.rawInputSha256,
      p.solver.librarySha256,
      p.solver.archiveSha256,
    ].every((x) => /^[0-9a-f]{64}$/.test(x))
  )
    throw Error("VERSION_OR_PROVENANCE_MISMATCH");
  const s = p.scenario,
    b = p.basis;
  if (
    !s ||
    !b ||
    b.oxygenBoundary !== "closed" ||
    s.fO2Buffer !== "none" ||
    s.fluidPolicy !== "retain" ||
    s.pressureBar !== 500 ||
    !["retain-all", "remove-all"].includes(s.solidPolicy) ||
    s.stepC !== 5 ||
    b.initialMassKg !== 100 ||
    b.solverMassUnit !== "g" ||
    b.physicalKgPerSolverGram !== 1 ||
    !Number.isFinite(s.liquidusC) ||
    s.startTemperatureC <= s.liquidusC ||
    s.endTemperatureC < 1000 ||
    s.startTemperatureC > 1400 ||
    s.endTemperatureC >= s.startTemperatureC
  )
    throw Error("UNSUPPORTED_SCENARIO");
  for (const [el, w] of Object.entries(atomicWeights))
    near(b.atomicWeights[el], w, 1e-12);
  elements(b.originalComponents);
  near(total(b.originalComponents), b.originalTotal);
  near(b.normalizationFactor, 100 / b.originalTotal, 1e-12);
  componentsEqual(
    b.initialComponentsKg,
    Object.fromEntries(
      Object.entries(b.originalComponents).map(([k, v]) => [
        k,
        v * b.normalizationFactor,
      ]),
    ),
  );
  near(total(b.initialComponentsKg), 100);
  if (
    !Array.isArray(p.frames) ||
    p.frames.length < 2 ||
    p.frames.length > 200 ||
    p.termination?.reason !== "targetReached" ||
    p.termination.lastValidStep !== p.frames.length - 1
  )
    throw Error("INCOMPLETE_PATH");
  let current = b.initialComponentsKg,
    cumulative: Components = {};
  for (const [i, f] of p.frames.entries()) {
    if (
      f.step !== i ||
      f.pressureBar !== 500 ||
      f.temperatureC !== s.startTemperatureC - i * 5
    )
      throw Error("INVALID_PATH_UNITS");
    componentsEqual(current, f.inputComponentsKg);
    const equilibrium = phaseSum(f.equilibratedPhases),
      kept = phaseSum(f.retainedPhases),
      removed = phaseSum(f.removedThisStep);
    audit(current, equilibrium);
    // Require an exact partition of the emitted phase batches. No lost unknown phase or double removal.
    const expectedRemoved = f.equilibratedPhases.filter(
      (x) => s.solidPolicy === "remove-all" && x.category === "solid",
    );
    const expectedKept = f.equilibratedPhases.filter(
      (x) => !expectedRemoved.includes(x),
    );
    if (
      JSON.stringify(expectedRemoved) !== JSON.stringify(f.removedThisStep) ||
      JSON.stringify(expectedKept) !== JSON.stringify(f.retainedPhases)
    )
      throw Error("INVALID_PHASE_TRANSFER");
    audit(equilibrium, sumComponents([kept, removed]));
    cumulative = sumComponents([cumulative, removed]);
    componentsEqual(cumulative, f.cumulativeRemovedComponentsKg);
    audit(b.initialComponentsKg, sumComponents([kept, cumulative]));
    if (
      i === 0 &&
      f.equilibratedPhases.some(
        (x) => x.category !== "liquid" && x.massKg > 1e-8,
      )
    )
      throw Error("INITIAL_STATE_NOT_ALL_LIQUID");
    current = kept;
  }
  if (p.frames.at(-1)!.temperatureC !== s.endTemperatureC)
    throw Error("INCOMPLETE_PATH");
  return p;
}
export function advancePack(pack: SciencePack, index: number, action: string) {
  if (
    action !== "next" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index + 1 >= pack.frames.length
  )
    throw Error("OUTSIDE_PACK_COVERAGE");
  return index + 1;
}
export function liquidComposition(frame: ScientificFrame) {
  const c = sumComponents(
    frame.retainedPhases
      .filter((p) => p.category === "liquid")
      .map((p) => p.componentsKg),
  );
  const m = total(c);
  return {
    mass: m,
    wtPct: Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, m > 1e-9 ? (v / m) * 100 : 0]),
    ),
  };
}
