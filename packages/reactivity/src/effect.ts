import { isArray, isIntegerKey } from '@vue/shared'
import { EmitEvent } from './types'

type IReactiveEffect = ((...args: any[]) => any) & {
  uid: number
  _isEffect: boolean
  options: Record<string, any>
  raw: (...args: any[]) => any
}
let uid = 0
let activeEffect: IReactiveEffect // 当前正在运行的reactiveEffect
const reactiveEffectStack: Array<IReactiveEffect> = []
export const targetMap = new WeakMap<
  Record<string, any>,
  Map<string, Set<IReactiveEffect>>
>()

/** 触发更新，重新执行reactiveEffect */
export function emit(
  eventType: EmitEvent,
  target: Record<string, any>,
  key?: string,
  newValue?: any,
  oldValue?: any
) {
  /**
   * 如果属性没有收集过依赖，那么直接返回
   */
  let dependenciesMap = targetMap.get(target)
  if (!dependenciesMap) return

  const reactiveEffectsCollectSet = new Set<IReactiveEffect>() // 待会将所有要执行的reactiveEffect集中到这里头，然后一起执行
  const add = function (reactiveEffectsSet: Set<IReactiveEffect>) {
    if (reactiveEffectsSet) {
      // ⚠️：这个是一个Set做循环
      reactiveEffectsSet.forEach((reactiveEffect) => {
        reactiveEffectsCollectSet.add(reactiveEffect)
      })
    }
  }
  // 1. 看看修改的是不是数组的长度，因为改数组的长度影响是比较大的
  if (isArray(target) && key === 'length') {
    // 如果对应的长度有依赖收集就需要更新
    // ⚠️：这是一个map循环，第一个是value，第二个就是key
    dependenciesMap.forEach((reactiveEffectsSet, key) => {
      // 如果更改的长度小于收集的索引，那么索引也需要触发effect重新执行
      if (key === 'length' || key > newValue) {
        add(reactiveEffectsSet)
      }
    })
  } else {
    // 可能是对象
    if (key !== undefined) {
      // 在这个地方肯定是修改，因为key存在
      add(dependenciesMap.get(key) as Set<IReactiveEffect>)
    }
    // 如果修改了数组当中的某一个索引，怎么办？
    switch (eventType) {
      case EmitEvent.ADD: // 如果添加了一个索引，那就触发长度的更新
        if (isArray(target) && isIntegerKey(key)) {
          add(dependenciesMap.get('length') as Set<IReactiveEffect>)
        }
    }
  }
  reactiveEffectsCollectSet.forEach((reactiveEffect) => {
    if (reactiveEffect.options.scheduler) {
      reactiveEffect.options.scheduler(reactiveEffect)
    } else {
      reactiveEffect()
    }
  })
}
/**
 * createReactiveEffect就做了一件事：创建一个reactiveEffect，并返回这个reactiveEffect
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
 * 收集依赖的问题：如何知道现在准备建立联系的key对应的reactiveEffect是哪一个？并且获取到它来建立联系
 * 解决的方式：设置一个activeEffect，在createReactiveEffect创建一个新的reactiveEffect时，给activeEffect赋值这个ractiveEffect
 * 然后再收集依赖collectDependency的时候将activeEffect取出来用（可以理解成两者在进行通信）
 * collectDependency的实现目标：让对象中的某个属性，收集它对应的reactiveEffect函数，这个值放在了activeEffect
 * 依赖收集其实就干了一件事：让key跟它的reactiveEffect建立联系（本质就是key跟放进effect中的那个函数fn建立联系）
 * 因为reactiveEffect执行了，必定fn也执行。reactiveEffect其实就是在fn基础上，再包装了一些东西，做了额外操作（AOP思想）
 * */
export function collectDependency(target: Record<string, any>, key: string) {
  if (!activeEffect) {
    /**
     * 要知道如果effect(() => { state.name })只要这么用，一定会产生一个reactiveEffect
     * 这个activeEffect也是肯定有值的，如果没有说明肯定没在effect用
     */
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
    dependenciesMap = new Map<string, Set<IReactiveEffect>>()
    targetMap.set(target, dependenciesMap)
  }
  /**
   * Set [reactiveEffect, reactiveEffect]
   */
  let reactiveEffectsSet = dependenciesMap.get(key)
  if (!reactiveEffectsSet) {
    reactiveEffectsSet = new Set<IReactiveEffect>()
    dependenciesMap.set(key, reactiveEffectsSet)
  }

  if (!reactiveEffectsSet.has(activeEffect)) {
    reactiveEffectsSet.add(activeEffect)
  }

  console.log('TargetMap', targetMap)
}

/**
 * effect的实现目标：做到能够让函数fn里头的数据变化了，这整个函数就能够重新执行
 * 要实现这个效果，必须想办法保存fn，将fn跟fn函数体里头使用的数据对应起来。
 * 方法： 函数fn在执行的时候是会取值的，取值就会走proxy的handler中的get handler。
 * 只需要在get当中让获取值的key属性，和使用的effect产生关联就可以解决对应的关系。其实术语叫做依赖收集
 * 每次调用一次effect，都会重新创建createReactiveEffect一个新的reactiveEffect
 */
export function effect(fn: (...args: any[]) => any, options: Record<string, any> = {}) {
  const reactiveEffect = createReactiveEffect(fn, options)

  if (!options.lazy) {
    // 如果说，配置当中用户对lazy属性的值传入false或者压根没传这个lazy的话，也就是没有告诉Vue需要懒执行的话
    reactiveEffect() // 那么，响应式的effect，默认地，是会先执行一次的。其实就是立即执行一次fn
  }

  return reactiveEffect
}
