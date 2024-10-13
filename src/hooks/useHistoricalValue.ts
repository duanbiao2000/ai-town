import { WithoutSystemFields } from 'convex/server';
import { Doc, TableNames } from '../../convex/_generated/dataModel';
import { History, unpackSampleRecord } from '../../convex/engine/historicalTable';
import { useMemo, useRef } from 'react';

export function useHistoricalValue<Name extends TableNames>(
  historicalTime: number | undefined,
  value: Doc<Name> | undefined,
): WithoutSystemFields<Doc<Name>> | undefined {
  const manager = useRef(new HistoryManager());
// 定义一个名为sampleRecord的常量，它是一个History类型的Record对象，或者为undefined
// 它是通过useMemo钩子计算得出，以避免不必要的重复计算
const sampleRecord: Record<string, History> | undefined = useMemo(() => {
  // 检查value是否存在以及value.history属性是否存在
  // 如果不存在，则返回undefined，避免不必要的计算
  if (!value || !value.history) {
    return undefined;
  }
  // 检查value.history是否为ArrayBuffer实例
  // 如果不是，则抛出错误，因为函数期望的类型是ArrayBuffer
  if (!(value.history instanceof ArrayBuffer)) {
    throw new Error(`Expected ArrayBuffer, found ${typeof value.history}`);
  }
  // 调用unpackSampleRecord函数，将value.history作为参数传入
  // 这里将ArrayBuffer断言为ArrayBuffer类型，确保类型安全
  return unpackSampleRecord(value.history as ArrayBuffer);
}, [value && value.history]);
  if (sampleRecord) {
    manager.current.receive(sampleRecord);
  }
  if (value === undefined) {
    return undefined;
  }
  const { _id, _creationTime, history, ...latest } = value;
  if (!historicalTime) {
    return latest as any;
  }
  const historicalFields = manager.current.query(historicalTime);
  for (const [fieldName, value] of Object.entries(historicalFields)) {
    (latest as any)[fieldName] = value;
  }
  return latest as any;
}

/**
 * HistoryManager 类用于管理不同字段的历史记录数据
 */
class HistoryManager {
  // 存储每个字段的历史记录，键为字段名，值为该字段的历史数据数组
  histories: Record<string, History[]> = {};

  /**
   * 接收一组历史数据记录，并将其添加到对应字段的历史记录中
   * @param sampleRecord 包含多个字段历史数据的记录
   */
  receive(sampleRecord: Record<string, History>) {
    for (const [fieldName, history] of Object.entries(sampleRecord)) {
      let histories = this.histories[fieldName];
      if (!histories) {
        histories = [];
        this.histories[fieldName] = histories;
      }
      // 避免重复的历史数据被添加
      if (histories[histories.length - 1] == history) {
        continue;
      }
      histories.push(history);
    }
  }

  /**
   * 查询在指定时间点各个字段的历史数据，并重置这些字段的历史记录
   * @param historicalTime 指定的时间点，用于查询历史数据
   * @returns 返回一个记录，包含每个字段在指定时间点的值
   */
  query(historicalTime: number): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [fieldName, histories] of Object.entries(this.histories)) {
      if (histories.length == 0) {
        continue;
      }
      let foundIndex = null;
      let currentValue = histories[0].initialValue;
      // 遍历每个历史记录，查找在指定时间点的值
      for (let i = 0; i < histories.length; i++) {
        const history = histories[i];
        for (const sample of history.samples) {
          if (sample.time > historicalTime) {
            foundIndex = i;
            break;
          }
          currentValue = sample.value;
        }
        if (foundIndex !== null) {
          break;
        }
      }
      // 如果找到了对应的记录，更新历史记录数组
      if (foundIndex !== null) {
        this.histories[fieldName] = histories.slice(foundIndex);
      }
      result[fieldName] = currentValue;
    }
    return result;
  }
}