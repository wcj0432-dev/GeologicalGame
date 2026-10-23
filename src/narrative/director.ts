import type { DialogueNode } from "./dialogue";
import type { Focus } from "./science";
export type Presentation = { focus: Focus; tab: Focus; depth: 2 | 3 };
// Pure visual plan: interruption/skip discards this plan, never rewinds a simulation.
export function planPresentation(
  node?: DialogueNode,
): Presentation | undefined {
  if (!node?.focus) return undefined;
  return {
    focus: node.focus,
    tab: node.focus,
    depth: node.focus === "balance" ? 3 : 2,
  };
}
