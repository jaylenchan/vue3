import { hasChanged, hasOwnProperty, isArray, isIntegerKey } from '@vue/shared'
import { collectDependency, emit } from '../effect'
import { EmitEvent } from '../types'

const shallowReactiveHandlers = {
  get: function (target: Record<string, any>, key: string, receiver: any) {
    const value = Reflect.get(target, key, receiver)
    // 如果这个对象不是只读的，那么在经过代理的时候就要进行依赖收集
    // 等会儿数据变化的时候，就需要对视图View进行更新了
    // ⚠️：如果是只读的，没必要收集依赖。收集了，你是只读的也没法改变属性，没法改变属性你收集依赖的作用就失去了
    // 因为收集依赖的目的就是为了属性改变之后触发effect重新更新视图
    console.log('执行effect时会取值，然后收集依赖')
    collectDependency(target, key)
    return value
  },
  set: function (target: Record<string, any>, key: string, value: any, receiver: any) {
    /**
     * 当数据更新的时候，在此时需要通知该key对应的reactiveEffect重新执行
     * 考虑情况：数据是新增的，还是数据是被修改了
     * 要知道，在vue2当中是没法更改索引，同时也没法监控到数组的长度变化。在vue3解决了
     * 但是对于一些比较特殊的方法，就需要特殊去处理了。
     */
    let oldValue = target[key]
    // 判断如果是数组的话，同时是拿数组的索引去做值的修改
    // 比如说arr[1] = xxx -> target: arr key: '1'
    // 这时候就要去判断说这个key是不是在数组的长度以内。是长度以内的，说明是修改值，不是的话，说明是新增值
    // 总结：就是利用数组的长度和key作比较来区分是对数组进行值的新增还是修改
    const hasKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwnProperty(target, key as string)

    if (!hasKey) {
      // 说明是新增属性
      emit(EmitEvent.ADD, target, key, value)
    } else if (hasChanged(oldValue, value)) {
      //判断新的值和老的值做比较，是否修改了，没修改的话，没卵用。只有修改了才跑这个逻辑
      // 说明是修改属性
      emit(EmitEvent.EDIT, target, key, value, oldValue)
    }
    const result = Reflect.set(target, key, value, receiver)
    return result
  }
}

export default shallowReactiveHandlers
