import { isObject } from '@vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './proxyHandlers'

/**
 * 是不是响应的，是不是只读的
 */
// 使用WeakMap会自动垃圾回收，它不会造成内存泄漏，而且存储的key只能是对象
const reactiveMap = new WeakMap()
const readonlyMap = new WeakMap()

/**
 * createReactiveProxy的实现目标：直接从WeakMap当中取对应target的proxy，如果没有就创建一个再取出来
 * 这样的话，如果多次对同一个对象进行createReactiveProxy，其实获得的都是同一个代理。可以防止一个对象重复代理
 * 即只有一次代理创建， 其他的时候使用createReactiveProxy都是从缓存WeakMap取
 * const o = {}
 * const obj = createReactiveProxy(o)
 * const obj1 = createReactiveProxy(o)
 * 这样子的结果是obj === obj1
 *
 * createReactiveProxy其实就做了两件事:
 * 1. 根据isReadonly去分配readonlyMap和reactiveMap。
 * 2. 往被分配到的map当中设置target->proxy的映射。如果已经有映射了，直接返回对应的proxy
 */
export function createReactiveProxy(
  target: Record<string, any>,
  {
    isReadonly,
    proxyHandlers
  }: { isReadonly: boolean; proxyHandlers: Record<string, any> }
) {
  // 判断要创建的是不是一个只读的代理，那如果是，需要使用只读map去缓存，或者取缓存
  const proxyMap = isReadonly ? readonlyMap : reactiveMap
  if (!proxyMap.has(target)) {
    // 如果WeakMap当中没有target这个key，那就没有target对应的代理，于是创建一个代理
    const proxy = new Proxy(target, proxyHandlers)
    // 并且将被代理对象与代理之间建立map联系
    proxyMap.set(target, proxy)
  }

  return proxyMap.get(target)
}

/**
 * reactive其实就做了一件事就是从reactiveMap中取target的proxy代理
 */
export function reactive(target: any) {
  // 如果不是对象类型，是普通类型或者函数类型，直接返回target
  if (!isObject(target)) return target
  return createReactiveProxy(target, {
    isReadonly: false,
    proxyHandlers: mutableHandlers
  })
}

/**
 * reactive其实就做了一件事就是从reactiveMap中取target的proxy代理
 */
export function shallowReactive(target: any) {
  // 如果不是对象类型，是普通类型或者函数类型，直接返回target
  if (!isObject(target)) return target
  return createReactiveProxy(target, {
    isReadonly: false,
    proxyHandlers: shallowReactiveHandlers
  })
}

/**
 * reactive其实就做了一件事就是从readonlyMap中取target的proxy代理
 */
export function readonly(target: any) {
  // 如果不是对象类型，是普通类型或者函数类型，直接返回target
  if (!isObject(target)) return target
  return createReactiveProxy(target, {
    isReadonly: true,
    proxyHandlers: readonlyHandlers
  })
}

/**
 * reactive其实就做了一件事就是从readonlyMap中取target的proxy代理
 */
export function shallowReadonly(target: any) {
  // 如果不是对象类型，是普通类型或者函数类型，直接返回target
  if (!isObject(target)) return target
  return createReactiveProxy(target, {
    isReadonly: true,
    proxyHandlers: shallowReadonlyHandlers
  })
}

/**
 * reactive/shallowReactive/readonly/shallowReadonly
 * 造成上述四者行为差异的本质在于返回的代理当中的proxyHandlers不同
 * 因为四个proxyHandlers的get和set，分别对应着四种不同的（获取值+设置值）的行为方式
 * 所以导致了返回的proxy在（获取值+设置值）的行为方式
 * 要知道，通过这四种函数获取到的都是代理，通过代理去获取原始对象的值和设置原始对象的值
 */
