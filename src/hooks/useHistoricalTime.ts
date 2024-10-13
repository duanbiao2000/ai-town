import { Doc, Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEffect, useRef, useState } from 'react';

/**
 * 使用凸包引擎状态更新来管理历史时间.
 * 
 * 该钩子函数通过监听世界引擎的状态更新,维护一个历史时间管理器.
 * 它主要用于在客户端模拟服务器时间,并根据服务器状态更新缓冲区健康状态.
 * 
 * @param worldId 可选的世界ID,用于查询世界引擎状态.
 * @returns 返回一个对象,包含当前的历史时间以及时间管理器实例.
 */
export function useHistoricalTime(worldId?: Id<'worlds'>) {
  // 查询世界引擎状态,如果ID存在,则使用对应的worldId参数.
  const engineStatus = useQuery(api.world.engineStatus, worldId ? { worldId } : 'skip');
  // 使用ref来维护一个历史时间管理器实例,避免组件重新渲染时丢失状态.
  const timeManager = useRef(new HistoricalTimeManager());
  // 用于存储requestAnimationFrame的ID.
  const rafRef = useRef<number>();
  // 状态管理当前的历史时间.
  const [historicalTime, setHistoricalTime] = useState<number | undefined>(undefined);
  // 状态管理缓冲区的健康状态.
  const [bufferHealth, setBufferHealth] = useState(0);
  
  // 当接收到新的引擎状态时,更新时间管理器.
  if (engineStatus) {
    timeManager.current.receive(engineStatus);
  }

  /**
   * 更新历史时间.
   * 
   * 该函数通过requestAnimationFrame调用,根据当前客户端时间更新历史服务器时间.
   * 
   * @param performanceNow 当前客户端时间,用于计算时间差.
   */
  const updateTime = (performanceNow: number) => {
    // 我们不需要亚毫秒级的精度来进行插值,所以直接使用Date.now().
    const now = Date.now();
    setHistoricalTime(timeManager.current.historicalServerTime(now));
    setBufferHealth(timeManager.current.bufferHealth());
    rafRef.current = requestAnimationFrame(updateTime);
  };

  // 使用effect来启动和停止时间更新动画帧.
  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  // 返回当前的历史时间和时间管理器实例.
  return { historicalTime, timeManager: timeManager.current };
}

/**
 * 用于管理历史时间的类.
 * 
 * 该类维护了一个服务器时间间隔数组,用于计算和模拟历史服务器时间.
 */
export class HistoricalTimeManager {
  // 存储服务器时间间隔的数组.
  intervals: Array<ServerTimeInterval> = [];
  // 上一次客户端时间戳.
  prevClientTs?: number;
  // 上一次服务器时间戳.
  prevServerTs?: number;
  // 总的时间持续.
  totalDuration: number = 0;

  // 最新的引擎状态.
  latestEngineStatus?: Doc<'engines'>;

  /**
   * 接收新的引擎状态并更新内部状态.
   * 
   * @param engineStatus 引擎状态对象,包含服务器时间信息.
   */
  receive(engineStatus: Doc<'engines'>) {
    this.latestEngineStatus = engineStatus;
    // 如果当前时间或上次步骤时间戳不存在,则不进行任何操作.
    if (!engineStatus.currentTime || !engineStatus.lastStepTs) {
      return;
    }
    // 检查并更新时间间隔数组.
    const latest = this.intervals[this.intervals.length - 1];
    if (latest) {
      if (latest.endTs === engineStatus.currentTime) {
        return;
      }
      if (latest.endTs > engineStatus.currentTime) {
        throw new Error(`Received out-of-order engine status`);
      }
    }
    const newInterval = {
      startTs: engineStatus.lastStepTs,
      endTs: engineStatus.currentTime,
    };
    this.intervals.push(newInterval);
    this.totalDuration += newInterval.endTs - newInterval.startTs;
  }

