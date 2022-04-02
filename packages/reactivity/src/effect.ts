let uid = 0
let activeEffect: (...args: any[]) => any
const reactiveEffectStack: Array<(...args: any[]) => any> = []
/**
 * effect的实现目标：做到能够让函数fn里头的数据变化了，这整个函数就能够重新执行
 * 就好像函数fn是活的，一直在监听着自己里头的属性变化一样。
 */
function createReactiveEffect(
  fn: (...args: any[]) => any,
  options: Record<string, any> = {}
): (...args: any[]) => any {
  /**
   * 直接activeEffect= reactiveEffect的弊端
   * 万一用户，按如下这么写
   * effect(() => {
   *   console.log(state.name) -> 此时activeEffect是reactiveEffect.uid 是0
   *   effect(() => {
   *     console.log(state.age) -> 此时activeEffect是reactiveEffect.uid 是1
   *   })
   *   console.log(state.school) -> 此时activeEffect是reactiveEffect.uid 是1
   * })
   * 我们发现在同一个外层作用域activeEffect变了。从uid0变成uid1的reactiveEffect
   * 那么一个作用域两个不同的reactiveEffect，最终函数执行逻辑就不同了。
   * 而我们想要的是跑到外层的时候，activeEffect回到uid0的reactiveEffect
   * 因此我们需要使用一个栈结构去解决这个问题
   */
  const reactiveEffect = function () {
    if (!reactiveEffectStack.includes(reactiveEffect)) {
      // 保证reactiveEffect没有加入reactiveEffectStack
      // 因为用户可能使用effect(() => { state.index ++ })
      // 用户用了++,就不断触发这个函数了，为了防止这一点，需要先判断一下
      let result
      try {
        reactiveEffectStack.push(reactiveEffect)
        activeEffect = reactiveEffectStack[reactiveEffectStack.length - 1]
        result = fn() // 这传入effect的函数里头大部分时候都是会取值，一旦取值了，就会触发proxy handler的get方法
      } finally {
        reactiveEffectStack.pop()
        activeEffect = reactiveEffectStack[reactiveEffectStack.length - 1]
      }
      return result
    }
  }
  reactiveEffect.uid = uid++ // 给本次创建的reactiveEffect函数一个唯一序号，用于区分不同的reactiveEffect函数
  reactiveEffect._isEffect = true // 同时需要给创建reactiveEffect一个标志，知道这就是一个reactiveEffect函数
  reactiveEffect.raw = fn // 同时还要知道一个reactiveEffect对应的原始响应函数是谁，是fn
  reactiveEffect.options = options // 同时再接着把传入effect中的用户对effect配置保存，便于之后使用
  return reactiveEffect
}

/**
 *  key: { name: jaylen }
 *  value: Map
 *    -- key : name
 *    -- value: Set = [reactiveEffect, reactiveEffect]
 */
const targetMap = new WeakMap()
/**
 * 收集依赖
 * collectDependency的实现目标：让对象中的某个属性，收集它对应的reactiveEffect函数，这个值放在了activeEffect
 * */
export function collectDependency(
  target: Record<string | number, any>,
  key: string | number
) {
  if (!activeEffect) {
    //说明此属性key不需要收集，因为压根没在effect中用，直接返回即可
    return
  }

  /** WeakMap {
   *    key: { name: jaylen }
   *    value: Map { // dependenciesMap
   *      key : name
   *      value:
   *     }
   * }
   */
  let dependenciesMap = targetMap.get(target)
  if (!dependenciesMap) {
    dependenciesMap = new Map()
    targetMap.set(target, dependenciesMap)
  }

  /**
   * Set [reactiveEffect, reactiveEffect]
   */
  let reactiveEffectsSet = dependenciesMap.get(key)
  if (!reactiveEffectsSet) {
    reactiveEffectsSet = new Set()
    dependenciesMap.set(key, reactiveEffectsSet)
  }

  if (!reactiveEffectsSet.has(activeEffect)) {
    reactiveEffectsSet.add(activeEffect)
  }

  console.log('TargetMap', targetMap)
}

export function effect(fn: (...args: any[]) => any, options: Record<string, any> = {}) {
  const reactiveEffect = createReactiveEffect(fn, options)

  if (!options.lazy) {
    // 如果说，配置当中用户对lazy属性的值传入false或者压根没传这个lazy的话，也就是没有告诉Vue需要懒执行的话
    reactiveEffect() // 那么，响应式的effect，默认地，是会先执行一次的。其实就是立即执行一次fn
  }

  return reactiveEffect
}
