import { useId } from "react";
import { mass, inventoryMass, rock, type State } from "../engine";
import { minerals } from "../data";
export function Specimen({ s, kind = "chamber" }: { s: State; kind?: string }) {
  const id = useId();
  const inv = kind === "cumulate" ? s.removed : s.crystals;
  const total =
    kind === "cumulate"
      ? inventoryMass(inv)
      : mass(s.liquid) + inventoryMass(inv);
  const coarse = rock(s).texture === "粗粒" || kind === "cumulate";
  const parts = minerals.flatMap((m, i) =>
    Array.from(
      { length: Math.round((150 * mass(inv[m.id])) / Math.max(1e-8, total)) },
      (_, j) => ({
        x: 12 + ((j * 71 + i * 31) % 180),
        y: 12 + ((j * 37 + i * 43) % 95),
        color: m.color,
        type: i,
        size: coarse ? 6 : 2,
      }),
    ),
  );
  return (
    <svg
      className="specimen"
      viewBox="0 0 210 125"
      role="img"
      aria-label={`${kind === "cumulate" ? "堆晶" : kind === "liquid" ? "液相" : rock(s).texture + "岩石"}样品示意；矿物面积按质量比例抽样，不代表体积`}
    >
      <defs>
        <clipPath id={id}>
          <path d="M19 29L61 10L148 12L190 37L199 83L155 111L58 116L10 81Z" />
        </clipPath>
      </defs>
      <path
        d="M19 33L61 14L148 16L190 41L199 87L155 119L58 124L10 85Z"
        fill="#080f14"
      />
      <g clipPath={`url(#${id})`}>
        <path
          d="M0 0H210V125H0Z"
          fill={
            kind === "liquid" || (kind === "chamber" && s.temperature > 700)
              ? "#bb6846"
              : "#344046"
          }
        />
        {kind !== "liquid" &&
          parts.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${i * 31})`}>
              <path
                d={
                  p.type === 0
                    ? `M${-p.size} 0L0 ${-p.size}L${p.size} 0L0 ${p.size}Z`
                    : p.type === 1
                      ? `M${-p.size} ${-p.size / 2}H${p.size}V${p.size / 2}H${-p.size}Z`
                      : `M${-p.size * 1.4} -1H${p.size * 1.4}V2H${-p.size * 1.4}Z`
                }
                fill={p.color}
              />
            </g>
          ))}
        <path
          d="M22 30L60 12L89 67L18 81ZM148 13L189 37L166 90L137 69Z"
          fill="#c3d8ce"
          opacity=".08"
        />
      </g>
      <path
        d="M19 29L61 10L148 12L190 37L199 83L155 111L58 116L10 81Z"
        fill="none"
        stroke="#8ba29e"
        strokeOpacity=".5"
      />
    </svg>
  );
}
