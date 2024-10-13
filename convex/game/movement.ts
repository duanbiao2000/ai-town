import { Doc, Id } from '../_generated/dataModel';
import { movementSpeed } from '../../data/characters';
import { COLLISION_THRESHOLD } from '../constants';
import { Point, Vector } from '../util/types';
import { distance, manhattanDistance, pointsEqual } from '../util/geometry';
import { MinHeap } from '../util/minheap';
import { AiTown } from './aiTown';

/**
 * 路径候选对象，表示一个可能的路径段，包括位置、方向、时间、长度、成本和前一个段。
 */
type PathCandidate = {
  position: Point;
  facing?: Vector;
  t: number;
  length: number;
  cost: number;
  prev?: PathCandidate;
};

/**
 * 寻找玩家到达目的地的路径。
 * @param game 当前游戏状态
 * @param now 当前时间（毫秒）
 * @param player 玩家文档
 * @param destination 目的地坐标
 * @returns 路径和可能的新目的地（如果原目的地无法到达）
 */
export function findRoute(game: AiTown, now: number, player: Doc<'players'>, destination: Point) {
  const minDistances: PathCandidate[][] = [];

  /**
   * 探索当前路径候选周围的环境，并返回下一个可能的路径段。
   * @param current 当前路径候选
   * @returns 下一个路径候选列表
   */
  const explore = (current: PathCandidate): Array<PathCandidate> => {
    const { x, y } = current.position;
    const neighbors = [];

    // 如果不在网格点上，尝试水平或垂直移动到网格点。
    if (x !== Math.floor(x)) {
      neighbors.push(
        { position: { x: Math.floor(x), y }, facing: { dx: -1, dy: 0 } },
        { position: { x: Math.floor(x) + 1, y }, facing: { dx: 1, dy: 0 } },
      );
    }
    if (y !== Math.floor(y)) {
      neighbors.push(
        { position: { x, y: Math.floor(y) }, facing: { dx: 0, dy: -1 } },
        { position: { x, y: Math.floor(y) + 1 }, facing: { dx: 0, dy: 1 } },
      );
    }
    // 否则，移动到相邻的网格点。
    if (x == Math.floor(x) && y == Math.floor(y)) {
      neighbors.push(
        { position: { x: x + 1, y }, facing: { dx: 1, dy: 0 } },
        { position: { x: x - 1, y }, facing: { dx: -1, dy: 0 } },
        { position: { x, y: y + 1 }, facing: { dx: 0, dy: 1 } },
        { position: { x, y: y - 1 }, facing: { dx: 0, dy: -1 } },
      );
    }

    const next = [];
    for (const { position, facing } of neighbors) {
      const segmentLength = distance(current.position, position);
      const length = current.length + segmentLength;
      if (blocked(game, now, position, player._id)) {
        continue;
      }
      const remaining = manhattanDistance(position, destination);
      const path = {
        position,
        facing,
        t: current.t + (segmentLength / movementSpeed) * 1000,
        length,
        cost: length + remaining,
        prev: current,
      };
      const existingMin = minDistances[position.y]?.[position.x];
      if (existingMin && existingMin.cost <= path.cost) {
        continue;
      }
      minDistances[position.y] ??= [];
      minDistances[position.y][position.x] = path;
      next.push(path);
    }
    return next;
  };

  // 获取起始位置
  const startingLocation = game.locations.lookup(now, player.locationId);
  const startingPosition = { x: startingLocation.x, y: startingLocation.y };

  // 初始化当前路径候选
  let current: PathCandidate | undefined = {
    position: startingPosition,
    facing: { dx: startingLocation.dx, dy: startingLocation.dy },
    t: now,
    length: 0,
    cost: manhattanDistance(startingPosition, destination),
    prev: undefined,
  };

  // 初始化最佳候选路径
  let bestCandidate = current;

  // 使用最小堆来存储路径候选
  const minheap = MinHeap<PathCandidate>((p0, p1) => p0.cost > p1.cost);

  // 开始寻找路径
  while (current) {
    if (pointsEqual(current.position, destination)) {
      break;
    }
    if (
      manhattanDistance(current.position, destination) <
      manhattanDistance(bestCandidate.position, destination)
    ) {
      bestCandidate = current;
    }
    for (const candidate of explore(current)) {
      minheap.push(candidate);
    }
    current = minheap.pop();
  }

  // 处理未找到路径的情况
  let newDestination = null;
  if (!current) {
    if (bestCandidate.length === 0) {
      return null;
    }
    current = bestCandidate;
    newDestination = current.position;
  }

  // 构建最终路径
  const densePath = [];
  let facing = current.facing!;
  while (current) {
    densePath.push({ position: current.position, t: current.t, facing });
    facing = current.facing!;
    current = current.prev;
  }
  densePath.reverse();

  return { path: densePath, newDestination };
}

/**
 * 判断当前位置是否被阻挡。
 * @param game 当前游戏状态
 * @param now 当前时间（毫秒）
 * @param pos 当前位置
 * @param playerId 玩家ID（可选）
 * @returns 是否被阻挡的原因
 */
export function blocked(game: AiTown, now: number, pos: Point, playerId?: Id<'players'>) {
  const otherPositions = game.players
    .allDocuments()
    .filter((p) => p._id !== playerId)
    .map((p) => game.locations.lookup(now, p.locationId));
  return blockedWithPositions(pos, otherPositions, game.map);
}

/**
 * 根据其他位置判断当前位置是否被阻挡。
 * @param position 当前位置
 * @param otherPositions 其他位置列表
 * @param map 地图文档
 * @returns 是否被阻挡的原因
 */
export function blockedWithPositions(position: Point, otherPositions: Point[], map: Doc<'maps'>) {
  if (isNaN(position.x) || isNaN(position.y)) {
    throw new Error(`NaN position in ${JSON.stringify(position)}`);
  }
  if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
    return 'out of bounds';
  }
  if (map.objectTiles[Math.floor(position.y)][Math.floor(position.x)] !== -1) {
    return 'world blocked';
  }
  for (const otherPosition of otherPositions) {
    if (distance(otherPosition, position) < COLLISION_THRESHOLD) {
      return 'player';
    }
  }
  return null;
}