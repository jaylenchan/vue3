/**
 *  判断是否是对象类型（数组，普通对象等）
 */
export const isObject = function (value: any) {
  return typeof value === 'object' && value !== null
}

/**
 * 判断是不是数组
 */
export const isArray = Array.isArray

/**
 * 判断是不是函数
 */
export const isFunction = function (value: any) {
  return typeof value === 'function'
}

/**
 * 判断是不是整型
 */
export const isNumber = function (value: any) {
  return typeof value === 'number'
}

/**
 * 判断是不是字符串
 */
export const isString = function (value: any) {
  return typeof value === 'string'
}

/**
 * 判断是不是数字类型字符串
 */
export const isIntegerKey = function (value: any) {
  return parseInt(value) + '' === value
}

/**
 * 判断是不是实例属性
 */
export const hasOwnProperty = function (target: Record<string, any>, key: string) {
  return target.hasOwnProperty(key)
}

/**
 * 判断数组或者对象的对应key是新增还是修改
 * 思考：对象和数组分别如何知道是新增还是修改
 * 对象：找对应key是否有值，有就是修改，没就是新增
 * 数组：找对应索引是否比数组长度小，如果小说明这个位置是有元素的，那就是修改，否则就是新增
 */
export const isKeyExist = function (target: Record<string, any>, key: string) {
  return isArray(target) && isIntegerKey(key)
    ? Number(key) < target.length
    : hasOwnProperty(target, key as string)
}

/**
 * 判断值是否修改了
 */
export const hasChanged = function (oldValue: any, newValue: any) {
  return oldValue !== newValue
}
