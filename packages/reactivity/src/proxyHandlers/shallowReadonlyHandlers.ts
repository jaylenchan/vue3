const shallowReadonlyHandlers = {
  get: function (target: Record<string, any>, key: string, receiver: any) {
    const value = Reflect.get(target, key, receiver)
    return value
  },
  set: function (target: Record<string, any>, key: string, value: any, receiver: any) {
    return console.warn(`${JSON.stringify(target)} is readonly`)
  }
}

export default shallowReadonlyHandlers
