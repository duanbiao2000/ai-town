// 导入value相关的辅助函数
import { v } from 'convex/values';
// 导入API相关的类型和函数
import { api, internal } from './_generated/api';
// 导入服务器端相关的类型和函数
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  internalMutation,
  mutation,
} from './_generated/server';
// 导入角色描述数据
import { Descriptions } from '../data/characters';
// 导入游戏地图数据
import * as firstmap from '../data/firstmap';
// 导入游戏主逻辑的输入处理函数
import { insertInput } from './game/main';
// 导入角色代理相关的函数
import { initAgent, kickAgents, stopAgents } from './agent/init';
// 导入文档和ID相关的类型
import { Doc, Id } from './_generated/dataModel';
// 导入游戏引擎相关的函数
import { createEngine, kickEngine, startEngine, stopEngine } from './engine/game';

// 初始化函数，用于处理一些初始配置和操作
const init = mutation({
  handler: async (ctx) => {
    // 检查环境变量中是否缺少OPENAI_API_KEY
    if (!process.env.OPENAI_API_KEY) {
      const deploymentName = process.env.CONVX_CLOUD_URL?.slice(8).replace('.convex.cloud', '');
      throw new Error(
        '\n  Missing OPENAI_API_KEY in environment variables.\n\n' +
          '  Get one at https://openai.com/\n\n' +
          '  Paste it on the Convex dashboard:\n' +
          '  https://dashboard.convex.dev/d/' +
          deploymentName +
          '/settings?var=OPENAI_API_KEY',
      );
    }
    // 获取或创建默认的世界和引擎
    const { world, engine } = await getOrCreateDefaultWorld(ctx);
    // 检查世界的状态，如果不是运行中，则给出警告并返回
    if (world.status !== 'running') {
      console.warn(
        `Engine ${engine._id} is not active! Run "npx convex run init:resume" to restart it.`,
      );
      return;
    }
    // 对所有代理创建玩家
    if (await shouldCreateAgents(ctx.db, world)) {
      for (const agent of Descriptions) {
        // 插入玩家加入的输入数据
        const inputId = await insertInput(ctx, world._id, 'join', {
          name: agent.name,
          description: agent.identity,
          character: agent.character,
        });
        // 调度器在1秒后运行代理创建的完成函数
        await ctx.scheduler.runAfter(1000, internal.init.completeAgentCreation, {
          worldId: world._id,
          joinInputId: inputId,
          character: agent.character,
        });
      }
    }
  },
});
export default init;

/**
 * 执行“kick”操作的内部mutation函数
 * 
 * 该函数没有输入参数和返回值的具体要求，主要作用是调用默认世界和引擎，
 * 并依次触发引擎和代理的操作
 */
export const kick = internalMutation({
  handler: async (ctx) => {
    // 从数据库上下文中获取默认世界和引擎对象
    const { world, engine } = await getDefaultWorld(ctx.db);
    
    // 调用内部函数kickEngine，执行引擎的step操作
    await kickEngine(ctx, internal.game.main.runStep, engine._id);
    
    // 调用内部函数kickAgents，基于世界ID触发代理的操作
    await kickAgents(ctx, { worldId: world._id });
  },
});

/**
 * 停止世界的运行
 * 
 * 此函数负责停止一个世界及其相关的引擎和代理它首先检查世界的当前状态，
 * 如果世界已经处于非活动或由开发者停止的状态，则不需要进一步操作
 * 如果世界的状态允许，则更新世界的状态为'stoppedByDeveloper'，并实际停止引擎和代理
 * 
 * @param ctx 上下文对象，包含操作所需的信息和数据库连接
 */
export const stop = internalMutation({
  handler: async (ctx) => {
    // 获取默认世界和引擎
    const { world, engine } = await getDefaultWorld(ctx.db);

    // 检查世界是否已经停止或由开发者停止
    if (world.status === 'inactive' || world.status === 'stoppedByDeveloper') {
      // 如果引擎未停止，抛出错误
      if (engine.state.kind !== 'stopped') {
        throw new Error(`Engine ${engine._id} isn't stopped?`);
      }
      // 日志输出世界已停止
      console.debug(`World ${world._id} is already inactive`);
      return;
    }

    // 日志输出停止引擎开始
    console.log(`Stopping engine ${engine._id}...`);
    // 更新世界状态为由开发者停止
    await ctx.db.patch(world._id, { status: 'stoppedByDeveloper' });
    // 停止引擎
    await stopEngine(ctx, engine._id);
    // 停止世界中的所有代理
    await stopAgents(ctx, { worldId: world._id });
  },
});

