import { useEffect, useState } from "react";
import {
  characters,
  expressionNames,
  type Expression,
  type Motion,
} from "./characters";
import { currentNode } from "./dialogue";
import type { NarrativeState } from "./events";
import type { GeologicalAction } from "./actions";
import type { Focus } from "./science";
import { planPresentation } from "./director";
export function GoddessPortrait({
  expression,
  motion,
}: {
  expression: Expression;
  motion: Motion;
}) {
  const mouths = {
    calm: "M70 95 Q80 100 90 95",
    proud: "M70 94 Q82 105 94 92",
    surprised: "M76 97 Q82 88 86 97 Q82 106 76 97",
    wry: "M73 98 L88 98",
    warm: "M70 94 Q81 108 92 94",
  };
  return (
    <svg
      className={`goddess-portrait motion-${motion}`}
      viewBox="0 0 160 185"
      role="img"
      aria-label={`地质女神，${expressionNames[expression]}（原创SVG占位立绘）`}
    >
      <circle
        cx="80"
        cy="70"
        r="59"
        fill="none"
        stroke="#bd9e64"
        strokeDasharray="3 9"
      />
      <path d="M42 69Q28 9 80 15Q134 12 124 78L133 145H29Z" fill="#c8dadb" />
      <path d="M48 65Q40 103 80 119Q119 106 113 64L82 37Z" fill="#efdac7" />
      <path
        d="M38 72Q30 16 80 19Q125 16 124 69L100 46L83 65L68 43L48 76Z"
        fill="#d9e7e3"
      />
      <path
        d="M62 119L98 119L126 152L137 183H24L35 152Z"
        fill="#263c43"
        stroke="#a2946b"
      />
      <path d="M64 120L80 145L96 120L88 171L80 183L72 171Z" fill="#abc3b6" />
      <path d="M80 130L89 143L80 156L71 143Z" fill="#d6b16e" />
      <path
        d="M28 162L61 169L42 176M132 162L99 169L118 176"
        stroke="#acbeae"
        fill="none"
      />
      <path d="M48 34L63 18L80 29L97 18L112 34L80 39Z" fill="#b39b69" />
      <path d="M80 15L86 26L80 37L74 26Z" fill="#a4d3c5" />
      {expression === "warm" ? (
        <path
          d="M56 80Q64 73 72 80M89 80Q97 73 105 80"
          fill="none"
          stroke="#356668"
          strokeWidth="3"
        />
      ) : (
        <>
          <path
            d="M54 76Q64 70 73 76M88 76Q97 70 106 76"
            fill="none"
            stroke="#4b5c57"
            strokeWidth="2"
          />
          <ellipse
            cx="64"
            cy="81"
            rx="4"
            ry={expression === "wry" ? 2 : 6}
            fill="#3f8784"
          />
          <ellipse
            cx="97"
            cy="81"
            rx="4"
            ry={expression === "surprised" ? 7 : expression === "wry" ? 2 : 6}
            fill="#3f8784"
          />
        </>
      )}
      <path
        d={mouths[expression]}
        fill="none"
        stroke="#996967"
        strokeWidth="2"
      />
      <circle cx="48" cy="91" r="4" fill="#d2a889" opacity=".6" />
      <circle cx="113" cy="91" r="4" fill="#d2a889" opacity=".6" />
    </svg>
  );
}
export function Narrator({
  state,
  onNext,
  onSkip,
  onQuiet,
  onHint,
  onCheck,
  onInspect,
  onReplay,
  onRequest,
  onDirect,
}: {
  state: NarrativeState;
  onNext: (choice?: string) => void;
  onSkip: () => void;
  onQuiet: () => void;
  onHint: (tier: 1 | 2 | 3) => void;
  onCheck: () => void;
  onInspect: () => void;
  onReplay: () => void;
  onRequest: (a: GeologicalAction) => void;
  onDirect: (focus: Focus) => void;
}) {
  const [fast, setFast] = useState(false);
  const [history, setHistory] = useState(false);
  const node = state.active ? currentNode(state.active) : undefined;
  useEffect(() => {
    if (!fast || !node || node.choices) return;
    const t = setTimeout(() => onNext(), 900);
    return () => clearTimeout(t);
  }, [fast, node, onNext]);
  const focus = planPresentation(node)?.focus;
  useEffect(() => {
    if (focus) onDirect(focus);
  }, [state.active?.scene.id, node?.id, focus, onDirect]);
  return (
    <section className="narrator panel" aria-label="女神叙事与研究助手">
      <div className="portrait-wrap">
        <GoddessPortrait
          expression={node?.expression ?? "calm"}
          motion={node?.motion ?? "idle"}
        />
        <small>地质女神 · 教学引导</small>
      </div>
      <div className="dialogue-body">
        <div className="dialogue-heading">
          <span className="eyebrow">
            {state.active?.scene.title ?? "实验空间 · 随时可以求助"}
          </span>
          <div>
            <button
              onClick={() => setHistory((v) => !v)}
              aria-expanded={history}
            >
              对话历史
            </button>
            <button onClick={onReplay}>回看本关开场</button>
            <button onClick={onQuiet}>
              {state.quiet ? "开启自动对话" : "安静模式"}
            </button>
          </div>
        </div>
        <strong className="speaker">
          {node ? characters[node.speaker].name : "地质女神"}
        </strong>
        <p className="dialogue-text" aria-live="polite">
          {node?.text ??
            "你控制条件，我负责把过程交给模拟器。想看懂哪一步，随时叫我；目标和操作说明就在上方。"}
        </p>
        <div className="dialogue-actions">
          {node?.choices?.map((c) => (
            <button key={c.next} onClick={() => onNext(c.next)}>
              {c.label}
            </button>
          ))}
          {node && !node.choices && (
            <button className="primary" onClick={() => onNext()}>
              继续对话 →
            </button>
          )}
          {node?.request && (
            <button onClick={() => onRequest(node.request!)}>
              请执行这项观察
            </button>
          )}
          {node && (
            <>
              <button onClick={() => setFast((v) => !v)} aria-pressed={fast}>
                {fast ? "停止快进" : "快进"}
              </button>
              <button
                onClick={() => {
                  setFast(false);
                  onSkip();
                }}
              >
                跳过剧情
              </button>
            </>
          )}
        </div>
        <div className="research-actions">
          <button onClick={onInspect}>暂停并观察矿物</button>
          <button onClick={() => onHint(1)}>现象提示</button>
          <button onClick={() => onHint(2)}>变量提示</button>
          <button onClick={() => onHint(3)}>原理解释</button>
          <button onClick={onCheck}>检查研究目标</button>
        </div>
        <p className="action-feedback" role="status">
          {state.feedback}
        </p>
        {history && (
          <div className="dialogue-history" aria-label="对话历史记录">
            {state.history.map((scene, i) => (
              <details key={i}>
                <summary>{scene.title}（含已跳过文本／分支）</summary>
                {scene.nodes.map((n) => (
                  <p key={n.id}>
                    <b>{characters[n.speaker].name}：</b>
                    {n.text}
                  </p>
                ))}
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
