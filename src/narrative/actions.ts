import { cool, separate, mass, type State } from "../engine";
import { minerals, type Mineral } from "../data";
export type CoolingRate = "fast" | "slow";
export type GeologicalAction =
  | { type: "coolMagma"; target: number; rate: CoolingRate }
  | { type: "stepTemperature"; degrees: number; rate: CoolingRate }
  | { type: "advanceSimulation"; rate: CoolingRate }
  | { type: "separateCrystals"; mineral: Mineral; fraction: number }
  | { type: "inspectMinerals" };
export type FutureProcess =
  | "tectonicExtension"
  | "mantleUpwelling"
  | "thermalAnomaly"
  | "magmaEmplacement"
  | "decompressionMelting"
  | "fluxMelting"
  | "magmaMixing"
  | "upliftErosion"
  | "basinEvolution";
export type ActionResult =
  | { ok: true; state: State; intent: string; process: string; limit: string }
  | { ok: false; state: State; error: string };
export function performAction(
  state: State,
  action: GeologicalAction,
  level: string,
): ActionResult {
  try {
    if (action.type === "inspectMinerals")
      return {
        ok: true,
        state,
        intent: "看清晶体",
        process: "暂停与观察已有矿物",
        limit: "观察不改变任何库存",
      };
    if (action.type === "separateCrystals") {
      if (!["C", "D", "free"].includes(level))
        throw Error("本关尚未开放晶体分离。");
      if (
        !minerals.some((m) => m.id === action.mineral) ||
        mass(state.crystals[action.mineral]) < 1e-8 ||
        action.fraction <= 0
      )
        throw Error("没有可分离的晶体，请先降温并选择非零比例。");
      return {
        ok: true,
        state: separate(state, action.mineral, action.fraction),
        intent: "收集晶体",
        process: "把指定固相移入堆晶库存",
        limit: "只能移动已存在的固体；分离瞬间液相不变",
      };
    }
    const target =
      action.type === "coolMagma"
        ? action.target
        : Math.max(
            650,
            state.temperature -
              (action.type === "stepTemperature" ? action.degrees : 10),
          );
    if (
      action.type === "stepTemperature" &&
      (!Number.isFinite(action.degrees) || action.degrees <= 0)
    )
      throw Error("降温步长必须为正数。");
    if (target >= state.temperature)
      throw Error("请选择低于当前温度的目标；升温需重新开始实验。");
    return {
      ok: true,
      state: cool(state, target, action.rate),
      intent: "促使岩浆冷却",
      process:
        action.rate === "fast" ? "设置近地表快冷路径" : "设置地下慢冷路径",
      limit: "快慢冷只影响结构近似，化学规则完全相同",
    };
  } catch (error) {
    return {
      ok: false,
      state,
      error: error instanceof Error ? error.message : "操作无法执行",
    };
  }
}
