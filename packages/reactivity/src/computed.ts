import { isFunction } from '@vue/shared'
import { effect } from './effect'
type IParams = {
  get: (...args: any[]) => any
  set: (...args: any[]) => any
}

type IGetter = IParams['get']
type ISetter = IParams['set']

class ComputedRefImpl {
  public _dirty: boolean = true
  public _value: any
  public effect
  constructor(public getter: IGetter, public setter: ISetter) {
    this.effect = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true
        }
      }
    })
  }

  get value() {
    if (this._dirty) {
      this._value = this.effect()
      this._dirty = false
    }

    return this._value
  }

  set value(newVal) {
    this.setter(newVal)
  }
}

export function computed(params: IGetter | IParams) {
  let getter: IGetter
  let setter: ISetter

  if (isFunction(params)) {
    getter = params as IGetter
    setter = () => {
      console.warn('computed param is readonly')
    }
  } else {
    getter = (params as IParams).get
    setter = (params as IParams).set
  }

  return new ComputedRefImpl(getter, setter)
}
