import { v } from 'convex/values';
import { GameTable } from '../engine/gameTable';
import { defineTable } from 'convex/server';
import { DatabaseWriter } from '../_generated/server';
import { Players } from './players';
import { Doc, Id } from '../_generated/dataModel';
import { HistoricalTable } from '../engine/historicalTable';

// 定义locations表结构，包括位置、方向、速度和历史记录字段。
export const locations = defineTable({
  // Position.
  x: v.number(),
  y: v.number(),

  // Normalized orientation vector.
  dx: v.number(),
  dy: v.number(),

  // Velocity (in tiles/sec).
  velocity: v.number(),

  // History buffer field out by `HistoricalTable`.
  history: v.optional(v.bytes()),
});

// 定义locationFields数组，用于存储locations表中的关键字段名。
export const locationFields = ['x', 'y', 'dx', 'dy', 'velocity'];

// Locations类继承自HistoricalTable，用于管理location相关的逻辑。
export class Locations extends HistoricalTable<'locations'> {
 // 将字符串 "locations" 作为常量来声明变量 table，以确保其值在程序中不会被意外修改
  table = 'locations' as const;

  // 静态方法load用于从数据库中加载Locations实例。
  static async load(
    db: DatabaseWriter,
    engineId: Id<'engines'>,
    players: Players,
  ): Promise<Locations> {
    const rows = [];
    for (const playerId of players.allIds()) {
      const player = players.lookup(playerId);
      const row = await db.get(player.locationId);
      if (!row) {
        throw new Error(`Invalid location ID: ${player.locationId}`);
      }
      rows.push(row);
    }
    return new Locations(db, engineId, rows);
  }

  // 构造函数初始化Locations实例。
  constructor(
    public db: DatabaseWriter,
    public engineId: Id<'engines'>,
    rows: Doc<'locations'>[],
  ) {
    super(locationFields, rows);
  }
}