export const resume = internalMutation({
  handler: async (ctx) => {
    const { world, engine } = await getDefaultWorld(ctx.db);
    if (world.status === 'running') {
      if (engine.state.kind !== 'running') {
        throw new Error(`Engine ${engine._id} isn't running?`);
      }
      console.debug(`World ${world._id} is already running`);
      return;
    }
    console.log(`Resuming engine ${engine._id} for world ${world._id} (state: ${world.status})...`);
    await ctx.db.patch(world._id, { status: 'running' });
    await startEngine(ctx, internal.game.main.runStep, engine._id);
    await kickAgents(ctx, { worldId: world._id });
  },
});

export const archive = internalMutation({
  handler: async (ctx) => {
    const { world, engine } = await getDefaultWorld(ctx.db);
    if (engine.state.kind === 'running') {
      throw new Error(`Engine ${engine._id} is still running!`);
    }
    console.log(`Archiving world ${world._id}...`);
    await ctx.db.patch(world._id, { isDefault: false });
  },
});

async function getDefaultWorld(db: DatabaseReader) {
  const world = await db
    .query('worlds')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .first();
  if (!world) {
    throw new Error('No default world found');
  }
  const engine = await db.get(world.engineId);
  if (!engine) {
    throw new Error(`Engine ${world.engineId} not found`);
  }
  return { world, engine };
}

async function getOrCreateDefaultWorld(ctx: MutationCtx) {
  const now = Date.now();
  let world = await ctx.db
    .query('worlds')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .first();
  if (!world) {
    const engineId = await createEngine(ctx, internal.game.main.runStep);
    const mapId = await ctx.db.insert('maps', {
      width: firstmap.mapWidth,
      height: firstmap.mapHeight,
      tileSetUrl: firstmap.tilesetPath,
      tileSetDim: firstmap.tileFileDim,
      tileDim: firstmap.tileDim,
      bgTiles: firstmap.bgTiles,
      objectTiles: firstmap.objmap,
    });
    const worldId = await ctx.db.insert('worlds', {
      engineId,
      isDefault: true,
      lastViewed: now,
      mapId,
      status: 'running',
    });
    world = (await ctx.db.get(worldId))!;
  }
  const engine = await ctx.db.get(world.engineId);
  if (!engine) {
    throw new Error(`Engine ${world.engineId} not found`);
  }
  return { world, engine };
}

async function shouldCreateAgents(db: DatabaseReader, world: Doc<'worlds'>) {
  const players = await db
    .query('players')
    .withIndex('active', (q) => q.eq('worldId', world._id))
    .collect();
  for (const player of players) {
    const agent = await db
      .query('agents')
      .withIndex('playerId', (q) => q.eq('playerId', player._id))
      .first();
    if (agent) {
      return false;
    }
  }
  const unactionedJoinInputs = await db
    .query('inputs')
    .withIndex('byInputNumber', (q) => q.eq('engineId', world.engineId))
    .order('asc')
    .filter((q) => q.eq(q.field('name'), 'join'))
    .filter((q) => q.eq(q.field('returnValue'), undefined))
    .collect();
  if (unactionedJoinInputs.length > 0) {
    return false;
  }
  return true;
}

export const completeAgentCreation = internalMutation({
  args: {
    worldId: v.id('worlds'),
    joinInputId: v.id('inputs'),
    character: v.string(),
  },
  handler: async (ctx, args) => {
    const input = await ctx.db.get(args.joinInputId);
    if (!input || input.name !== 'join') {
      throw new Error(`Invalid input ID ${args.joinInputId}`);
    }
    const { returnValue } = input;
    if (!returnValue) {
      console.warn(`Input ${input._id} not ready, waiting...`);
      ctx.scheduler.runAfter(5000, internal.init.completeAgentCreation, args);
      return;
    }
    if (returnValue.kind === 'error') {
      throw new Error(`Error creating agent: ${returnValue.message}`);
    }
    const playerId = returnValue.value;
    const existingAgent = await ctx.db
      .query('agents')
      .withIndex('playerId', (q) => q.eq('playerId', playerId))
      .first();
    if (existingAgent) {
      throw new Error(`Agent for player ${playerId} already exists`);
    }
    await initAgent(ctx, { worldId: args.worldId, playerId, character: args.character });
  },
});
