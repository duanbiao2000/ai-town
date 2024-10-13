import { v } from 'convex/values';
import {
  DatabaseReader,
  MutationCtx,
  internalMutation,
  mutation,
  query,
} from '../_generated/server';
import { AiTown } from './aiTown';
import { api, internal } from '../_generated/api';
import { insertInput as gameInsertInput } from '../engine/game';
import { InputArgs, InputNames } from './inputs';
import { Id } from '../_generated/dataModel';

/**
 * 根据引擎ID获取世界ID
 * @param db 数据库读取对象
 * @param engineId 引擎ID
 * @returns 世界ID
 * @throws 如果找不到对应的世界，则抛出错误
 */
async function getWorldId(db: DatabaseReader, engineId: Id<'engines'>) {
  const world = await db
    .query('worlds')
    .withIndex('engineId', (q) => q.eq('engineId', engineId))
    .first();
  if (!world) {
    throw new Error(`World for engine ${engineId} not found`);
  }
  return world._id;
}

/**
 * 运行游戏引擎的一步模拟
 * @param engineId 引擎ID
 * @param generationNumber 代数编号
 * @returns 无返回值
 * @throws 如果找不到对应的世界，则抛出错误
 */
export const runStep = internalMutation({
  args: {
    engineId: v.id('engines'),
    generationNumber: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const worldId = await getWorldId(ctx.db, args.engineId);
    const game = await AiTown.load(ctx.db, worldId);
    await game.runStep(ctx, internal.game.main.runStep, args.generationNumber);
  },
});

/**
 * 在世界中插入一个输入
 * @param worldId 世界ID
 * @param name 输入名称
 * @param args 输入参数
 * @returns 输入的ID
 * @throws 如果世界ID无效，则抛出错误
 */
export async function insertInput<Name extends InputNames>(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  name: Name,
  args: InputArgs<Name>,
): Promise<Id<'inputs'>> {
  const world = await ctx.db.get(worldId);
  if (!world) {
    throw new Error(`Invalid world ID: ${worldId}`);
  }
  return await gameInsertInput(ctx, internal.game.main.runStep, world.engineId, name, args);
}

/**
 * 发送输入到世界
 * @param worldId 世界ID
 * @param name 输入名称
 * @param args 输入参数
 * @returns 输入的ID
 */
export const sendInput = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    args: v.any(),
  },
  handler: async (ctx, args) => {
    return await insertInput(ctx, args.worldId, args.name as InputNames, args.args);
  },
});

/**
 * 获取输入的状态
 * @param inputId 输入ID
 * @returns 输入的返回值，如果不存在则返回null
 * @throws 如果输入ID无效，则抛出错误
 */
export const inputStatus = query({
  args: {
    inputId: v.id('inputs'),
  },
  handler: async (ctx, args) => {
    const input = await ctx.db.get(args.inputId);
    if (!input) {
      throw new Error(`Invalid input ID: ${args.inputId}`);
    }
    return input.returnValue ?? null;
  },
});