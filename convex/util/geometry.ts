import { Path, Point, Vector } from './types';

/**
 * 计算两点之间的欧氏距离
 * @param p0 第一个点
 * @param p1 第二个点
 * @returns 两点之间的距离
 */
export function distance(p0: Point, p1: Point): number {
  const dx = p0.x - p1.x;
  const dy = p0.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 判断两点是否相等
 * @param p0 第一个点
 * @param p1 第二个点
 * @returns 如果两点的x和y坐标都相等，则返回true，否则返回false
 */
export function pointsEqual(p0: Point, p1: Point): boolean {
  return p0.x == p1.x && p0.y == p1.y;
}

/**
 * 计算两点之间的曼哈顿距离
 * @param p0 第一个点
 * @param p1 第二个点
 * @returns 两点之间的曼哈顿距离
 */
export function manhattanDistance(p0: Point, p1: Point) {
  return Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y);
}

/**
 * 检查路径是否在给定的时间内重叠
 * @param path 路径，由多个点组成，每个点包含时间和位置信息
 * @param time 给定的时间
 * @returns 如果路径在给定的时间内重叠，则返回true，否则返回false
 * @throws 如果路径长度小于2，则抛出错误
 */
export function pathOverlaps(path: Path, time: number): boolean {
  if (path.length < 2) {
    throw new Error(`Invalid path: ${JSON.stringify(path)}`);
  }
  return path.at(0)!.t <= time && time <= path.at(-1)!.t;
}

/**
 * 根据给定的时间，计算路径上的位置和朝向
 * @param path 路径，由多个点组成，每个点包含时间和位置信息
 * @param time 给定的时间
 * @returns 返回路径上对应时间的位置、朝向和速度
 * @throws 如果路径长度小于2，或者给定的时间不在路径范围内，则抛出错误
 */
export function pathPosition(
  path: Path,
  time: number,
): { position: Point; facing: Vector; velocity: number } {
  if (path.length < 2) {
    throw new Error(`Invalid path: ${JSON.stringify(path)}`);
  }
  const first = path[0];
  if (time < first.t) {
    return { position: first.position, facing: first.facing, velocity: 0 };
  }
  const last = path[path.length - 1];
  if (last.t < time) {
    return { position: last.position, facing: last.facing, velocity: 0 };
  }
  for (let i = 0; i < path.length - 1; i++) {
    const segmentStart = path[i];
    const segmentEnd = path[i + 1];
    if (segmentStart.t <= time && time <= segmentEnd.t) {
      const interp = (time - segmentStart.t) / (segmentEnd.t - segmentStart.t);
      return {
        position: {
          x: segmentStart.position.x + interp * (segmentEnd.position.x - segmentStart.position.x),
          y: segmentStart.position.y + interp * (segmentEnd.position.y - segmentStart.position.y),
        },
        facing: segmentStart.facing,
        velocity:
          distance(segmentStart.position, segmentEnd.position) / (segmentEnd.t - segmentStart.t),
      };
    }
  }
  throw new Error(`Timestamp checks not exhaustive?`);
}

// 定义一个接近于零的小数值，用于浮点数比较
export const EPSILON = 0.0001;

/**
 * 计算从一点到另一点的向量
 * @param p0 起始点
 * @param p1 终点
 * @returns 从起始点到终点的向量
 */
export function vector(p0: Point, p1: Point): Vector {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return { dx, dy };
}

/**
 * 标准化向量，使其长度为1
 * @param vector 要标准化的向量
 * @returns 返回标准化后的向量，如果向量长度接近0，则返回null
 */
export function normalize(vector: Vector): Vector | null {
  const { dx, dy } = vector;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < EPSILON) {
    return null;
  }
  return {
    dx: dx / len,
    dy: dy / len,
  };
}

/**
 * 计算向量的方向，以度为单位
 * @param vector 输入的向量
 * @returns 返回向量的方向，以度为单位
 * @throws 如果向量的长度接近0，则抛出错误
 */
export function orientationDegrees(vector: Vector): number {
  if (Math.sqrt(vector.dx * vector.dx + vector.dy * vector.dy) < EPSILON) {
    throw new Error(`Can't compute the orientation of too small vector ${JSON.stringify(vector)}`);
  }
  const twoPi = 2 * Math.PI;
  const radians = (Math.atan2(vector.dy, vector.dx) + twoPi) % twoPi;
  return (radians / twoPi) * 360;
}
