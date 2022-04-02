'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 *  判断是否是对象类型（数组，普通对象等）
 */
const isObject = function (value) {
    return typeof value === 'object' && value !== null;
};

let uid = 0;
let activeEffect;
const reactiveEffectStack = [];
/**
 * effect的实现目标：做到能够让函数fn里头的数据变化了，这整个函数就能够重新执行
 * 就好像函数fn是活的，一直在监听着自己里头的属性变化一样。
 */
function createReactiveEffect(fn, options = {}) {
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
            let result;
            try {
                reactiveEffectStack.push(reactiveEffect);
                activeEffect = reactiveEffectStack[reactiveEffectStack.length - 1];
                result = fn(); // 这传入effect的函数里头大部分时候都是会取值，一旦取值了，就会触发proxy handler的get方法
            }
            finally {
                reactiveEffectStack.pop();
                activeEffect = reactiveEffectStack[reactiveEffectStack.length - 1];
            }
            return result;
        }
    };
    reactiveEffect.uid = uid++; // 给本次创建的reactiveEffect函数一个唯一序号，用于区分不同的reactiveEffect函数
    reactiveEffect._isEffect = true; // 同时需要给创建reactiveEffect一个标志，知道这就是一个reactiveEffect函数
    reactiveEffect.raw = fn; // 同时还要知道一个reactiveEffect对应的原始响应函数是谁，是fn
    reactiveEffect.options = options; // 同时再接着把传入effect中的用户对effect配置保存，便于之后使用
    return reactiveEffect;
}
/**
 *  key: { name: jaylen }
 *  value: Map
 *    -- key : name
 *    -- value: Set = [reactiveEffect, reactiveEffect]
 */
const targetMap = new WeakMap();
/**
 * 收集依赖
 * collectDependency的实现目标：让对象中的某个属性，收集它对应的reactiveEffect函数，这个值放在了activeEffect
 * */
function collectDependency(target, key) {
    if (!activeEffect) {
        //说明此属性key不需要收集，因为压根没在effect中用，直接返回即可
        return;
    }
    /** WeakMap {
     *    key: { name: jaylen }
     *    value: Map { // dependenciesMap
     *      key : name
     *      value:
     *     }
     * }
     */
    let dependenciesMap = targetMap.get(target);
    if (!dependenciesMap) {
        dependenciesMap = new Map();
        targetMap.set(target, dependenciesMap);
    }
    /**
     * Set [reactiveEffect, reactiveEffect]
     */
    let reactiveEffectsSet = dependenciesMap.get(key);
    if (!reactiveEffectsSet) {
        reactiveEffectsSet = new Set();
        dependenciesMap.set(key, reactiveEffectsSet);
    }
    if (!reactiveEffectsSet.has(activeEffect)) {
        reactiveEffectsSet.add(activeEffect);
    }
    console.log('TargetMap', targetMap);
}
function effect(fn, options = {}) {
    const reactiveEffect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        // 如果说，配置当中用户对lazy属性的值传入false或者压根没传这个lazy的话，也就是没有告诉Vue需要懒执行的话
        reactiveEffect(); // 那么，响应式的effect，默认地，是会先执行一次的。其实就是立即执行一次fn
    }
    return reactiveEffect;
}

function createGetter({ isReadonly, isShallow }) {
    return function get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (!isReadonly) {
            // 如果这个对象不是只读的，那么在经过代理的时候就要进行依赖收集
            // 等会儿数据变化的时候，就需要对视图View进行更新了
            // ⚠️：如果是只读的，没必要收集依赖。收集了，你是只读的也没法改变属性，没法改变属性你收集依赖的作用就失去了
            // 因为收集依赖的目的就是为了属性改变之后触发effect重新更新视图
            console.log('执行effect时会取值，然后收集依赖');
            collectDependency(target, key);
        }
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

exports.effect = effect;
exports.reactive = reactive;
exports.readonly = readonly;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
//# sourceMappingURL=reactivity.cjs.js.map
