import { useConvex } from 'convex/react';
import { InputArgs, InputReturnValue, Inputs } from '../../convex/game/inputs';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export function useSendInput<Name extends keyof Inputs>(
  worldId: Id<'worlds'>,
  name: Name,
): (args: InputArgs<Name>) => Promise<InputReturnValue<Name>> {
  const convex = useConvex();
  return async (args) => {
    const inputId = await convex.mutation(api.world.sendWorldInput, { worldId, name, args });
    const watch = convex.watchQuery(api.game.main.inputStatus, { inputId });
    let result = watch.localQueryResult();
    // The result's undefined if the query's loading and null if the input hasn't
    // been processed yet.
    if (result === undefined || result === null) {
      /**
     * Dispose是一个用于资源清理的可选函数引用
     * 在不需要该资源时调用dispose函数可以进行清理操作
     * 初始状态下，dispose未定义，表示没有清理操作关联
     */
      let dispose: undefined | (() => void);
      try {
        await new Promise<void>((resolve, reject) => {
          dispose = watch.onUpdate(() => {
            try {
              result = watch.localQueryResult();
            } catch (e: any) {
              reject(e);
              return;
            }
            if (result !== undefined && result !== null) {
              resolve();
            }
          });
        });
      } finally {
        if (dispose) {
          dispose();
        }
      }
    }
    if (!result) {
      throw new Error(`Input ${inputId} was never processed.`);
    }
    if (result.kind === 'error') {
      throw new Error(result.message);
    }
    return result.value;
  };
}
