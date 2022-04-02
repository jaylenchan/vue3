/**
 *  判断是否是对象类型（数组，普通对象等）
 */
export const isObject = function (value: any) {
  return typeof value === 'object' && value !== null
}
