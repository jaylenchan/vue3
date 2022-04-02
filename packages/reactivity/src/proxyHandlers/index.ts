/**
 * 实现new Proxy(target, handlers)中的handlers
 * 如果是只读的（readonly），set应该报错
 * 是否深度的
 */
export { default as mutableHandlers } from './mutableHandlers'
export { default as shallowReactiveHandlers } from './shallowReactiveHandlers'
export { default as readonlyHandlers } from './readonlyHandlers'
export { default as shallowReadonlyHandlers } from './shallowReadonlyHandlers'
