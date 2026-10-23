import type { State } from "../engine";
import { chamber, percent, rock } from "../engine";
import { labels, oxides } from "../data";
export function ExperimentComparison({ states }: { states: State[] }) {
  return (
    <div className="experiment-comparison">
      <h3>女神并列展开两条路径</h3>
      <p>
        横轴：温度（°C，降温方向向右）；纵轴：液相
        SiO₂（wt.%）。不同温度的数据不能直接当作分离效应。
      </p>
      <svg
        viewBox="0 0 720 180"
        className="chart"
        aria-label="两房温度与熔体SiO2路径对比"
      >
        <path d="M50 10V140H700" stroke="#8da6a7" fill="none" />
        {[0, 40, 80].map((v) => (
          <text key={v} x="10" y={144 - v * 1.5} fill="#afc3c3" fontSize="11">
            {v}
          </text>
        ))}
        {states.map((s, i) => (
          <polyline
            key={s.id}
            fill="none"
            stroke={i ? "#9bc9c4" : "#efbf82"}
            strokeWidth="2.5"
            points={s.history
              .map(
                (h) =>
                  `${50 + ((1300 - h.temperature) / 650) * 650},${140 - h.composition.SiO2 * 1.5}`,
              )
              .join(" ")}
          />
        ))}
        <text x="50" y="165" fill="#afc3c3" fontSize="11">
          1300°C
        </text>
        <text x="640" y="165" fill="#afc3c3" fontSize="11">
          650°C
        </text>
      </svg>
      <div className="legend">
        <span style={{ color: "#efbf82" }}>● A房</span>
        <span style={{ color: "#9bc9c4" }}>● B房</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>实际结果</th>
            {states.map((s) => (
              <th key={s.id}>
                {s.id}房 · {s.temperature}°C · {rock(s).texture}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>产物</td>
            {states.map((s) => (
              <td key={s.id}>{rock(s).name}</td>
            ))}
          </tr>
          {oxides.map((o, i) => (
            <tr key={o}>
              <td>{labels[i]} 房内总体 wt.%</td>
              {states.map((s) => (
                <td key={s.id}>{percent(chamber(s))[o].toFixed(3)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
