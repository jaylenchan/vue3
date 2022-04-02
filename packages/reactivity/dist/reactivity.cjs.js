'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 *  判断是否是对象类型（数组，普通对象等）
 */
const isObject = function (value) {
    return typeof value === 'object' && value !== null;
};
/**
 * 判断是不是数组
 */
const isArray = Array.isArray;
/**
 * 判断是不是数字类型字符串
 */
const isIntegerKey = function (value) {
    return parseInt(value) + '' === value;
};
/**
 * 判断是不是实例属性
 */
const hasOwnProperty = function (target, key) {
    return target.hasOwnProperty(key);
};
/**
 * 判断数组或者对象的对应key是新增还是修改
 * 思考：对象和数组分别如何知道是新增还是修改
 * 对象：找对应key是否有值，有就是修改，没就是新增
 * 数组：找对应索引是否比数组长度小，如果小说明这个位置是有元素的，那就是修改，否则就是新增
 */
const isKeyExist = function (target, key) {
    return isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwnProperty(target, key);
};
/**
 * 判断值是否修改了
 */
const hasChanged = function (oldValue, newValue) {
    return oldValue !== newValue;
};

let uid = 0;
let activeEffect; // 当前正在运行的reactiveEffect
const reactiveEffectStack = [];
const targetMap = new WeakMap();
/** 触发更新，重新执行reactiveEffect */
function emit(eventType, target, key, newValue, oldValue) {
    /**
     * 如果属性没有收集过依赖，那么直接返回
     */
    let dependenciesMap = targetMap.get(target);
    if (!dependenciesMap)
        return;
    const reactiveEffectsCollectSet = new Set(); // 待会将所有要执行的reactiveEffect集中到这里头，然后一起执行
    const add = function (reactiveEffectsSet) {
        if (reactiveEffectsSet) {
            // ⚠️：这个是一个Set做循环
            reactiveEffectsSet.forEach((reactiveEffect) => {
                reactiveEffectsCollectSet.add(reactiveEffect);
            });
        }
    };
    // 1. 看看修改的是不是数组的长度，因为改数组的长度影响是比较大的
    if (isArray(target) && key === 'length') {
        // 如果对应的长度有依赖收集就需要更新
        // ⚠️：这是一个map循环，第一个是value，第二个就是key
        dependenciesMap.forEach((reactiveEffectsSet, key) => {
            // 如果更改的长度小于收集的索引，那么索引也需要触发effect重新执行
            if (key === 'length' || key > newValue) {
                add(reactiveEffectsSet);
            }
        });
    }
    else {
        // 可能是对象
        if (key !== undefined) {
            // 在这个地方肯定是修改，因为key存在
            add(dependenciesMap.get(key));
        }
        // 如果修改了数组当中的某一个索引，怎么办？
        switch (eventType) {
            case 0 /* ADD */: // 如果添加了一个索引，那就触发长度的更新
                if (isArray(target) && isIntegerKey(key)) {
                    add(dependenciesMap.get('length'));
                }
        }
    }
    reactiveEffectsCollectSet.forEach((reactiveEffect) => reactiveEffect());
}
/**
 * createReactiveEffect就做了一件事：创建一个reactiveEffect，并返回这个reactiveEffect
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
 * 收集依赖的问题：如何知道现在准备建立联系的key对应的reactiveEffect是哪一个？并且获取到它来建立联系
 * 解决的方式：设置一个activeEffect，在createReactiveEffect创建一个新的reactiveEffect时，给activeEffect赋值这个ractiveEffect
 * 然后再收集依赖collectDependency的时候将activeEffect取出来用（可以理解成两者在进行通信）
 * collectDependency的实现目标：让对象中的某个属性，收集它对应的reactiveEffect函数，这个值放在了activeEffect
 * 依赖收集其实就干了一件事：让key跟它的reactiveEffect建立联系（本质就是key跟放进effect中的那个函数fn建立联系）
 * 因为reactiveEffect执行了，必定fn也执行。reactiveEffect其实就是在fn基础上，再包装了一些东西，做了额外操作（AOP思想）
 * */
