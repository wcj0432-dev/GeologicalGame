import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  minerals,
  oxides,
  labels,
  sources,
  modelVersion,
  chemistry,
  type Mineral,
} from "./data";
import {
  createState,
  mass,
  inventoryMass,
  percent,
  balance,
  rock,
  chamber,
  type State,
} from "./engine";
import { levels, evaluate } from "./levels";
import {
  decode,
  encode,
  initialSave,
  saveKey,
  type Save,
  type RecordEntry,
} from "./storage";
import { Narrator } from "./narrative/Narrator";
import { ExperimentComparison } from "./narrative/Comparison";
import { performAction, type GeologicalAction } from "./narrative/actions";
import {
  afterAction,
  advance,
  skip,
  startLevel,
  requestHint,
  checkObjective,
  sampleDiscovered,
  enqueue,
} from "./narrative/events";
import { introductions } from "./narrative/scripts";
import { mineralEvidence, type Focus } from "./narrative/science";
import { beginRun, type ExperimentCommand } from "./experiments";
import { evaluateResearch, evidenceSlots, researchTarget } from "./research";
import { lines } from "./narrative/dialogue";
import { completions } from "./narrative/scripts";
import { Specimen } from "./visuals/Specimen";
import { SciencePanel } from "./science/SciencePanel";
import "./style.css";
function tracked(
  p: Save,
  index: number,
  before: State,
  after: State,
  action: GeologicalAction,
) {
  const runs = p.states.map(
    (state, i) => p.runs?.[i] ?? beginRun(state, crypto.randomUUID()),
  );
  const command: ExperimentCommand =
    action.type === "separateCrystals"
      ? { kind: "separate", mineral: action.mineral, fraction: action.fraction }
      : {
          kind: "cool",
          targetC: after.temperature,
          rate: "rate" in action ? action.rate : "slow",
        };
  if (after !== before)
    runs[index] = {
      ...runs[index],
      commands: [...runs[index].commands, command],
    };
  return runs;
}
function load() {
  try {
    return decode(localStorage.getItem(saveKey) ?? "");
  } catch {
    return initialSave();
  }
}
function Chamber({ s, kind = "chamber" }: { s: State; kind?: string }) {
  const liquid = mass(s.liquid),
    solid = inventoryMass(s.crystals);
  const amounts = minerals.map((m) =>
    mass(kind === "cumulate" ? s.removed[m.id] : s.crystals[m.id]),
  );
  const total = kind === "cumulate" ? inventoryMass(s.removed) : liquid + solid;
  const particles = minerals.flatMap((m, i) =>
    Array.from(
      { length: Math.round((amounts[i] / Math.max(1, total)) * 90) },
      (_, j) => ({
        color: m.color,
        type: i,
        x: 34 + ((j * 47 + i * 89) % 270),
        y:
          312 -
          Math.min(1, total / 100) * 260 +
          (((j * 71 + i * 43) % 240) / 240) * Math.min(1, total / 100) * 240,
        size: rock(s).texture === "粗粒" ? 9 : 4,
      }),
    ),
  );
  return (
    <svg
      viewBox="0 0 340 350"
      className="chamber"
      aria-label="岩浆房，晶体数量按模拟质量比例展示"
    >
      <defs>
        <linearGradient id={"lava" + s.id}>
          <stop stopColor="#f7b165" />
          <stop offset="1" stopColor="#c84c38" />
        </linearGradient>
        <clipPath id={"vessel" + s.id}>
          <rect x="23" y="34" width="294" height="278" rx="48" />
        </clipPath>
      </defs>
      <rect
        x="17"
        y="28"
        width="306"
        height="290"
        rx="54"
        fill="#18262b"
        stroke="#556164"
        strokeWidth="2"
      />
      <g clipPath={"url(#vessel" + s.id + ")"}>
        <rect x="23" y="34" width="294" height="278" fill="#293334" />
        <rect
          x="23"
          y={312 - 278 * Math.min(1, total / 100)}
          width="294"
          height={278 * Math.min(1, total / 100)}
          fill={kind === "cumulate" ? "#313a35" : "url(#lava" + s.id + ")"}
          opacity={s.temperature > 700 ? 0.9 : 0.38}
        />
        {kind !== "liquid" &&
          particles.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${i * 29})`}>
              <path
                d={
                  p.type === 0
                    ? `M0 ${-p.size}L${p.size} 0L0 ${p.size}L${-p.size} 0Z`
                    : p.type === 1
                      ? `M${-p.size} ${-p.size / 2}H${p.size}V${p.size / 2}H${-p.size}Z`
                      : `M${-p.size * 1.4} -1H${p.size * 1.4}V2H${-p.size * 1.4}Z`
                }
                fill={p.color}
              />
            </g>
          ))}
      </g>
      <path d="M40 17h260M40 330h260" stroke="#697578" strokeWidth="3" />
      <text x="170" y="345" fill="#80969a" textAnchor="middle" fontSize="10">
        晶体符号按质量比例抽样，非真实粒数／体积
      </text>
    </svg>
  );
}
function Curve({ s, mode }: { s: State; mode: string }) {
  const colors =
    mode === "minerals"
      ? minerals.map((m) => m.color)
      : ["#f0b86e", "#83b8c3", "#b4ce86"];
  const series =
    mode === "minerals"
      ? minerals.map((_, i) => s.history.map((h) => h.mineralMass[i]))
      : ["SiO2", "MgO", "CaO"].map((o) =>
          s.history.map((h) => h.composition[o as "SiO2"]),
        );
  const max = Math.max(10, ...series.flat());
  return (
    <>
      <svg viewBox="0 0 720 175" className="chart">
        <path d="M50 10v130h650" stroke="#647378" fill="none" />
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="50"
              x2="700"
              y1={140 - v * 120}
              y2={140 - v * 120}
              stroke="#263d43"
            />
            <text x="8" y={144 - v * 120} fill="#9aafb3" fontSize="11">
              {(max * v).toFixed(0)}
            </text>
          </g>
        ))}
        {series.map((values, i) => (
          <polyline
            key={i}
            fill="none"
            stroke={colors[i]}
            strokeWidth="2.5"
            points={values
              .map(
                (v, j) =>
                  `${50 + ((1300 - s.history[j].temperature) / 650) * 650},${140 - (120 * v) / max}`,
              )
              .join(" ")}
          />
        ))}
        <text x="50" y="163" fill="#9aafb3" fontSize="11">
          开始 1300°C
        </text>
        <text x="590" y="163" fill="#9aafb3" fontSize="11">
          终点 650°C →
        </text>
      </svg>
      <div className="legend">
        {(mode === "minerals"
          ? minerals.map((m) => m.name)
          : ["SiO₂", "MgO", "CaO"]
        ).map((n, i) => (
          <span key={n} style={{ color: colors[i] }}>
            ● {n}
          </span>
        ))}
        <span>
          {mode === "minerals" ? "全系统矿物质量 / kg" : "残余熔体 / wt.%"}
          ；横轴为温度（°C，向右降温）
        </span>
      </div>
    </>
  );
}
function App() {
  const [save, setSave] = useState<Save>(load);
  const [active, setActive] = useState(0);
  const [rate, setRate] = useState<"fast" | "slow">("slow");
  const [target, setTarget] = useState(1100);
  const [mineral, setMineral] = useState<Mineral>("olivine");
  const [fraction, setFraction] = useState(75);
  const [running, setRunning] = useState(false);
  const [playback, setPlayback] = useState(1);
  const [focus, setFocus] = useState<Focus | undefined>();
  const direct = useCallback((f: Focus) => {
    setFocus(f);
    setDepth(f === "balance" ? 3 : 2);
    setTab(f);
  }, []);
  const [tab, setTab] = useState("history");
  const [note, setNote] = useState("实验自动保存在此浏览器");
  const [depth, setDepth] = useState(1);
  const [compare, setCompare] = useState<string[]>([]);
  const level = levels.find((l) => l.id === save.level)!;
  const s = save.states[active];
  const research = evaluateResearch(save.research ?? {}, save.records);
  const result =
    save.level === "E" ? research : evaluate(save.level, save.states);
  useEffect(() => {
    try {
      localStorage.setItem(saveKey, encode(save));
    } catch {
      setNote("浏览器存储不可用，请导出实验。");
    }
  }, [save]);
  useEffect(() => {
    if (result.passed && !save.completed.includes(save.level))
      setSave((p) => ({
        ...p,
        completed: [...p.completed, p.level],
        narrative:
          p.level === "E" ? enqueue(p.narrative, completions.E) : p.narrative,
      }));
  }, [result.passed, save.level, save.completed]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () =>
        setSave((p) => {
          const current = p.states[active];
          if (current.temperature <= 650) {
            setRunning(false);
            return p;
          }
          const states = [...p.states];
          const action: GeologicalAction = { type: "advanceSimulation", rate };
          const executed = performAction(current, action, p.level);
          if (!executed.ok) return p;
          states[active] = executed.state;
          return {
            ...p,
            states,
            runs: tracked(p, active, current, executed.state, action),
            narrative: afterAction(
              p.narrative,
              current,
              executed.state,
              action,
              p.level,
              states,
            ),
          };
        }),
      180 / playback,
    );
    return () => clearInterval(timer);
  }, [running, active, rate, playback]);
  function update(fn: (state: State) => State) {
    setSave((p) => {
      const next = fn(p.states[active]);
      const runs = p.states.map(
        (v, i) => p.runs?.[i] ?? beginRun(v, crypto.randomUUID()),
      );
      runs[active] = beginRun(next, crypto.randomUUID());
      return {
        ...p,
        runs,
        states: p.states.map((v, i) => (i === active ? next : v)),
      };
    });
  }
  function act(action: GeologicalAction) {
    if (action.type === "inspectMinerals") {
      setRunning(false);
      direct("minerals");
      setSave((p) => {
        const observed = performAction(p.states[active], action, p.level);
        return observed.ok
          ? {
              ...p,
              narrative: {
                ...p.narrative,
                evidence: mineralEvidence(observed.state, mineral),
                feedback: "女神暂停时间，放大所选矿物；库存不变。",
              },
            }
          : p;
      });
      return;
    }
    setSave((p) => {
      const before = p.states[active],
        result = performAction(before, action, p.level);
      if (!result.ok)
        return { ...p, narrative: { ...p.narrative, feedback: result.error } };
      const states = p.states.map((v, i) => (i === active ? result.state : v));
      return {
        ...p,
        states,
        runs: tracked(p, active, before, result.state, action),
        narrative: afterAction(
          p.narrative,
          before,
          result.state,
          action,
          p.level,
          states,
        ),
      };
    });
  }
  function changeLevel(id: string) {
    setRunning(false);
    setActive(0);
    setFocus(undefined);
    setTab(id === "E" ? "research" : "history");
    setDepth(id === "A" ? 1 : 2);
    setSave((p) => ({
      ...p,
      level: id,
      runs: undefined,
      narrative: startLevel(p.narrative, id),
      states: [createState("basalt", "A"), createState("basalt", "B")],
    }));
  }
  function collect(kind: RecordEntry["kind"]) {
    const weight =
      kind === "cumulate"
        ? inventoryMass(s.removed)
        : kind === "liquid"
          ? mass(s.liquid)
          : mass(chamber(s));
    if (weight < 1e-6) {
      setNote("此库存尚无物质，先推进实验。");
      return;
    }
    const names = {
      chamber: rock(s).name,
      liquid: s.temperature <= 650 ? "未解析基质（非玻璃预测）" : "残余熔体",
      cumulate: "堆晶产物",
    };
    setSave((p) => ({
      ...p,
      narrative: sampleDiscovered(p.narrative, names[kind], p.level),
      records: [
        ...p.records,
        {
          id: crypto.randomUUID(),
          name: names[kind],
          kind,
          state: structuredClone(s),
          run: p.runs?.[active]
            ? structuredClone(p.runs[active])
            : beginRun(s, crypto.randomUUID()),
          date: new Date().toLocaleString("zh-CN"),
        },
      ],
    }));
    setNote("已创建库存快照；取样是观察记录，不重复扣除物质。");
    setTab("records");
  }
  function forkRecord(record: RecordEntry) {
    setRunning(false);
    const states = ["A", "B"].map((id) => ({
      ...structuredClone(record.state),
      id,
    }));
    setSave((p) => ({
      ...p,
      states,
      runs: states.map((state) =>
        beginRun(state, crypto.randomUUID(), record.run),
      ),
    }));
    setActive(0);
    setNote("已从完整库存建立两条独立分支；原样品和证据保留。");
  }
  function exportSave() {
    const url = URL.createObjectURL(
      new Blob([encode(save)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "petrogenesis-experiments.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const selected = save.records.filter((r) => compare.includes(r.id));
  return (
    <div className="app">
      <header>
        <div className="brandmark">◈</div>
        <div>
          <h1>
            地球的熔炉 <span>PETROGENESIS</span>
          </h1>
          <p>岩浆房实验室 / MAGMA CHAMBER LAB</p>
        </div>
        <div className="header-right">
          <span className="status">● 本地模拟</span>
          <button onClick={exportSave}>导出实验</button>
          <label className="button">
            导入存档
            <input
              hidden
              type="file"
              accept=".json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (f) {
                    setRunning(false);
                    setSave(decode(await f.text()));
                    setActive(0);
                    setNote("存档已恢复");
                  }
                } catch {
                  setNote("存档损坏或模型版本不兼容，当前实验保留。");
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>
      <nav>
        {levels.map((l, i) => (
          <button
            className={l.id === save.level ? "selected" : ""}
            onClick={() => changeLevel(l.id)}
            key={l.id}
          >
            <small>
              {l.id === "free" ? "∞" : String(i + 1).padStart(2, "0")}{" "}
              {save.completed.includes(l.id) ? "✓" : ""}
            </small>
            {l.title}
          </button>
        ))}
      </nav>
      <section className={"mission " + (result.passed ? "passed" : "")}>
        <div>
          <span className="eyebrow">{level.subtitle}</span>
          <h2>{result.passed ? "研究目标达成" : level.title}</h2>
          <p>{level.hint}</p>
        </div>
        <div className="mission-result">
          <strong>{result.passed ? "✓ 实验验证成功" : "◎ 当前观察"}</strong>
          <p>{result.text}</p>
        </div>
      </section>
      <main data-science-focus={focus}>
        <aside
          className={`panel controls ${level.separation ? "advanced-controls" : ""}`}
        >
          <div className="panel-title">
            <h3>实验控制</h3>
            <span>CONTROL</span>
          </div>
          {level.two && (
            <div className="toggle">
              {["A", "B"].map((id, i) => (
                <button
                  className={active === i ? "selected" : ""}
                  key={id}
                  onClick={() => {
                    setRunning(false);
                    setActive(i);
                  }}
                >
                  实验室 {id}
                </button>
              ))}
            </div>
          )}
          {save.level === "free" && (
            <>
              <label>
                初始岩浆
                <select
                  value={s.source}
                  onChange={(e) => {
                    setRunning(false);
                    update(() => createState(e.target.value, s.id));
                  }}
                >
                  {sources.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="button">
                导入组成 JSON
                <input
                  hidden
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f) {
                        const data = JSON.parse(await f.text());
                        if (
                          typeof data.source !== "string" ||
                          !data.source.trim()
                        )
                          throw Error();
                        const state = createState(
                          data.source,
                          s.id,
                          data.composition,
                        );
                        setRunning(false);
                        update(() => state);
                      }
                    } catch {
                      setNote(
                        "样品需含 source 来源及八种氧化物 composition，合计100 wt.%",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          )}
          <label>
            冷却路径{" "}
            <span title="教学近似：仅影响结构标签，不改变结晶运算或总化学组成。">
              ⓘ
            </span>
          </label>
          <div className="toggle">
            <button
              className={rate === "fast" ? "selected" : ""}
              onClick={() => setRate("fast")}
            >
              快速 · 近地表
            </button>
            <button
              className={rate === "slow" ? "selected" : ""}
              onClick={() => setRate("slow")}
            >
              缓慢 · 地下
            </button>
          </div>
          {save.level !== "A" && (
            <>
              <label>
                目标温度 <b>{Math.min(target, s.temperature)} °C</b>
              </label>
              <input
                aria-label="目标温度"
                type="range"
                min="650"
                max="1300"
                step="10"
                value={target}
                onChange={(e) => setTarget(+e.target.value)}
              />
              <button
                disabled={running || s.temperature <= 650}
                onClick={() =>
                  act({
                    type: "coolMagma",
                    target: Math.min(target, s.temperature),
                    rate,
                  })
                }
              >
                冷却至目标温度
              </button>
              <button
                disabled={running || s.temperature <= 650}
                onClick={() =>
                  act({ type: "stepTemperature", degrees: 25, rate })
                }
              >
                单步降温 −25°C
              </button>
            </>
          )}
          <button
            className="primary"
            disabled={!running && s.temperature <= 650}
            onClick={() => setRunning((v) => !v)}
          >
            {running ? "Ⅱ 暂停实验" : "▶ 开始自动冷却"}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              update(() => createState(s.source, s.id, s.initial));
            }}
          >
            ↺ 重置当前实验室
          </button>
          {level.separation && (
            <div className="separation">
              <h4>晶体分离</h4>
              <p>转移至堆晶库存，不从系统删除</p>
              <select
                aria-label="分离矿物"
                value={mineral}
                onChange={(e) => setMineral(e.target.value as Mineral)}
              >
                {minerals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {mass(s.crystals[m.id]).toFixed(2)} kg
                  </option>
                ))}
              </select>
              <label>
                分离比例 <b>{fraction}%</b>
              </label>
              <input
                aria-label="分离比例"
                type="range"
                min="0"
                max="100"
                value={fraction}
                onChange={(e) => setFraction(+e.target.value)}
              />
              <button
                disabled={running || mass(s.crystals[mineral]) < 1e-8}
                onClick={() =>
                  act({
                    type: "separateCrystals",
                    mineral,
                    fraction: fraction / 100,
                  })
                }
              >
                ↓ 分离已形成晶体
              </button>
            </div>
          )}
          <details className="playback-settings" open={!level.separation}>
            <summary>播放与模型设置</summary>
            <label>
              时间推进倍率
              <select
                aria-label="时间推进倍率"
                value={playback}
                onChange={(e) => setPlayback(+e.target.value)}
              >
                <option value={1}>1× 播放</option>
                <option value={4}>4× 播放</option>
              </select>
            </label>
            <p className="micro">
              倍率仅改变播放间隔，不改变每步计算。
              <br />
              固定压力 0.1 GPa · 无水体系
              <br />
              冷却单向进行，升温需重置
            </p>
          </details>
        </aside>
        <section className="panel visual">
          <div className="panel-title">
            <h3>岩浆房 {s.id}</h3>
            <span className="live">{running ? "● 演化中" : "● 已暂停"}</span>
          </div>
          <div className="temperature">
            {s.temperature.toFixed(0)}
            <span> °C</span>
          </div>
          <Chamber s={s} />
          <div className="phasebar">
            <div
              style={{ width: mass(s.liquid) + "%", background: "#e98b55" }}
            />
            <div
              style={{
                width: inventoryMass(s.crystals) + "%",
                background: "#b2c997",
              }}
            />
            <div
              style={{
                width: inventoryMass(s.removed) + "%",
                background: "#6b9eab",
              }}
            />
          </div>
          <div className="legend">
            <span>● 熔体</span>
            <span>● 房内晶体</span>
            <span>● 已分离</span>
          </div>
          <div className="sample-preview">
            <Specimen s={s} />
            <strong>{rock(s).name}</strong>
            <span>
              {rock(s).texture}结构示意 · 低温余量为未解析基质；不预测玻璃含量
            </span>
            <button onClick={() => collect("chamber")}>＋ 记录岩石样品</button>
          </div>
        </section>
        <aside className="panel info">
          <div className="panel-title">
            <h3>观测台</h3>
            <span>OBSERVATION</span>
          </div>
          <div className="metrics">
            {[
              [
                s.temperature <= 650 ? "未成晶基质" : "残余熔体",
                mass(s.liquid),
              ],
              ["房内晶体", inventoryMass(s.crystals)],
              ["堆晶库存", inventoryMass(s.removed)],
            ].map(([n, v]) => (
              <div key={n}>
                <span>{n}</span>
                <strong>
                  {Number(v).toFixed(2)} <small>kg</small>
                </strong>
              </div>
            ))}
          </div>
          <h4>已观察矿物</h4>
          {minerals.map((m) => (
            <div
              className={
                "mineral " +
                (focus === "minerals" && mineral === m.id
                  ? "selected-mineral"
                  : "")
              }
              key={m.id}
            >
              <i style={{ background: m.color }} />
              <div>
                <strong>{m.name}</strong>
                <progress max="100" value={mass(s.crystals[m.id])} />
              </div>
              <span>{mass(s.crystals[m.id]).toFixed(1)} kg</span>
            </div>
          ))}
          <div className="event">
            <span className="eyebrow">最新实验事件</span>
            <p>{s.events.at(-1)}</p>
          </div>
          <div className="collect">
            <button onClick={() => collect("liquid")}>记录残余熔体</button>
            {level.separation && (
              <button onClick={() => collect("cumulate")}>收集堆晶记录</button>
            )}
          </div>
        </aside>
        <Narrator
          state={save.narrative}
          onNext={(choice) =>
            setSave((p) => ({ ...p, narrative: advance(p.narrative, choice) }))
          }
          onSkip={() => {
            setSave((p) => ({ ...p, narrative: skip(p.narrative) }));
            setFocus(undefined);
          }}
          onQuiet={() =>
            setSave((p) => ({
              ...p,
              narrative: { ...skip(p.narrative), quiet: !p.narrative.quiet },
            }))
          }
          onHint={(tier) => {
            setRunning(false);
            setSave((p) => ({
              ...p,
              narrative: requestHint(p.narrative, p.level, p.states, tier),
            }));
          }}
          onCheck={() => {
            setRunning(false);
            setSave((p) => ({
              ...p,
              narrative:
                p.level === "E"
                  ? enqueue(
                      p.narrative,
                      lines(
                        `research-check:${p.narrative.sequence}`,
                        "证据检查",
                        [
                          [
                            "goddess",
                            research.checks.map((c) => c.text).join(" "),
                            "calm",
                          ],
                        ],
                        85,
                      ),
                      true,
                    )
                  : checkObjective(p.narrative, p.level, p.states),
            }));
          }}
          onInspect={() => act({ type: "inspectMinerals" })}
          onReplay={() => {
            const scene = introductions[save.level];
            if (scene)
              setSave((p) => ({
                ...p,
                narrative: enqueue(skip(p.narrative), scene, true),
              }));
          }}
          onRequest={act}
          onDirect={direct}
        />
      </main>
      <section className="panel analysis" data-focus={focus}>
        {save.narrative.evidence && (
          <div className="science-evidence">
            <div className="eyebrow">
              女神的标注 · 事件时数据快照（可随时重新观察）
            </div>
            <h3>{save.narrative.evidence.title}</h3>
            <p>{save.narrative.evidence.summary}</p>
            <details>
              <summary>展开组分与库存标记</summary>
              {save.narrative.evidence.annotations.map((a, i) => (
                <p key={i}>{a}</p>
              ))}
            </details>
          </div>
        )}
        <details className="analysis-options">
          <summary>分析工具与信息深度</summary>
          <div>
            {" "}
            <label>
              放大观察的矿物
              <select
                aria-label="观察矿物"
                value={mineral}
                onChange={(e) => setMineral(e.target.value as Mineral)}
              >
                {minerals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              信息深度
              <select
                value={depth}
                onChange={(e) => {
                  setDepth(+e.target.value);
                  setTab("history");
                }}
              >
                <option value="1">直观观察</option>
                <option value="2">基础科学分析</option>
                <option value="3">模型与质量账本</option>
              </select>
            </label>
          </div>
        </details>
        <div className="tabs">
          {[
            ["history", "实验进程"],
            ...(depth >= 2
              ? [
                  ["minerals", "矿物结晶曲线"],
                  ["chemistry", "主量元素"],
                ]
              : []),
            ...(depth >= 3
              ? [
                  ["balance", "质量平衡"],
                  ["model", "模型说明"],
                ]
              : []),
            ["compare", "两房路径对比"],
            ["records", "样品记录与对比"],
            ["research", "研究板"],
            ["science", "MELTS 研究档案"],
          ].map(([id, n]) => (
            <button
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {n}
            </button>
          ))}
        </div>
        {tab === "science" && <SciencePanel />}
        {tab === "research" && (
          <div className="research-board">
            <div className="report-card">
              <span className="eyebrow">档案 05 · 未知样品的两次证词</span>
              <h3>报告只告诉我们结果，历史需要证据。</h3>
              <p>
                1000°C 液相 · SiO₂ {researchTarget.SiO2.min.toFixed(2)}–
                {researchTarget.SiO2.max.toFixed(2)} wt.% · CaO{" "}
                {researchTarget.CaO.min.toFixed(2)}–
                {researchTarget.CaO.max.toFixed(2)} wt.%
              </p>
              <small>
                教学合成分析 · 区间为谜题观察容差 ·{" "}
                {researchTarget.modelVersion}
              </small>
            </div>
            <p>
              先记录两份650°C快／慢冷岩石，再重置或从样品分支，记录同温度的保留／分离液相。原记录一直保留。
            </p>
            <div className="evidence-slots">
              {evidenceSlots.map((slot) => (
                <label key={slot.key}>
                  {slot.label}
                  <select
                    aria-label={slot.label}
                    value={save.research?.[slot.key] ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSave((p) => {
                        const board = { ...p.research };
                        if (id) board[slot.key] = id;
                        else delete board[slot.key];
                        return { ...p, research: board };
                      });
                    }}
                  >
                    <option value="">选择已记录的证据…</option>
                    {save.records
                      .filter((r) => r.run)
                      .map((r, i) => (
                        <option value={r.id} key={r.id}>
                          #{i + 1} {r.name} · {r.state.id} ·{" "}
                          {r.state.temperature}°C ·{" "}
                          {r.kind === "chamber"
                            ? rock(r.state).texture
                            : r.kind === "liquid"
                              ? "液相"
                              : "堆晶"}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="evidence-verdict" aria-live="polite">
              {research.checks.map((c) => (
                <p key={c.id} className={c.passed ? "verified" : ""}>
                  {c.passed ? "✓" : "○"} {c.text}
                </p>
              ))}
              <strong>{research.text}</strong>
            </div>
          </div>
        )}
        {tab === "compare" && <ExperimentComparison states={save.states} />}
        {tab === "history" && (
          <div className="history">
            {s.events.map((e, i) => (
              <div key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {e}
              </div>
            ))}
            <p className="micro">
              结晶：熔体中的物质进入晶体。分离：把已有晶体转移到另一份库存。点击信息深度可查看数据。
            </p>
          </div>
        )}
        {tab === "minerals" && <Curve s={s} mode="minerals" />}
        {tab === "chemistry" && (
          <>
            <Curve s={s} mode="chemistry" />
            <table>
              <thead>
                <tr>
                  <th>氧化物</th>
                  <th>初始 wt.%</th>
                  <th>熔体 kg</th>
                  <th>熔体 wt.%</th>
                  <th>房内总体 wt.%</th>
                </tr>
              </thead>
              <tbody>
                {oxides.map((o, i) => (
                  <tr key={o}>
                    <td>{labels[i]}</td>
                    <td>{percent(s.initial)[o].toFixed(2)}</td>
                    <td>{s.liquid[o].toFixed(3)}</td>
                    <td>{percent(s.liquid)[o].toFixed(2)}</td>
                    <td>{percent(chamber(s))[o].toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === "balance" && (
          <>
            <p>
              原始质量 = 熔体 + 房内晶体 + 已分离晶体。每种氧化物独立核算，容差
              10⁻⁸ kg。
            </p>
            <table>
              <thead>
                <tr>
                  <th>组分</th>
                  <th>初始 kg</th>
                  <th>熔体 kg</th>
                  <th>房内固相 kg</th>
                  <th>分离固相 kg</th>
                  <th>误差 kg</th>
                </tr>
              </thead>
              <tbody>
                {balance(s).map((r, i) => (
                  <tr key={r.oxide}>
                    <td>{labels[i]}</td>
                    {[r.initial, r.liquid, r.solid, r.removed].map((v, j) => (
                      <td key={j}>{v.toFixed(4)}</td>
                    ))}
                    <td>{r.error.toExponential(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === "model" && (
          <div className="model">
            <h3>透明的教学代理，不是 MELTS</h3>
            <p>
              版本 {modelVersion}
              。样品为教学合成数据，矿物为固定氧化物端元近似。结晶驱动力随当前
              MgO、CaO、Al₂O₃ 等及温度变化，每次最多步进
              5°C，并以可用氧化物质量限制结晶量。
            </p>
            <p>
              保留晶体每5°C有1.5%物质返回熔体，表示有限交换的教学代理，随后重新计算结晶。分离晶体不再交换。这不是完整平衡结晶或真实反应速率。全系统每种氧化物均守恒。
            </p>
            <p>
              650°C时未成晶的物质记为未解析基质，不凭空生成未支持的矿物。快慢冷仅控制结构示意。仅在总体化学和矿物组合满足基性条件时标记玄武质／辉长质岩石；不使用正式
              TAS/QAPF 分类。无挥发分、压力变化、氧化还原或部分熔融预测。
            </p>
          </div>
        )}
        {tab === "records" && (
          <>
            <p>
              库存快照不会额外移出质量。选择两条记录比较；记录包含完整实验历史与模型版本。
            </p>
            <div className="records">
              {save.records.length === 0 ? (
                <p>
                  还没有样品。完成一次观察，点击“记录岩石样品”或“收集堆晶记录”。
                </p>
              ) : (
                save.records.map((r) => (
                  <article key={r.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={compare.includes(r.id)}
                        onChange={() =>
                          setCompare((v) =>
                            v.includes(r.id)
                              ? v.filter((id) => id !== r.id)
                              : [...v.slice(-1), r.id],
                          )
                        }
                      />
                      {r.name}
                    </label>
                    <p>
                      {r.state.id} 房 · {r.state.temperature}°C ·{" "}
                      {r.kind === "chamber"
                        ? rock(r.state).texture
                        : r.kind === "liquid"
                          ? "液相"
                          : "分离固相"}
                    </p>
                    <Specimen s={r.state} kind={r.kind} />
                    <p>{r.date}</p>
                    {r.run && (
                      <small>可重放 · {r.run.commands.length} 项操作</small>
                    )}
                    <button onClick={() => forkRecord(r)}>
                      从此记录分成两房
                    </button>
                    {r.run && (
                      <details>
                        <summary>操作日志与分离证词</summary>
                        {r.run.commands.map((c, i) => (
                          <p key={i}>
                            {i + 1}.{" "}
                            {c.kind === "cool"
                              ? `冷却至 ${c.targetC}°C · ${c.rate === "fast" ? "快速" : "缓慢"}`
                              : `分离 ${minerals.find((m) => m.id === c.mineral)!.name} ${c.fraction * 100}%`}
                          </p>
                        ))}
                      </details>
                    )}
                    <small>
                      {r.state.source} · {r.state.version}
                    </small>
                    <details>
                      <summary>形成历史与矿物</summary>
                      {r.state.events.map((e, i) => (
                        <p key={i}>{e}</p>
                      ))}
                      {minerals.map((m) => (
                        <p key={m.id}>
                          {m.name}：
                          {mass(
                            (r.kind === "cumulate"
                              ? r.state.removed
                              : r.state.crystals)[m.id],
                          ).toFixed(2)}{" "}
                          kg
                        </p>
                      ))}
                    </details>
                  </article>
                ))
              )}
            </div>
            {selected.length === 2 && (
              <table>
                <thead>
                  <tr>
                    <th>对比 / wt.%</th>
                    {selected.map((r) => (
                      <th key={r.id}>
                        {r.name} · {r.state.id}房
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {oxides.map((o, i) => (
                    <tr key={o}>
                      <td>{labels[i]}</td>
                      {selected.map((r) => {
                        const comp =
                          r.kind === "liquid"
                            ? r.state.liquid
                            : r.kind === "chamber"
                              ? chamber(r.state)
                              : chemistry(
                                  oxides.map((k) =>
                                    minerals.reduce(
                                      (v, m) => v + r.state.removed[m.id][k],
                                      0,
                                    ),
                                  ),
                                );
                        return (
                          <td key={r.id}>{percent(comp)[o].toFixed(3)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
      <footer>
        <span>{note}</span>
        <span>教学近似 · 无水质量基准 · {modelVersion}</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
