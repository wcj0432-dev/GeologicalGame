export type Expression = "calm" | "proud" | "surprised" | "wry" | "warm";
export type Motion = "idle" | "point" | "nod";
export const characters = {
  goddess: { name: "地质女神", role: "地质条件的操控者" },
  player: { name: "我", role: "实验者" },
};
export const expressionNames: Record<Expression, string> = {
  calm: "从容",
  proud: "小得意",
  surprised: "惊讶",
  wry: "无语",
  warm: "欣慰",
};
