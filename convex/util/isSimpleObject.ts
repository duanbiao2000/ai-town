/**
 * 判断给定的值是否为简单对象
 * 
 * 在这个上下文中，简单对象是指那些直接由Object构造函数创建的对象，
 * 或者是通过对象字面量创建的对象这些对象的原型要么是null，
 * 要么是Object.prototype，或者它们的构造函数的名称是'Object'
 * 
 * @param value 未知类型，待检查的值
 * @returns 返回一个布尔值，如果value是一个简单对象，则为true；否则为false
 */
export function isSimpleObject(value: unknown) {
  // 检查value是否是一个对象类型
  const isObject = typeof value === 'object';
  // 获取value的原型
  const prototype = Object.getPrototypeOf(value);
  // 判断value是否没有原型或者是原生的Object原型或者是Object构造函数直接创建的
  const isSimple =
    prototype === null ||
    prototype === Object.prototype ||
    // Objects generated from other contexts (e.g. across Node.js `vm` modules) will not satisfy the previous
    // conditions but are still simple objects.
    prototype?.constructor?.name === 'Object';
  // 返回最终的判断结果
  return isObject && isSimple;
}