function collectDependency(target, key) {
    if (!activeEffect) {
        /**
         * 要知道如果effect(() => { state.name })只要这么用，一定会产生一个reactiveEffect
         * 这个activeEffect也是肯定有值的，如果没有说明肯定没在effect用
         */
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
/**
 * effect的实现目标：做到能够让函数fn里头的数据变化了，这整个函数就能够重新执行
 * 要实现这个效果，必须想办法保存fn，将fn跟fn函数体里头使用的数据对应起来。
 * 方法： 函数fn在执行的时候是会取值的，取值就会走proxy的handler中的get handler。
 * 只需要在get当中让获取值的key属性，和使用的effect产生关联就可以解决对应的关系。其实术语叫做依赖收集
 * 每次调用一次effect，都会重新创建createReactiveEffect一个新的reactiveEffect
 */
function effect(fn, options = {}) {
    const reactiveEffect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        // 如果说，配置当中用户对lazy属性的值传入false或者压根没传这个lazy的话，也就是没有告诉Vue需要懒执行的话
        reactiveEffect(); // 那么，响应式的effect，默认地，是会先执行一次的。其实就是立即执行一次fn
    }
    return reactiveEffect;
}

const mutableHandlers = {
    get: function (target, key, receiver) {
        let value = Reflect.get(target, key, receiver);
        // ⚠️：如果是只读属性，没必要收集依赖。收集了，你是只读的也没法改变属性，没法改变属性你收集依赖的作用就失去了，因为收集依赖的目的就是为了属性改变之后触发effect重新更新视图
        // 依赖收集：让触发get handler的key属性和对应的effect函数对应起来，建立起映射的关系，方便后边修改值后重新触发这个函数
        collectDependency(target, key);
        if (isObject(value)) {
            value = reactive(value);
        }
        return value;
    },
    set: function (target, key, value, receiver) {
        /**
         * 当数据更新的时候，在此时需要通知该key对应的reactiveEffect重新执行
         * 考虑情况：数据是新增的，还是数据是被修改了
         * 要知道，在vue2当中是没法更改索引，同时也没法监控到数组的长度变化。在vue3解决了
         * 但是对于一些比较特殊的方法，就需要特殊去处理了。
         */
        let oldValue = target[key];
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
            emit(0 /* ADD */, target, key, value);
        }
        else {
            // 说明是修改属性
            if (hasChanged(oldValue, value)) {
                //判断新的值和老的值做比较，是否修改了,只有修改了才跑这个逻辑
                emit(1 /* EDIT */, target, key, value);
            }
            // 如果值没啥变化，不管他
        }
        const result = Reflect.set(target, key, value, receiver);
        return result;
    }
};

const shallowReactiveHandlers = {
    get: function (target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        // 如果这个对象不是只读的，那么在经过代理的时候就要进行依赖收集
        // 等会儿数据变化的时候，就需要对视图View进行更新了
        // ⚠️：如果是只读的，没必要收集依赖。收集了，你是只读的也没法改变属性，没法改变属性你收集依赖的作用就失去了
        // 因为收集依赖的目的就是为了属性改变之后触发effect重新更新视图
        console.log('执行effect时会取值，然后收集依赖');
        collectDependency(target, key);
        return value;
    },
    set: function (target, key, value, receiver) {
        /**
         * 当数据更新的时候，在此时需要通知该key对应的reactiveEffect重新执行
         * 考虑情况：数据是新增的，还是数据是被修改了
         * 要知道，在vue2当中是没法更改索引，同时也没法监控到数组的长度变化。在vue3解决了
         * 但是对于一些比较特殊的方法，就需要特殊去处理了。
         */
        let oldValue = target[key];
        // 判断如果是数组的话，同时是拿数组的索引去做值的修改
        // 比如说arr[1] = xxx -> target: arr key: '1'
        // 这时候就要去判断说这个key是不是在数组的长度以内。是长度以内的，说明是修改值，不是的话，说明是新增值
        // 总结：就是利用数组的长度和key作比较来区分是对数组进行值的新增还是修改
        const hasKey = isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length
            : hasOwnProperty(target, key);
        if (!hasKey) {
            // 说明是新增属性
            emit(0 /* ADD */, target, key, value);
        }
        else if (hasChanged(oldValue, value)) {
            //判断新的值和老的值做比较，是否修改了，没修改的话，没卵用。只有修改了才跑这个逻辑
            // 说明是修改属性
            emit(1 /* EDIT */, target, key, value);
        }
        const result = Reflect.set(target, key, value, receiver);
        return result;
    }
};

const readonlyHandlers = {
    get: function (target, key, receiver) {
        let value = Reflect.get(target, key, receiver);
        if (isObject(value)) {
            value = readonly(value);
        }
        return value;
    },
    set: function (target, key, value, receiver) {
        return console.warn(`${JSON.stringify(target)} is readonly`);
    }
};

const shallowReadonlyHandlers = {
    get: function (target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        return value;
    },
    set: function (target, key, value, receiver) {
        return console.warn(`${JSON.stringify(target)} is readonly`);
    }
};

/**
 * 是不是响应的，是不是只读的
 */
// 使用WeakMap会自动垃圾回收，它不会造成内存泄漏，而且存储的key只能是对象
const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
/**
 * createReactiveProxy的实现目标：直接从WeakMap当中取对应target的proxy，如果没有就创建一个再取出来
 * 这样的话，如果多次对同一个对象进行createReactiveProxy，其实获得的都是同一个代理。可以防止一个对象重复代理
 * 即只有一次代理创建， 其他的时候使用createReactiveProxy都是从缓存WeakMap取
 * const o = {}
 * const obj = createReactiveProxy(o)
 * const obj1 = createReactiveProxy(o)
 * 这样子的结果是obj === obj1
 *
 * createReactiveProxy其实就做了两件事:
 * 1. 根据isReadonly去分配readonlyMap和reactiveMap。
 * 2. 往被分配到的map当中设置target->proxy的映射。如果已经有映射了，直接返回对应的proxy
 */
