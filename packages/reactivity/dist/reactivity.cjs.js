'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 *  判断是否是对象类型（数组，普通对象等）
 */
const isObject = function (value) {
    return typeof value === 'object' && value !== null;
};

function createGetter({ isReadonly, isShallow }) {
    return function get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (isShallow) {
            return value;
        }
        if (isObject(value)) {
            // vue3跟vue2不同，vue3是取值的时候才进行深度代理判断
            // 而vue2是在reactive的时候就继续判断深度代理。二者不太相同，换句话说vue3可以说是懒代理
            return isReadonly ? readonly(value) : reactive(value);
        }
        return value;
    };
}
function createSetter({ isReadonly, isShallow }) {
    return function set(target, key, value, receiver) {
        if (isReadonly)
            return console.warn(`${JSON.stringify(target)} is readonly`);
        Reflect.set(target, key, value, receiver);
    };
}
const mutableHandlers = {
    get: createGetter({
        isReadonly: false,
        isShallow: false
    }),
    set: createSetter({
        isReadonly: false,
        isShallow: false
    })
};
const shallowReactiveHandlers = {
    get: createGetter({
        isReadonly: false,
        isShallow: true
    }),
    set: createSetter({
        isReadonly: false,
        isShallow: true
    })
};
const readonlyHandlers = {
    get: createGetter({
        isReadonly: true,
        isShallow: false
    }),
    set: createSetter({
        isReadonly: true,
        isShallow: false
    })
};
const shallowReadonlyHandlers = {
    get: createGetter({
        isReadonly: true,
        isShallow: true
    }),
    set: createSetter({
        isReadonly: true,
        isShallow: true
    })
};

/**
 * 是不是响应的，是不是只读的
 */
// 使用WeakMap会自动垃圾回收，它不会造成内存泄漏，而且存储的key只能是对象
const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
function createReactiveProxy(target, { isReadonly, proxyHandlers }) {
    // 如果不是对象类型，是普通类型或者函数类型，直接返回target
    if (!isObject(target))
        return target;
    // 不过在进行proxy生成之前，要判断下这个对象是不是已经被代理了，不需要重复代理
    // 判断要创建的是不是一个只读的代理，那如果是，需要使用只读map去缓存，或者取缓存
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
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
        return proxyMap.get(target);
    }
    // 否则创建一个代理
    const proxy = new Proxy(target, proxyHandlers);
    // 并且将被代理对象与代理之间建立map联系
    proxyMap.set(target, proxy);
    return proxy;
}
function reactive(target) {
    return createReactiveProxy(target, {
        isReadonly: false,
        proxyHandlers: mutableHandlers
    });
}
function shallowReactive(target) {
    return createReactiveProxy(target, {
        isReadonly: false,
        proxyHandlers: shallowReactiveHandlers
    });
}
function readonly(target) {
    return createReactiveProxy(target, {
        isReadonly: true,
        proxyHandlers: readonlyHandlers
    });
}
function shallowReadonly(target) {
    return createReactiveProxy(target, {
        isReadonly: true,
        proxyHandlers: shallowReadonlyHandlers
    });
}

exports.reactive = reactive;
exports.readonly = readonly;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
//# sourceMappingURL=reactivity.cjs.js.map
