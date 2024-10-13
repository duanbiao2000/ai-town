// Basic 1-indexed minheap implementation
export function MinHeap<T>(compare: (a: T, b: T) => boolean) {
  const tree = [null as T];
  let endIndex = 1;
  return {
    /**
 * 获取队列的下一个元素，但不移除它
 * 
 * 此函数模拟队列的 peek 操作，用于在不改变队列状态的情况下，
 * 查看队列的下一个（或当前）元素是什么在某些场景下，比如迭代或遍历队列时，
 * 这种能力非常有用，因为它允许我们提前做出决策基于队列的下一个元素，
 * 而不必立即改变队列的状态这种操作在实现复杂迭代器或需要提前知道队列元素的场景中很常见
 * 
 * @returns {T | undefined} 如果队列中有下一个元素，则返回该元素；否则返回 undefined
 */
peek: (): T | undefined => tree[1],
    length: () => endIndex - 1,
    push: (newValue: T) => {
      let destinationIndex = endIndex++;
      let nextToCheck;
      while ((nextToCheck = destinationIndex >> 1) > 0) {
        const existing = tree[nextToCheck];
        if (compare(newValue, existing)) break;
        tree[destinationIndex] = existing;
        destinationIndex = nextToCheck;
      }
      tree[destinationIndex] = newValue;
    },
    pop: () => {
      if (endIndex == 1) return undefined;
      endIndex--;
      const value = tree[1];
      const lastValue = tree[endIndex];
      let destinationIndex = 1;
      let nextToCheck;
      while ((nextToCheck = destinationIndex << 1) < endIndex) {
        if (nextToCheck + 1 <= endIndex && compare(tree[nextToCheck], tree[nextToCheck + 1]))
          nextToCheck++;
        const existing = tree[nextToCheck];
        if (compare(existing, lastValue)) break;
        tree[destinationIndex] = existing;
        destinationIndex = nextToCheck;
      }
      tree[destinationIndex] = lastValue;
      return value;
    },
  };
}
