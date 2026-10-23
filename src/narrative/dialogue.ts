import type { Expression, Motion } from "./characters";
import type { Focus } from "./science";
import type { GeologicalAction } from "./actions";
export type DialogueNode = {
  id: string;
  speaker: "goddess" | "player";
  text: string;
  expression?: Expression;
  motion?: Motion;
  next?: string;
  choices?: { label: string; next: string }[];
  focus?: Focus;
  request?: GeologicalAction;
};
export type Scene = {
  id: string;
  title: string;
  priority: number;
  nodes: DialogueNode[];
};
export type DialogueState = { scene: Scene; node: string };
export function currentNode(state: DialogueState) {
  return state.scene.nodes.find((n) => n.id === state.node)!;
}
export function advanceDialogue(
  state: DialogueState,
  choice?: string,
): DialogueState | undefined {
  const node = currentNode(state);
  const target = choice ?? node.next;
  if (choice && !node.choices?.some((c) => c.next === choice)) return state;
  if (node.choices && !choice) return state;
  const next = target
    ? state.scene.nodes.find((n) => n.id === target)
    : state.scene.nodes[state.scene.nodes.indexOf(node) + 1];
  return next ? { scene: state.scene, node: next.id } : undefined;
}
export function lines(
  id: string,
  title: string,
  texts: [DialogueNode["speaker"], string, Expression?][],
  priority = 40,
  focus?: Focus,
): Scene {
  return {
    id,
    title,
    priority,
    nodes: texts.map(([speaker, text, expression], i) => ({
      id: String(i),
      speaker,
      text,
      expression,
      motion: focus && i === 0 ? "point" : "idle",
      focus: i === 0 ? focus : undefined,
    })),
  };
}
