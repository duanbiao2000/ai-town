// 引入cronJobs函数，用于创建定时任务
import { cronJobs } from 'convex/server';
// 引入IDLE_WORLD_TIMEOUT常量，该常量定义了世界处于非活动状态后的超时时间（以毫秒为单位）
import { IDLE_WORLD_TIMEOUT } from './constants';
// 引入内部API，包含停止非活动世界的方法
import { internal } from './_generated/api';

// 创建一个定时任务集合
const crons = cronJobs();

// 定义一个定时任务，用于停止非活动的世界实例
// 任务的执行间隔是IDLE_WORLD_TIMEOUT除以1000，单位是秒
// 当世界实例处于非活动状态并且超过设定的超时时间时，调用internal.world.stopInactiveWorlds方法将其停止
crons.interval(
  'stop inactive worlds',
  { seconds: IDLE_WORLD_TIMEOUT / 1000 },
  internal.world.stopInactiveWorlds,
);

// 导出默认的定时任务集合
export default crons;
