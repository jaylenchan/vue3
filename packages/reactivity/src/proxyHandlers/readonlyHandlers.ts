import { isObject } from '@vue/shared'
import { readonly } from '../reactive'

const readonlyHandlers = {
  get: function (target: Record<string, any>, key: string, receiver: any) {
    let value = Reflect.get(target, key, receiver)
    if (isObject(value)) {
      value = readonly(value)
    }
    return value
  },
  set: function (target: Record<string, any>, key: string, value: any, receiver: any) {
    return console.warn(`${JSON.stringify(target)} is readonly`)
  }
}

export default readonlyHandlers
