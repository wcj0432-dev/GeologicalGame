export const oxides = [
  "SiO2",
  "TiO2",
  "Al2O3",
  "FeO",
  "MgO",
  "CaO",
  "Na2O",
  "K2O",
] as const;
export type Oxide = (typeof oxides)[number];
export type Chemistry = Record<Oxide, number>;
export const labels = [
  "SiO₂",
  "TiO₂",
  "Al₂O₃",
  "FeO*",
  "MgO",
  "CaO",
  "Na₂O",
  "K₂O",
];
export const modelVersion = "teaching-proxy-1.0";
export const sources = [
  {
    id: "basalt",
    name: "玄武质教学样品",
    composition: [49, 1, 16, 10, 8, 12, 3, 1],
  },
  {
    id: "evolved",
    name: "演化教学样品",
    composition: [57, 1, 17, 7, 4, 8, 4, 2],
  },
];
export const minerals = [
  {
    id: "olivine",
    name: "橄榄石",
    color: "#b6ca78",
    composition: [40, 0, 0, 16, 44, 0, 0, 0],
  },
  {
    id: "pyroxene",
    name: "单斜辉石",
    color: "#79bfb4",
    composition: [51, 0, 4, 8, 15, 22, 0, 0],
  },
  {
    id: "plagioclase",
    name: "斜长石",
    color: "#d9dce7",
    composition: [52, 0, 30, 0, 0, 14, 4, 0],
  },
] as const;
export type Mineral = (typeof minerals)[number]["id"];
export const chemistry = (values: readonly number[]): Chemistry =>
  Object.fromEntries(oxides.map((o, i) => [o, values[i]])) as Chemistry;
export const zero = () => chemistry(oxides.map(() => 0));
