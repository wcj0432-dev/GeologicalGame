import React, { useState, useEffect } from "react";
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
  cool,
  separate,
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
import "./style.css";
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
            <polygon
              key={i}
              points={`${p.x},${p.y - p.size} ${p.x + p.size},${p.y} ${p.x},${p.y + p.size} ${p.x - p.size},${p.y}`}
              fill={p.color}
            />
          ))}
      </g>
      <path d="M40 17h260M40 330h260" stroke="#697578" strokeWidth="3" />
      <text x="170" y="345" fill="#80969a" textAnchor="middle" fontSize="10">
        示意晶体 • 数量与质量比例关联
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
                  `${50 + (650 * j) / Math.max(1, values.length - 1)},${140 - (120 * v) / max}`,
              )
              .join(" ")}
          />
        ))}
        <text x="50" y="163" fill="#9aafb3" fontSize="11">
          开始 1300°C
        </text>
        <text x="590" y="163" fill="#9aafb3" fontSize="11">
          当前 {s.temperature}°C →
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
          ；横轴为实验步骤
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
  const [tab, setTab] = useState("history");
  const [note, setNote] = useState("实验自动保存在此浏览器");
  const [depth, setDepth] = useState(1);
  const [compare, setCompare] = useState<string[]>([]);
  const level = levels.find((l) => l.id === save.level)!;
  const s = save.states[active];
  const result = evaluate(save.level, save.states);
  useEffect(() => {
    try {
      localStorage.setItem(saveKey, encode(save));
    } catch {
      setNote("浏览器存储不可用，请导出实验。");
    }
  }, [save]);
  useEffect(() => {
    if (result.passed && !save.completed.includes(save.level))
      setSave((p) => ({ ...p, completed: [...p.completed, p.level] }));
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
          states[active] = cool(
            current,
            Math.max(650, current.temperature - 10),
            rate,
          );
          return { ...p, states };
        }),
      180,
    );
    return () => clearInterval(timer);
  }, [running, active, rate]);
  function update(fn: (state: State) => State) {
    setSave((p) => ({
      ...p,
      states: p.states.map((v, i) => (i === active ? fn(v) : v)),
    }));
  }
  function changeLevel(id: string) {
    setRunning(false);
    setActive(0);
    setTab("history");
    setDepth(id === "A" ? 1 : 2);
    setSave((p) => ({
      ...p,
      level: id,
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
      liquid: s.temperature <= 650 ? "玻璃基质（未成晶组分）" : "残余熔体",
      cumulate: "堆晶产物",
    };
    setSave((p) => ({
      ...p,
      records: [
        ...p.records,
        {
          id: crypto.randomUUID(),
          name: names[kind],
          kind,
          state: structuredClone(s),
          date: new Date().toLocaleString("zh-CN"),
        },
      ],
    }));
    setNote("已创建库存快照；取样是观察记录，不重复扣除物质。");
    setTab("records");
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
              {i === 4 ? "∞" : String(i + 1).padStart(2, "0")}{" "}
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
      <main>
        <aside className="panel controls">
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
                  update((v) => cool(v, Math.min(target, v.temperature), rate))
                }
              >
                冷却至目标温度
              </button>
              <button
                disabled={running || s.temperature <= 650}
                onClick={() =>
                  update((v) =>
                    cool(v, Math.max(650, v.temperature - 25), rate),
                  )
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
                  update((v) => separate(v, mineral, fraction / 100))
                }
              >
                ↓ 分离已形成晶体
              </button>
            </div>
          )}
          <p className="micro">
            固定压力 0.1 GPa · 无水体系
            <br />
            冷却单向进行，升温需重置
          </p>
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
            <strong>{rock(s).name}</strong>
            <span>
              {rock(s).texture}结构示意 · 未成晶组分在终点记为玻璃基质
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
            <div className="mineral" key={m.id}>
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
        </aside>
      </main>
      <section className="panel analysis">
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
            ["records", "样品记录与对比"],
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
              650°C时未成晶的物质记为玻璃基质，不凭空生成未支持的矿物。快慢冷仅控制结构示意。仅在总体化学和矿物组合满足基性条件时标记玄武质／辉长质岩石；不使用正式
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
                    <p>{r.date}</p>
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
