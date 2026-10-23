import { mass, inventoryMass, percent, rock, type State } from "../engine";
import { minerals } from "../data";
import { evaluate } from "../levels";
import { introductions, completions } from "./scripts";
import {
  lines,
  advanceDialogue,
  type Scene,
  type DialogueState,
} from "./dialogue";
import {
  failureReason,
  mineralEvidence,
  separationEvidence,
  type Evidence,
} from "./science";
import type { GeologicalAction } from "./actions";
export type NarrativeState = {
  version: 1;
  seen: string[];
  active?: DialogueState;
  queue: DialogueState[];
  history: Scene[];
  failures: Record<string, number>;
  quiet: boolean;
  evidence?: Evidence;
  feedback: string;
  sequence: number;
};
export const emptyNarrative = (): NarrativeState => ({
  version: 1,
  seen: [],
  queue: [],
  history: [],
  failures: {},
  quiet: false,
  feedback: "女神准备好了。操作目标始终保留在任务卡中。",
  sequence: 0,
});
export function enqueue(
  input: NarrativeState,
  scene: Scene,
  explicit = false,
): NarrativeState {
  if (!explicit && input.seen.includes(scene.id)) return input;
  const n = structuredClone(input);
  if (!n.seen.includes(scene.id)) n.seen.push(scene.id);
  n.history = [...n.history, scene].slice(-120);
  if (n.quiet && !explicit) return n;
  const next = { scene, node: scene.nodes[0].id };
  if (explicit) {
    n.active = next;
    n.queue = [];
  } else if (!n.active) n.active = next;
  else if (scene.priority > n.active.scene.priority) {
    n.queue = [n.active, ...n.queue].slice(0, 4);
    n.active = next;
  } else
    n.queue = [...n.queue, next]
      .sort((a, b) => b.scene.priority - a.scene.priority)
      .slice(0, 4);
  return n;
}
export function startLevel(n: NarrativeState, level: string): NarrativeState {
  const clean = {
    ...n,
    active: undefined,
    queue: [],
    evidence: undefined,
    feedback:
      level === "free"
        ? "自由实验默认安静；随时请求观察和解释。"
        : "选择冷却环境，让过程决定产物。",
  };
  return introductions[level] ? enqueue(clean, introductions[level]) : clean;
}
export function initialNarrative() {
  return startLevel(emptyNarrative(), "A");
}
export function advance(n: NarrativeState, choice?: string): NarrativeState {
  if (!n.active) return n;
  const active = advanceDialogue(n.active, choice);
  return active
    ? { ...n, active }
    : { ...n, active: n.queue[0], queue: n.queue.slice(1) };
}
export function skip(n: NarrativeState): NarrativeState {
  return { ...n, active: undefined, queue: [], evidence: undefined };
}
export function afterAction(
  input: NarrativeState,
  before: State,
  after: State,
  action: GeologicalAction,
  level: string,
  states: State[],
): NarrativeState {
  let n = { ...input, sequence: input.sequence + 1 };
  const isCool = ["coolMagma", "stepTemperature", "advanceSimulation"].includes(
    action.type,
  );
  n.feedback = isCool
    ? `女神执行冷却：${before.temperature} → ${after.temperature}°C；未成晶组分 ${mass(after.liquid).toFixed(2)} kg。`
    : action.type === "separateCrystals"
      ? `女神转移已有晶体 ${(inventoryMass(after.removed) - inventoryMass(before.removed)).toFixed(3)} kg。`
      : "时间暂停，观察不会改变库存。";
  if (level !== "free") {
    if (isCool)
      n = enqueue(
        n,
        lines(
          `first-action:${level}`,
          "权能 · 条件先行",
          [
            [
              "goddess",
              "冷却路径已经传递给模拟器。快慢冷影响结构示意，不直接改写化学质量。",
              "calm",
            ],
          ],
          10,
        ),
      );
    for (const [mineralIndex, m] of minerals.entries()) {
      if (
        mass(before.crystals[m.id]) + mass(before.removed[m.id]) < 1e-8 &&
        mass(after.crystals[m.id]) + mass(after.removed[m.id]) > 1e-8
      ) {
        const firstTemperature =
          after.history
            .slice(before.history.length)
            .find((h) => h.mineralMass[mineralIndex] > 1e-8)?.temperature ??
          after.temperature;
        const evidence = mineralEvidence(after, m.id);
        evidence.annotations.unshift(
          `本次记录中的首次出现温度 ${firstTemperature}°C；库存数据为操作结束时 ${after.temperature}°C。`,
        );
        const seen = n.seen.includes(`mineral:${level}:${m.id}`);
        n = enqueue(
          n,
          lines(
            `mineral:${level}:${m.id}`,
            `发现 · ${m.name}`,
            [
              [
                "goddess",
                `看，${m.name}首次出现在本次记录的${firstTemperature}°C阶段，当前为${after.temperature}°C。${evidence.annotations[0]}。愿意的话，暂停后用观察权能放大它。`,
                "warm",
              ],
              [
                "player",
                "我先记下这次温度，暂时不把一份岩浆的观察升级成世界定律。",
              ],
            ],
            45,
            level === "A" ? undefined : "minerals",
          ),
        );
        if (!seen && level === "B") n.evidence = evidence;
      }
    }
    if (action.type === "separateCrystals") {
      n.evidence = separationEvidence(before, after);
      n = enqueue(
        n,
        lines(
          `separation:${level}`,
          "权能 · 不是把元素抹掉",
          [
            ["goddess", n.evidence.summary, "calm"],
            [
              "player",
              "所以“捞出晶体”只是搬家，不是删除。后续冷却才是检验差异的时候。",
            ],
            ["goddess", "正是。神明也不能用“打扫”掩盖质量账本。", "proud"],
          ],
          75,
          "balance",
        ),
      );
    }
    if (Math.abs(percent(after.liquid).SiO2 - percent(after.initial).SiO2) >= 1)
      n = enqueue(
        n,
        lines(
          `composition:${level}`,
          "观察 · 液相在演化",
          [
            [
              "goddess",
              `当前液相 SiO₂ 为 ${percent(after.liquid).SiO2.toFixed(3)} wt.%，初始为 ${percent(after.initial).SiO2.toFixed(3)} wt.%。这是质量重新分配后的结果，不是额外加入硅。`,
              "calm",
            ],
          ],
          35,
          level === "A" ? undefined : "chemistry",
        ),
      );
    if (level === "A" && after.temperature <= 650 && before.temperature > 650)
      n = enqueue(
        n,
        lines(
          `rock:A:${after.id}`,
          "第一块样品",
          [
            [
              "goddess",
              `${after.id}房到达650°C，得到${rock(after).name}，结构示意为${rock(after).texture}。未成晶组分记作玻璃基质。`,
              "warm",
            ],
            [
              "player",
              "另一间房就是对照。我要让它走不同的冷却路径，再检查总体组成。",
            ],
          ],
          65,
        ),
      );
    if (evaluate(level, states).passed && !n.seen.includes(`complete:${level}`))
      n = enqueue({ ...n, active: undefined, queue: [] }, completions[level]);
  }
  return n;
}
export function requestHint(
  input: NarrativeState,
  level: string,
  states: State[],
  tier: 1 | 2 | 3,
): NarrativeState {
  const reason = failureReason(level, states);
  let n = { ...input, sequence: input.sequence + 1 };
  const text =
    tier === 1
      ? `先观察：${reason.fact}`
      : tier === 2
        ? `可以控制的变量是冷却路径、结晶阶段，以及本关开放的晶体分离。${reason.fact}`
        : `原理说明：结晶把液相组分转入固相，分离只移动已有固相；保留晶体继续参与教学代理的有限交换，分离晶体不再交换。快慢冷不改写化学规则。${reason.fact}`;
  if (tier === 3)
    n.evidence =
      level === "C" || level === "D"
        ? {
            title: "三份库存，一份原始岩浆",
            focus: "balance",
            summary: reason.fact,
            annotations: [
              "液相 ≠ 岩浆房总体 ≠ 全实验系统。",
              "分离瞬间液相不变；继续冷却后的差异取决于实际路径。",
            ],
          }
        : mineralEvidence(states[0]);
  return enqueue(
    n,
    lines(
      `hint:${n.sequence}`,
      `主动求助 · ${tier}级`,
      [
        ["goddess", text, "calm"],
        [
          "player",
          tier === 3
            ? "先保留数据，再改一个变量。这样才能知道哪一步起了作用。"
            : "我先试一轮，留着结果回来比较。",
        ],
      ],
      85,
      tier === 3 ? n.evidence?.focus : undefined,
    ),
    true,
  );
}
export function checkObjective(
  input: NarrativeState,
  level: string,
  states: State[],
): NarrativeState {
  if (level === "free") return requestHint(input, level, states, 1);
  if (evaluate(level, states).passed)
    return enqueue(input, completions[level], true);
  const reason = failureReason(level, states),
    key = `${level}:${reason.kind}`;
  const count = (input.failures[key] ?? 0) + 1;
  let n = {
    ...input,
    failures: { ...input.failures, [key]: count },
    sequence: input.sequence + 1,
  };
  const extra =
    count >= 3
      ? `这是第${count}次检查仍遇到同类条件缺口。若需要，可主动点“原理解释”展开账本。`
      : "结果会保留，可以改一个变量再试。";
  return enqueue(
    n,
    lines(
      `failure:${n.sequence}`,
      "研究检查 · 尚未达标",
      [
        ["goddess", `${reason.fact} ${extra}`, "wry"],
        [
          "player",
          count >= 3
            ? "我重复验证了同一种缺口，下一次该换条件了。"
            : "这轮没白做，至少知道还差在哪里。",
        ],
      ],
      85,
    ),
    true,
  );
}
export function sampleDiscovered(
  n: NarrativeState,
  name: string,
  level: string,
): NarrativeState {
  if (level === "free") return n;
  return enqueue(
    n,
    lines(
      `sample:${name}`,
      "实验笔记新增",
      [
        [
          "player",
          `记下“${name}”。这是库存快照，不是一块凭空复制出来的新物质。`,
        ],
        ["goddess", "很好。记录可以多份，质量不能重复计算。", "warm"],
      ],
      20,
    ),
  );
}
export function validNarrative(n: NarrativeState): boolean {
  try {
    const focus = (f: unknown) =>
      f === undefined ||
      ["minerals", "chemistry", "balance", "compare"].includes(f as string);
    const scene = (s: Scene) =>
      typeof s.id === "string" &&
      typeof s.title === "string" &&
      Number.isFinite(s.priority) &&
      Array.isArray(s.nodes) &&
      s.nodes.length > 0 &&
      s.nodes.every(
        (x) =>
          typeof x.id === "string" &&
          typeof x.text === "string" &&
          ["goddess", "player"].includes(x.speaker) &&
          focus(x.focus) &&
          (!x.expression ||
            ["calm", "proud", "surprised", "wry", "warm"].includes(
              x.expression,
            )) &&
          (!x.motion || ["idle", "point", "nod"].includes(x.motion)) &&
          (!x.request || x.request.type === "inspectMinerals") &&
          (!x.next || s.nodes.some((y) => y.id === x.next)) &&
          (!x.choices ||
            x.choices.every(
              (c) =>
                typeof c.label === "string" &&
                s.nodes.some((y) => y.id === c.next),
            )),
      );
    const active = (a: DialogueState) =>
      scene(a.scene) && a.scene.nodes.some((x) => x.id === a.node);
    return (
      n.version === 1 &&
      typeof n.quiet === "boolean" &&
      typeof n.feedback === "string" &&
      Number.isFinite(n.sequence) &&
      Array.isArray(n.seen) &&
      n.seen.every((x) => typeof x === "string") &&
      Array.isArray(n.queue) &&
      n.queue.every(active) &&
      (!n.active || active(n.active)) &&
      Array.isArray(n.history) &&
      n.history.every(scene) &&
      typeof n.failures === "object" &&
      n.failures !== null &&
      Object.values(n.failures).every((x) => Number.isFinite(x) && x >= 0) &&
      (!n.evidence ||
        (typeof n.evidence.title === "string" &&
          typeof n.evidence.summary === "string" &&
          focus(n.evidence.focus) &&
          Array.isArray(n.evidence.annotations) &&
          n.evidence.annotations.every((x) => typeof x === "string")))
    );
  } catch {
    return false;
  }
}
