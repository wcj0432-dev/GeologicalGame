import goddessArt from "../assets/goddess.png";
import expressionArt from "../assets/goddess-expressions.png";
import { useEffect, useState, useRef } from "react";
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
function PortraitGallery({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="art-gallery"
      aria-label="女神立绘"
      onCancel={onClose}
    >
      <button autoFocus onClick={onClose}>
        关闭立绘
      </button>
      <img src={goddessArt} alt="地质女神 · 原创现代日系半身立绘" />
    </dialog>
  );
}
export function GoddessPortrait({
  expression,
  motion,
}: {
  expression: Expression;
  motion: Motion;
}) {
  const positions = {
    calm: "0% 0%",
    proud: "50% 0%",
    surprised: "100% 0%",
    wry: "0% 100%",
    warm: "50% 100%",
  };
  return (
    <div className={`goddess-art motion-${motion}`}>
      <div
        className="expression-sprite"
        role="img"
        aria-label={`地质女神 · ${expressionNames[expression]}`}
        style={{
          backgroundImage: `url(${expressionArt})`,
          backgroundPosition: positions[expression],
        }}
      />
      <span className="expression-tag">{expressionNames[expression]}</span>
    </div>
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
  const [help, setHelp] = useState(false);
  const [gallery, setGallery] = useState(false);
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
      {gallery && <PortraitGallery onClose={() => setGallery(false)} />}
      <div className="portrait-wrap">
        <GoddessPortrait
          expression={node?.expression ?? "calm"}
          motion={node?.motion ?? "idle"}
        />
        <small>地质女神 · 教学引导</small>
        <button className="portrait-expand" onClick={() => setGallery(true)}>
          查看立绘
        </button>
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
          <button aria-expanded={help} onClick={() => setHelp((v) => !v)}>
            问女神
          </button>
          {help && (
            <div className="help-options">
              <button onClick={() => onHint(1)}>现象提示</button>
              <button onClick={() => onHint(2)}>变量提示</button>
              <button onClick={() => onHint(3)}>原理解释</button>
              <button onClick={onCheck}>检查研究目标</button>
            </div>
          )}
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
