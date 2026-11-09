import { useState } from "react";
import retainedRaw from "./packs/morb-retain.json?raw";
import removedRaw from "./packs/morb-remove.json?raw";
import {
  validatePack,
  liquidComposition,
  total,
  audit,
  sumComponents,
  advancePack,
  type SciencePack,
} from "./pack";
export const builtInPacks = [
  validatePack(JSON.parse(retainedRaw)),
  validatePack(JSON.parse(removedRaw)),
];
const names: Record<string, string> = {
  liquid1: "熔体",
  olivine1: "橄榄石",
  clinopyroxene1: "单斜辉石",
  plagioclase1: "斜长石",
  spinel1: "尖晶石",
  apatite1: "磷灰石",
  fluid1: "流体",
};
export function SciencePanel() {
  const [packs, setPacks] = useState<SciencePack[]>(builtInPacks);
  const [selected, setSelected] = useState(0),
    [index, setIndex] = useState(0),
    [error, setError] = useState("");
  const pack = packs[selected],
    f = pack.frames[index],
    liquid = liquidComposition(f);
  const removed = total(f.cumulativeRemovedComponentsKg);
  const maxError = audit(
    pack.basis.initialComponentsKg,
    sumComponents([
      sumComponents(f.retainedPhases.map((p) => p.componentsKg)),
      f.cumulativeRemovedComponentsKg,
    ]),
  );
  return (
    <div className="science-panel">
      <span className="eyebrow">真实相平衡计算 · 离线研究档案</span>
      <h3>
        {selected > 1
          ? "导入的相平衡研究档案"
          : "同一份 MORB，晶体留下，还是离开？"}
      </h3>
      <p>
        alphaMELTS 2.3.2 / rhyolite-MELTS 1.0.2 · 500 bar（0.05 GPa）·
        封闭氧体系 · 保留流体。每个节点均独立求平衡并核对元素库存。
      </p>
      <div className="toggle">
        {packs.map((p, i) => (
          <button
            key={i}
            className={selected === i ? "selected" : ""}
            onClick={() => {
              setSelected(i);
              setIndex(0);
            }}
          >
            {i > 1 ? "导入档案 · " : ""}
            {p.scenario.solidPolicy === "retain-all"
              ? "保留晶体 · 继续平衡"
              : "每步分离全部固相"}
          </button>
        ))}
      </div>
      <label>
        查看计算节点{" "}
        <b>
          {f.temperatureC}°C · {index + 1}/{pack.frames.length}
        </b>
        <input
          aria-label="MELTS计算节点"
          type="range"
          min="0"
          max={pack.frames.length - 1}
          step="1"
          value={index}
          onChange={(e) => setIndex(+e.target.value)}
        />
      </label>
      <button
        disabled={index === pack.frames.length - 1}
        onClick={() => setIndex(advancePack(pack, index, "next"))}
      >
        下一计算节点 −5°C
      </button>
      <p>
        残余熔体 <b>{liquid.mass.toFixed(3)} kg</b> · SiO₂{" "}
        <b>{(liquid.wtPct.sio2 ?? 0).toFixed(3)} wt.%</b> · MgO{" "}
        <b>{(liquid.wtPct.mgo ?? 0).toFixed(3)} wt.%</b> · 累计移出{" "}
        <b>{removed.toFixed(3)} kg</b>
      </p>
      <div className="phasebar" aria-label="房内各相与累计移出质量比例">
        {f.retainedPhases.map((p, i) => (
          <div
            key={p.batchId}
            title={`${names[p.id] ?? p.id} ${p.massKg.toFixed(3)} kg`}
            style={{
              width: `${p.massKg}%`,
              background: [
                "#e49665",
                "#a3bf83",
                "#6da79d",
                "#c3c9bb",
                "#bba071",
              ][i % 5],
            }}
          />
        ))}
        <div style={{ width: `${removed}%`, background: "#648aa3" }} />
      </div>
      <table>
        <thead>
          <tr>
            <th>相／批次</th>
            <th>平衡后 kg</th>
            <th>本步移出 kg</th>
            <th>房内保留 kg</th>
          </tr>
        </thead>
        <tbody>
          {f.equilibratedPhases.map((p) => (
            <tr key={p.batchId}>
              <td>
                {names[p.id] ?? p.id} · {p.batchId}
              </td>
              <td>{p.massKg.toFixed(4)}</td>
              <td>
                {(
                  f.removedThisStep.find((x) => x.batchId === p.batchId)
                    ?.massKg ?? 0
                ).toFixed(4)}
              </td>
              <td>
                {(
                  f.retainedPhases.find((x) => x.batchId === p.batchId)
                    ?.massKg ?? 0
                ).toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        当前全系统最大元素误差 {maxError.toExponential(2)}{" "}
        kg。显示百分比由绝对质量计算；FeO 与 Fe₂O₃ 分别输入，审计追踪 Fe、O
        等元素。
      </p>
      <details>
        <summary>路径曲线、来源与适用边界</summary>
        <svg
          viewBox="0 0 720 200"
          className="chart"
          role="img"
          aria-label="离散节点的液相SiO₂组成；温度向右降低"
        >
          <path d="M65 15V160H690" fill="none" stroke="#819d9c" />
          {[40, 50, 60].map((v) => (
            <text
              key={v}
              x="4"
              y={160 - (v - 40) * 5}
              fill="#bac9c2"
              fontSize="12"
            >
              {v}%
            </text>
          ))}
          {builtInPacks.map((p, i) => (
            <g key={i} fill={i ? "#e8b177" : "#9ec0ae"}>
              {p.frames.map((f, j) => (
                <circle
                  key={j}
                  cx={65 + (j / (p.frames.length - 1)) * 620}
                  cy={160 - ((liquidComposition(f).wtPct.sio2 ?? 40) - 40) * 5}
                  r="3"
                />
              ))}
            </g>
          ))}
          <text x="65" y="190" fill="#bac9c2" fontSize="12">
            1235°C → 1110°C · 绿色保留 / 金色分离 · 液相SiO₂ wt.%
          </text>
        </svg>
        <p>
          {selected > 1
            ? "当前导入档案的原始组成合计 "
            : "内置档案来自官方教程引用的 MORB 输入，原始合计 "}
          {pack.basis.originalTotal.toFixed(2)}
          ，保留原值及归一化因子。教学沙盒的八氧化物样品不能直接替代此输入。
        </p>
        <p>
          首版覆盖1235–1110°C、5°C离散节点和两种固相策略。分离路径扩展到1100°C时发生不收敛；未把失败结果加入档案。任意分离比例、压力变化和新的源组成需要重新计算。
        </p>
        <p>
          曲线仅表示内置两条计算路径。求解器不预测晶粒尺寸；本档案不用于推断现实样品的唯一历史。
        </p>
        <p>
          来源：{pack.provenance.sourceUrl}
          <br />
          {pack.provenance.citation}
          <br />
          引擎：{pack.solver.version} · 原始输入 SHA256：
          {pack.provenance.rawInputSha256}
        </p>
      </details>
      <label className="button">
        导入受支持的科学资料包
        <input
          hidden
          type="file"
          accept=".json"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 5_000_000) throw Error("FILE_TOO_LARGE");
                const p = validatePack(JSON.parse(await file.text()));
                setPacks([...builtInPacks, p]);
                setSelected(2);
                setIndex(0);
                setError(
                  "导入成功；已审计账本，外部来源真实性需由提供者负责。",
                );
              }
            } catch (ex) {
              setError(
                `拒绝导入：${ex instanceof Error ? ex.message : "无效数据"}；当前档案保留。`,
              );
            }
            e.target.value = "";
          }}
        />
      </label>
      <p role="status">{error}</p>
    </div>
  );
}
