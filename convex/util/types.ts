import { Infer, v } from 'convex/values';

// 定义一个点的结构，包含x和y坐标
export const point = v.object({
  x: v.number(),
  y: v.number(),
});
export type Point = Infer<typeof point>;

// 定义一个向量的结构，包含dx和dy两个分量
export const vector = v.object({
  dx: v.number(),
  dy: v.number(),
});
export type Vector = Infer<typeof vector>;

// 定义一个路径的结构，由多个位置信息组成，每个位置信息包含一个点、一个向量和一个时间戳
export const path = v.array(v.object({ position: point, facing: vector, t: v.number() }));
export type Path = Infer<typeof path>;