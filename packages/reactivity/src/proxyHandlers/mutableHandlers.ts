import { hasChanged, isKeyExist, isObject } from '@vue/shared'
import { collectDependency, emit } from '../effect'
import { reactive } from '../reactive'
import { EmitEvent } from '../types'

const mutableHandlers = {
  get: function (target: Record<string, any>, key: string, receiver: any) {
    let value = Reflect.get(target, key, receiver)
    // ⚠️：如果是只读属性，没必要收集依赖。收集了，你是只读的也没法改变属性，没法改变属性你收集依赖的作用就失去了，因为收集依赖的目的就是为了属性改变之后触发effect重新更新视图
    // 依赖收集：让触发get handler的key属性和对应的effect函数对应起来，建立起映射的关系，方便后边修改值后重新触发这个函数
    collectDependency(target, key)

    if (isObject(value)) {
      value = reactive(value)
    }
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
    /**
     * 思考：对象和数组分别如何知道是新增还是修改
     * 对象：找对应key是否有值，有就是修改，没就是新增
     * 数组：找对应索引是否比数组长度小，如果小说明这个位置是有元素的，那就是修改，否则就是新增
     */

    if (!isKeyExist(target, key)) {
      // 说明是新增属性
      emit(EmitEvent.ADD, target, key, value)
    } else {
      // 说明是修改属性
      if (hasChanged(oldValue, value)) {
        //判断新的值和老的值做比较，是否修改了,只有修改了才跑这个逻辑
        emit(EmitEvent.EDIT, target, key, value, oldValue)
      }
      // 如果值没啥变化，不管他
    }
    const result = Reflect.set(target, key, value, receiver)
    return result
  }
}

export default mutableHandlers