function createReactiveProxy(target, { isReadonly, proxyHandlers }) {
    // 判断要创建的是不是一个只读的代理，那如果是，需要使用只读map去缓存，或者取缓存
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    if (!proxyMap.has(target)) {
        // 如果WeakMap当中没有target这个key，那就没有target对应的代理，于是创建一个代理
        const proxy = new Proxy(target, proxyHandlers);
        // 并且将被代理对象与代理之间建立map联系
        proxyMap.set(target, proxy);
    }
    return proxyMap.get(target);
}
/**
 * reactive其实就做了一件事就是从reactiveMap中取target的proxy代理
 */
function reactive(target) {
    // 如果不是对象类型，是普通类型或者函数类型，直接返回target
    if (!isObject(target))
        return target;
    return createReactiveProxy(target, {
        isReadonly: false,
        proxyHandlers: mutableHandlers
    });
}
/**
 * reactive其实就做了一件事就是从reactiveMap中取target的proxy代理
 */
function shallowReactive(target) {
    // 如果不是对象类型，是普通类型或者函数类型，直接返回target
    if (!isObject(target))
        return target;
    return createReactiveProxy(target, {
        isReadonly: false,
        proxyHandlers: shallowReactiveHandlers
    });
}
/**
 * reactive其实就做了一件事就是从readonlyMap中取target的proxy代理
 */
function readonly(target) {
    // 如果不是对象类型，是普通类型或者函数类型，直接返回target
    if (!isObject(target))
        return target;
    return createReactiveProxy(target, {
        isReadonly: true,
        proxyHandlers: readonlyHandlers
    });
}
/**
 * reactive其实就做了一件事就是从readonlyMap中取target的proxy代理
 */
function shallowReadonly(target) {
    // 如果不是对象类型，是普通类型或者函数类型，直接返回target
    if (!isObject(target))
        return target;
    return createReactiveProxy(target, {
        isReadonly: true,
        proxyHandlers: shallowReadonlyHandlers
    });
}
/**
 * reactive/shallowReactive/readonly/shallowReadonly
 * 造成上述四者行为差异的本质在于返回的代理当中的proxyHandlers不同
 * 因为四个proxyHandlers的get和set，分别对应着四种不同的（获取值+设置值）的行为方式
 * 所以导致了返回的proxy在（获取值+设置值）的行为方式
 * 要知道，通过这四种函数获取到的都是代理，通过代理去获取原始对象的值和设置原始对象的值
 */

class RefImpl {
    rawVal;
    isShallow;
    _value; // 只是声明一个属性，但是没有执行this.xx = xx
    __v_isRef = true; // 表示是一个ref属性
    //参数当中增加修饰符，表示这个属性被放到了实例当中，即声明了对应同名属性并且放到了this.同名属性 = 同名属性赋值
    constructor(rawVal, isShallow) {
        this.rawVal = rawVal;
        this.isShallow = isShallow;
        this._value = isShallow ? rawVal : convert(rawVal);
    }
    get value() {
        // 取值就是使用xx.value，实际上会代理到_value
        collectDependency(this, 'value');
        return this._value;
    }
    set value(newVal) {
        if (hasChanged(this.rawVal, newVal)) {
            // 判断老值相对于新值是否有变化
            this.rawVal = newVal; // 有变化的话，老的值变成新的值
            this._value = this.isShallow ? newVal : convert(newVal);
            emit(1 /* EDIT */, this, 'value', newVal);
        }
    }
}
class ObjectRefImpl {
    target;
    key;
    __v_isRef = true;
    constructor(target, key) {
        this.target = target;
        this.key = key;
    }
    get value() {
        return this.target[this.key];
    }
    set value(newVal) {
        this.target[this.key] = newVal;
    }
}
function convert(value) {
    return isObject(value) ? reactive(value) : value;
}
function createRef(value, isShallow = false) {
    return new RefImpl(value, isShallow);
}
/**
 * ref和reactive的区别：reactive内部采用的是proxy，而ref内部使用的是defineProperty
 */
function ref(value) {
    // 将普通类型变成一个对象。当然也可以value是对象，但是对象一般用reactive
    return createRef(value);
}
function shallowRef(value) {
    return createRef(value, true);
}
/**
 * toRef：可以将一个对象的属性，变成ref
 */
function toRef(target, key) {
    return new ObjectRefImpl(target, key);
}
function toRefs(object) {
    const result = isArray(object) ? new Array(object.length) : {};
    for (let key in object) {
        result[key] = toRef(object, key);
    }
    return result;
}

exports.effect = effect;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.shallowRef = shallowRef;
exports.toRef = toRef;
exports.toRefs = toRefs;
//# sourceMappingURL=reactivity.cjs.js.map
