import { inventoryMass, mass, percent, rock, type State } from "./engine";
import { minerals } from "./data";
export const levels = [
  {
    id: "A",
    title: "同一团岩浆，两种石头",
    subtitle: "冷却与结构",
    hint: "在 A 房快速冷却，在 B 房缓慢冷却到 650°C，然后比较样品。冷却方式改变结构，不改变封闭系统总体化学。",
    two: true,
    separation: false,
  },
  {
    id: "B",
    title: "谁先结晶？",
    subtitle: "观察与归纳",
    hint: "逐步降温。留意首次出现事件，记录三种矿物。顺序只代表这个样品和这个代理模型。",
    two: false,
    separation: false,
  },
  {
    id: "C",
    title: "把晶体捞出来！",
    subtitle: "分离与演化",
    hint: "两房降到约 1100°C，在其中一房分离晶体，再继续冷却到同一温度。让残余熔体 SiO₂ 相差至少 0.2 个百分点。",
    two: true,
    separation: true,
  },
  {
    id: "D",
    title: "一份岩浆，两份宝藏",
    subtitle: "产物与守恒",
    hint: "在早期结晶阶段收集晶体。目标：至少 5 kg 堆晶、其中橄榄石与辉石超过 60%；保留至少 15 kg 熔体，且其 SiO₂ 比初始高 1 个百分点。",
    two: false,
    separation: true,
  },
  {
    id: "free",
    title: "自由实验室",
    subtitle: "没有标准答案",
    hint: "探索不同样品和冷却路径，收集产物并保存比较。模型仅适用于无水、低压教学系统。",
    two: true,
    separation: true,
  },
];
export function evaluate(
  id: string,
  states: State[],
): { passed: boolean; text: string } {
  const [a, b] = states;
  if (id === "A") {
    const ra = rock(a),
      rb = rock(b);
    const passed =
      a.temperature <= 650 &&
      b.temperature <= 650 &&
      ra.name !== rb.name &&
      [ra.name, rb.name].includes("辉长质岩石") &&
      [ra.name, rb.name].includes("玄武质岩石");
    return {
      passed,
      text: passed
        ? "同样的总体组成形成了两种结构。快冷细粒，慢冷粗粒：结构与化学组成是两个维度。"
        : "需要两房均冷却到650°C，并获得不同结构的基性岩石。",
    };
  }
  if (id === "B") {
    const observed = minerals.filter(
      (m) => mass(a.crystals[m.id]) + mass(a.removed[m.id]) > 0.1,
    ).length;
    return {
      passed: observed === 3,
      text: `已观察 ${observed}/3 种矿物。${observed === 3 ? "结晶条件随温度与熔体组成变化；这不是所有岩浆通用的固定清单。" : "继续降温并查看首次出现事件。"}`,
    };
  }
  if (id === "C") {
    const diff = Math.abs(percent(a.liquid).SiO2 - percent(b.liquid).SiO2);
    const passed =
      Math.abs(a.temperature - b.temperature) < 1e-6 &&
      mass(a.liquid) > 1 &&
      mass(b.liquid) > 1 &&
      diff >= 0.2 &&
      inventoryMass(a.removed) + inventoryMass(b.removed) > 0;
    return {
      passed,
      text: `两房熔体 SiO₂ 差 ${diff.toFixed(2)} 个百分点。${passed ? "分离改变了后续交换与结晶路径，组分仍全部留在系统账本中。" : "在相同温度比较，并保留足够熔体；分离后需继续冷却才会产生路径差异。"}`,
    };
  }
  if (id === "D") {
    const removed = inventoryMass(a.removed),
      early = mass(a.removed.olivine) + mass(a.removed.pyroxene),
      delta = percent(a.liquid).SiO2 - percent(a.initial).SiO2;
    const passed =
      removed >= 5 &&
      early / removed >= 0.6 &&
      mass(a.liquid) >= 15 &&
      delta >= 1;
    return {
      passed,
      text: `堆晶 ${removed.toFixed(1)} kg · 早期矿物 ${removed ? ((early / removed) * 100).toFixed(0) : 0}% · 熔体 ${mass(a.liquid).toFixed(1)} kg · SiO₂ 增加 ${delta.toFixed(1)} 个百分点。${passed ? "两份宝藏来自同一账本：没有凭空生成或消失的物质。" : "可在更早阶段收集富含橄榄石与辉石的晶体，再继续冷却使熔体演化。"}`,
    };
  }
  return {
    passed: false,
    text: "自由探索：每次实验都是可保存、可比较的观察记录。",
  };
}
