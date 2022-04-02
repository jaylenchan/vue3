import { hasChanged, isArray, isObject } from '@vue/shared'
import { collectDependency, emit } from './effect'
import { reactive } from './reactive'
import { EmitEvent } from './types'
class RefImpl {
  public _value: any // 只是声明一个属性，但是没有执行this.xx = xx
  public __v_isRef = true // 表示是一个ref属性
  //参数当中增加修饰符，表示这个属性被放到了实例当中，即声明了对应同名属性并且放到了this.同名属性 = 同名属性赋值
  constructor(public rawVal: any, public isShallow: boolean) {
    this._value = isShallow ? rawVal : convert(rawVal)
  }

  get value() {
    // 取值就是使用xx.value，实际上会代理到_value
    collectDependency(this, 'value')
    return this._value
  }

  set value(newVal) {
    if (hasChanged(this.rawVal, newVal)) {
      // 判断老值相对于新值是否有变化
      this.rawVal = newVal // 有变化的话，老的值变成新的值
      this._value = this.isShallow ? newVal : convert(newVal)
      emit(EmitEvent.EDIT, this, 'value', newVal)
    }
  }
}

class ObjectRefImpl {
  public __v_isRef = true
  constructor(public target: Record<string, any>, public key: string) {}

  get value() {
    return this.target[this.key]
  }

  set value(newVal) {
    this.target[this.key] = newVal
  }
}

function convert(value: any) {
  return isObject(value) ? reactive(value) : value
}

function createRef(value: any, isShallow: boolean = false) {
  return new RefImpl(value, isShallow)
}

/**
 * ref和reactive的区别：reactive内部采用的是proxy，而ref内部使用的是defineProperty
 */
export function ref(value: any) {
  // 将普通类型变成一个对象。当然也可以value是对象，但是对象一般用reactive
  return createRef(value)
}

export function shallowRef(value: any) {
  return createRef(value, true)
}

/**
 * toRef：可以将一个对象的属性，变成ref
 */
export function toRef(target: Record<string, any>, key: string) {
  return new ObjectRefImpl(target, key)
}

export function toRefs(object: Record<string, any>) {
  const result = isArray(object) ? new Array(object.length) : ({} as Record<string, any>)

  for (let key in object) {
    result[key] = toRef(object, key)
  }

  return result
}