  /**
   * 根据当前客户端时间计算历史服务器时间.
   * 
   * @param clientNow 当前客户端时间.
   * @returns 返回计算的历史服务器时间.
   */
  historicalServerTime(clientNow: number): number | undefined {
    if (this.intervals.length == 0) {
      return undefined;
    }
    // 如果上次客户端时间与当前相同,则直接返回上次服务器时间.
    if (clientNow === this.prevClientTs) {
      return this.prevServerTs;
    }
    // 初始化上次客户端和服务器时间戳.
    const prevClientTs = this.prevClientTs ?? clientNow;
    const prevServerTs = this.prevServerTs ?? this.intervals[0].startTs;
    const lastServerTs = this.intervals[this.intervals.length - 1].endTs;

    // 根据缓冲区时间调整模拟速度.
    const bufferDuration = lastServerTs - prevServerTs;
    let rate = 1;
    if (bufferDuration < SOFT_MIN_SERVER_BUFFER_AGE) {
      rate = 0.8;
    } else if (bufferDuration > SOFT_MAX_SERVER_BUFFER_AGE) {
      rate = 1.2;
    }
    let serverTs = Math.max(
      prevServerTs + (clientNow - prevClientTs) * rate,
      lastServerTs - MAX_SERVER_BUFFER_AGE,
    );

    let chosen = null;
    for (let i = 0; i < this.intervals.length; i++) {
      const snapshot = this.intervals[i];
      if (snapshot.endTs < serverTs) {
        continue;
      }
      if (serverTs >= snapshot.startTs) {
        chosen = i;
        break;
      }
      if (serverTs < snapshot.startTs) {
        serverTs = snapshot.startTs;
        chosen = i;
      }
    }
    if (chosen === null) {
      serverTs = this.intervals.at(-1)!.endTs;
      chosen = this.intervals.length - 1;
    }

    // 清理过时的时间间隔.
    const toTrim = Math.max(chosen - 1, 0);
    if (toTrim > 0) {
      for (const snapshot of this.intervals.slice(0, toTrim)) {
        this.totalDuration -= snapshot.endTs - snapshot.startTs;
      }
      this.intervals = this.intervals.slice(toTrim);
    }

    this.prevClientTs = clientNow;
    this.prevServerTs = serverTs;

    return serverTs;
  }

  /**
   * 计算缓冲区健康状态.
   * 
   * @returns 返回当前缓冲区的健康状态.
   */
/**
 * 计算缓冲区健康度
 * 
 * 该方法用于评估当前缓冲区的数据完整性通过计算最近一个服务器时间戳与缓冲区中最后一个数据时间戳之间的差值来判断
 * 缓冲区是否处于一个健康的状态当缓冲区中没有数据时，直接返回0表示不健康
 * 
 * @returns {number} 返回缓冲区健康度的数值，越大表示缓冲区越健康
 */
bufferHealth(): number {
  // 当缓冲区中没有数据时，直接返回0表示不健康
  if (!this.intervals.length) {
    return 0;
  }
  
  // 初始化最后一个服务器时间戳，如果上一个服务器时间戳不存在，则使用缓冲区第一个数据的开始时间戳
  const lastServerTs = this.prevServerTs ?? this.intervals[0].startTs;
  
  // 计算并返回缓冲区的健康度，即最后一个数据的结束时间戳减去最后一个服务器时间戳
  // 这个值越大，表示缓冲区中的数据越新，健康度越高
  return this.intervals[this.intervals.length - 1].endTs - lastServerTs;
}
  /**
   * 计算时钟偏差.
   * 
   * @returns 返回当前客户端与服务器时间的偏差.
   */
  clockSkew(): number {
    if (!this.prevClientTs || !this.prevServerTs) {
      return 0;
    }
    return this.prevClientTs - this.prevServerTs;
  }
}

// 定义服务器缓冲区时间常量.
const MAX_SERVER_BUFFER_AGE = 1250;
const SOFT_MAX_SERVER_BUFFER_AGE = 1000;
const SOFT_MIN_SERVER_BUFFER_AGE = 100;
