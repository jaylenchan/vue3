import { isObject } from './../../shared/src/index'
/**
 * 实现new Proxy(target, handlers)中的handlers
 * 如果是只读的（readonly），set应该报错
 * 是否深度的
 */

import { createReactiveProxy, reactive, readonly } from './reactive'

function createGetter({
  isReadonly,
  isShallow
}: {
  isReadonly: boolean
  isShallow: boolean
}) {
  return function get(
    target: Record<string | number, any>,
    key: string | number,
    receiver: any
  ) {
    const value = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      // 如果这个对象不是只读的，那么在经过代理的时候就要进行依赖收集
      // 等会儿数据变化的时候，就需要对视图View进行更新了
    }

    if (isShallow) {
      return value
    }
    if (isObject(value)) {
      // vue3跟vue2不同，vue3是取值的时候才进行深度代理判断
      // 而vue2是在reactive的时候就继续判断深度代理。二者不太相同，换句话说vue3可以说是懒代理
      return isReadonly ? readonly(value) : reactive(value)
    }

    return value
  }
}

function createSetter({
  isReadonly,
  isShallow
}: {
  isReadonly: boolean
  isShallow: boolean
}) {
  return function set(
    target: Record<string | number, any>,
    key: string | number,
    value: any,
    receiver: any
  ) {
    if (isReadonly) return console.warn(`${JSON.stringify(target)} is readonly`)
    Reflect.set(target, key, value, receiver)
  }
}

const mutableHandlers = {
  get: createGetter({
    isReadonly: false,
    isShallow: false
  }),
  set: createSetter({
    isReadonly: false,
    isShallow: false
  })
}

const shallowReactiveHandlers = {
  get: createGetter({
    isReadonly: false,
    isShallow: true
  }),
  set: createSetter({
    isReadonly: false,
    isShallow: true
  })
}

const readonlyHandlers = {
  get: createGetter({
    isReadonly: true,
    isShallow: false
  }),
  set: createSetter({
    isReadonly: true,
    isShallow: false
  })
}

const shallowReadonlyHandlers = {
  get: createGetter({
    isReadonly: true,
    isShallow: true
  }),
  set: createSetter({
    isReadonly: true,
    isShallow: true
  })
}

export {
  mutableHandlers,
  shallowReactiveHandlers,
  readonlyHandlers,
  shallowReadonlyHandlers
}