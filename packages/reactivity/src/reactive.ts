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

export function createReactiveProxy(
  target: Record<string | number, any>,
  {
    isReadonly,
    proxyHandlers
  }: { isReadonly: boolean; proxyHandlers: Record<string, Function> }
) {
  // 如果不是对象类型，是普通类型或者函数类型，直接返回target
  if (!isObject(target)) return target
  // 不过在进行proxy生成之前，要判断下这个对象是不是已经被代理了，不需要重复代理

  // 判断要创建的是不是一个只读的代理，那如果是，需要使用只读map去缓存，或者取缓存
  const proxyMap = isReadonly ? readonlyMap : reactiveMap

  // 如果代理map中有缓存过这个target对应的代理，直接返回缓存
  if (proxyMap.has(target)) {
    /**
     * 做缓存判断，是为了防止用户出现以下的操作
     * const o = {}
     * const obj = createReactiveProxy(o)
     * const obj1 = createReactiveProxy(o)
     * 即多次代理，多次代理一个对象，我们就判断如果缓存中有了，就直接给它返回缓存即可
     * 不需要代理多次
     */
    return proxyMap.get(target)
  }

  // 否则创建一个代理
  const proxy = new Proxy(target, proxyHandlers)
  // 并且将被代理对象与代理之间建立map联系
  proxyMap.set(target, proxy)

  return proxy
}

export function reactive(target: any) {
  return createReactiveProxy(target, {
    isReadonly: false,
    proxyHandlers: mutableHandlers
  })
}

export function shallowReactive(target: any) {
  return createReactiveProxy(target, {
    isReadonly: false,
    proxyHandlers: shallowReactiveHandlers
  })
}

export function readonly(target: any) {
  return createReactiveProxy(target, {
    isReadonly: true,
    proxyHandlers: readonlyHandlers
  })
}

export function shallowReadonly(target: any) {
  return createReactiveProxy(target, {
    isReadonly: true,
    proxyHandlers: shallowReadonlyHandlers
  })
}
