import { lines, type Scene } from "./dialogue";
export const introductions: Record<string, Scene> = {
  A: {
    id: "intro:A",
    title: "序幕 · 创造两块石头",
    priority: 60,
    nodes: [
      {
        id: "0",
        speaker: "goddess",
        expression: "proud",
        text: "欢迎来到地球的熔炉。我将教你创造岩石。",
        next: "1",
      },
      {
        id: "1",
        speaker: "player",
        text: "听起来像炼金术。材料呢？",
        next: "2",
      },
      {
        id: "2",
        speaker: "goddess",
        expression: "calm",
        text: "两份一样的玄武质岩浆，各100千克。神明也要记账。你想先把它们放在哪里？",
        choices: [
          { label: "近地表，快一点冷下来", next: "fast" },
          { label: "地下，给晶体更多时间", next: "slow" },
        ],
      },
      {
        id: "fast",
        speaker: "goddess",
        expression: "warm",
        text: "先选“快速 · 近地表”，再“开始自动冷却”。这里只改变冷却路径，不会额外添加任何物质。",
        next: "last",
      },
      {
        id: "slow",
        speaker: "goddess",
        expression: "proud",
        text: "先选“缓慢 · 地下”，再“开始自动冷却”。漫长岁月是我的专长。实验播放会替你快进。",
        next: "last",
      },
      {
        id: "last",
        speaker: "player",
        text: "先把大陆规模的服务关掉。我们从A房开始，再给B房选择另一条路径。",
        next: "end",
      },
      {
        id: "end",
        speaker: "goddess",
        text: "两房冷却到650°C后，我们并列看结构和成分。过程中随时可以暂停、求助或跳过对话。",
        expression: "calm",
      },
    ],
  },
  B: lines(
    "intro:B",
    "第二幕 · 晶体在排队？",
    [
      ["goddess", "这次先别急着冷到底。猜猜下一种晶体什么时候出现？", "calm"],
      ["player", "不是全部一起冻住吗？难道还要取号？"],
      [
        "goddess",
        "“取号”只是比喻。这里的资格由当前成分和温度共同决定，不是我发号码。",
        "proud",
      ],
      ["player", "那就每次降25°C。谁先出现，拿数据说话。"],
      [
        "goddess",
        "点击“暂停并观察矿物”，我会展开真实结晶曲线。这个模型的顺序不能外推到所有岩浆。",
        "calm",
      ],
    ],
    60,
  ),
  C: lines(
    "intro:C",
    "第三幕 · 打扫一间岩浆房",
    [
      ["player", "里面有晶体了，能捞走吗？我想打扫一下。"],
      [
        "goddess",
        "可以。先让两房结晶，再在其中一房选择矿物与分离比例。",
        "calm",
      ],
      ["player", "另一房不打扫，当对照。这个实验设计我会。"],
      [
        "goddess",
        "很好。分离只移动已有固体，液相不会当场变成另一种岩浆。继续冷却，再在同温度比较。",
        "warm",
      ],
    ],
    60,
  ),
  D: lines(
    "intro:D",
    "第四幕 · 两份宝藏，一本账",
    [
      [
        "goddess",
        "这次既要早期矿物丰富的堆晶，又要保留足够的演化熔体。",
        "proud",
      ],
      ["player", "不是捞得越多越好，也不是冷得越彻底越好。"],
      ["goddess", "哦？看来你开始替岩浆考虑后路了。", "surprised"],
      ["player", "我在考虑质量账本。神明也要记账，这是你说的。"],
      [
        "goddess",
        "记性不错。目标卡给出每个门槛，“检查研究目标”会根据实际数据分析缺口。",
        "warm",
      ],
    ],
    60,
  ),
};
export const completions: Record<string, Scene> = {
  A: lines(
    "complete:A",
    "第一幕终 · 星球也从过程开始",
    [
      ["player", "成分一样，结构却不同。我们真的做出了两种石头。"],
      [
        "goddess",
        "准确地说，是让两条冷却路径产生了不同的结构。模型中的快慢冷是教学近似，不是完整晶体生长计算。",
        "calm",
      ],
      ["player", "所以忙了半天，就是两块石头？"],
      [
        "goddess",
        "你脚下的星球有过无数次这样的凝固过程。只是没有这张整齐的实验台。",
        "proud",
      ],
      ["player", "不要拿整颗星球给实验室绩效加分。"],
    ],
    100,
    "compare",
  ),
  B: lines(
    "complete:B",
    "第二幕终 · 不是固定队列",
    [
      ["player", "我记下出现温度了。看来“排队顺序”还会随着岩浆成分变。"],
      [
        "goddess",
        "对。这是当前教学体系的观察记录，不是宇宙通用的值班表。",
        "calm",
      ],
      ["player", "那我暂时不投诉它插队了。"],
    ],
    100,
    "minerals",
  ),
  C: lines(
    "complete:C",
    "第三幕终 · 打扫改变了后续历史",
    [
      [
        "player",
        "同温度的液相已经不同了，分离瞬间却没有变化。关键在后续路径。",
      ],
      [
        "goddess",
        "保留晶体在本模型里继续有限交换，分离晶体不再参与。这个交换规则是教学代理，不是完整平衡计算。",
        "calm",
      ],
      ["player", "打扫卫生还能留下可检验的对照组。"],
      [
        "goddess",
        "现在你开始像研究搭档了。不要急着拿扫帚申请研究经费。",
        "wry",
      ],
    ],
    100,
    "compare",
  ),
  D: lines(
    "complete:D",
    "第四幕终 · 搭档的第一份成果",
    [
      [
        "player",
        "堆晶和熔体都达标了。分离带走固体里的组分，剩下的熔体沿自己的路径演化；全系统仍然守恒。",
      ],
      ["goddess", "……解释得不错。看来你终于学会独立思考了。", "warm"],
      ["player", "我之前也有，只是当时不知道该追踪哪本账。"],
      ["goddess", "那下一次，我们就从假说开始，而不是从我的答案开始。", "calm"],
    ],
    100,
    "balance",
  ),
};

// Observation requests are explicit; dialogue never executes a chemical operation automatically.
introductions.B.nodes[introductions.B.nodes.length - 1].request = {
  type: "inspectMinerals",
};

export const narrativeCatalog = { "zh-CN": { introductions, completions } };
