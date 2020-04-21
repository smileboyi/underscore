//     Underscore.js 1.10.2
//     https://underscorejs.org
//     (c) 2009-2020 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

// Baseline setup
// --------------

// Establish the root object, `window` (`self`) in the browser, `global`
// on the server, or `this` in some virtual machines. We use `self`
// instead of `window` for `WebWorker` support.
// 屏蔽顶级全局变量的环境差异
var root = typeof self == 'object' && self.self === self && self ||
          typeof global == 'object' && global.global === global && global ||
          Function('return this')() ||
          {};

// Save bytes in the minified (but not gzipped) version:
var ArrayProto = Array.prototype, ObjProto = Object.prototype;
var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

// Create quick reference variables for speed access to core prototypes.
// 别名
var push = ArrayProto.push,
    slice = ArrayProto.slice,
    toString = ObjProto.toString,
    hasOwnProperty = ObjProto.hasOwnProperty;

// All **ECMAScript 5** native function implementations that we hope to use
// are declared here.
var nativeIsArray = Array.isArray,
    nativeKeys = Object.keys,
    nativeCreate = Object.create;

// Create references to these builtin functions because we override them.
var _isNaN = root.isNaN,
    _isFinite = root.isFinite;

// Naked function reference for surrogate-prototype-swapping.
// 纯净版构造器
var Ctor = function(){};

// The Underscore object. All exported functions below are added to it in the
// modules/index-all.js using the mixin function.
export default function _(obj) {
  // 如果obj是_的实例，返回实例
  if (obj instanceof _) return obj;
  // 没有new调用时，this指向root（root._(obj)），内部校正为new调用，返回实例
  if (!(this instanceof _)) return new _(obj);
  // 第一次new _(obj)时，保存一份obj
  this._wrapped = obj;
}

// Current version.
export var VERSION = _.VERSION = '1.10.2';

// Internal function that returns an efficient (for current engines) version
// of the passed-in callback, to be repeatedly applied in other Underscore
// functions.
/**
 * 返回一个有context上下文，和argCount个参数的func
 * @param func -- 执行函数
 * @param context -- 上下文
 * @param argCount -- 参数个数
 */
function optimizeCb(func, context, argCount) {
  // 如果上下文不存在直接返回函数，否则返回新函数
  if (context === void 0) return func;
  switch (argCount == null ? 3 : argCount) {
    case 1: return function(value) {
      return func.call(context, value);
    };
    // The 2-argument case is omitted because we’re not using it.
    // map，forEach
    case 3: return function(value, index, collection) {
      return func.call(context, value, index, collection);
    };
    // reduce
    case 4: return function(accumulator, value, index, collection) {
      return func.call(context, accumulator, value, index, collection);
    };
  }
  // 更多参数时
  return function() {
    // apply比call慢，少的参数使用call调用
    return func.apply(context, arguments);
  };
}

// An internal function to generate callbacks that can be applied to each
// element in a collection, returning the desired result — either `identity`,
// an arbitrary callback, a property matcher, or a property accessor.
// 只要value类型不同，就返回不同的函数
function baseIteratee(value, context, argCount) {
  if (value == null) return identity;
  // 方法回调器
  if (isFunction(value)) return optimizeCb(value, context, argCount);
  // 属性匹配器
  if (isObject(value) && !isArray(value)) return matcher(value);
  // 属性访问器
  return property(value);
}

// External wrapper for our callback generator. Users may customize
// `_.iteratee` if they want additional predicate/iteratee shorthand styles.
// This abstraction hides the internal-only argCount argument.
_.iteratee = iteratee;
export function iteratee(value, context) {
  return baseIteratee(value, context, Infinity);
}

// The function we actually call internally. It invokes _.iteratee if
// overridden, otherwise baseIteratee.
function cb(value, context, argCount) {
  if (_.iteratee !== iteratee) return _.iteratee(value, context);
  return baseIteratee(value, context, argCount);
}

// Some functions take a variable number of arguments, or a few expected
// arguments at the beginning and then a variable number of values to operate
// on. This helper accumulates all remaining arguments past the function’s
// argument length (or an explicit `startIndex`), into an array that becomes
// the last argument. Similar to ES6’s "rest parameter".
/**
 * 接收一个可变参数的函数，返回一个固定参数的函数
 * func： 可变参数的函数
 * startIndex： 指定func参数位置从哪里开始可变，默认最后一个参数是可变参数
 */
export function restArguments(func, startIndex) {
  // func arguments：需要的参数
  // func.length：func arguments.length
  startIndex = startIndex == null ? func.length - 1 : +startIndex;
  return function() {
    // arguments：实际接收到的参数
    var length = Math.max(arguments.length - startIndex, 0),
        rest = Array(length),
        index = 0;
    for (; index < length; index++) {
      // 从startIndex起，收集func可变参数
      rest[index] = arguments[index + startIndex];
    }
    switch (startIndex) {
      // 接收的参数数量不多于需要的参数量
      case 0: return func.call(this, rest);
      // 接收的参数数量多于需要的参数量，多余的变量存入rest作为最后一个变量
      case 1: return func.call(this, arguments[0], rest);
      case 2: return func.call(this, arguments[0], arguments[1], rest);
    }
    var args = Array(startIndex + 1);
    for (index = 0; index < startIndex; index++) {
      // 从0起到startIndex-1，收集func固定参数
      args[index] = arguments[index];
    }
    // 这里的args和上面的func.call中的参数是一致的
    args[startIndex] = rest;
    // 如果startIndex >= 3，使用apply执行
    return func.apply(this, args);
  };
}

// An internal function for creating a new object that inherits from another.
// 返回一个继承prototype的对象
function baseCreate(prototype) {
  if (!isObject(prototype)) return {};
  if (nativeCreate) return nativeCreate(prototype);
  // 使用纯净版构造器+原型组合模式的继承
  Ctor.prototype = prototype;
  var result = new Ctor;
  // 重新使Ctor纯净
  Ctor.prototype = null;
  return result;
}

// 根据key获取val
function shallowProperty(key) {
  return function(obj) {
    return obj == null ? void 0 : obj[key];
  };
}

// 是否有某个属性
function _has(obj, path) {
  return obj != null && hasOwnProperty.call(obj, path);
}

// 这里的path是属性链数组，根据属性链返回它的val
function deepGet(obj, path) {
  var length = path.length;
  for (var i = 0; i < length; i++) {
    if (obj == null) return void 0;
    obj = obj[path[i]];
  }
  return length ? obj : void 0;
}

// Helper for collection methods to determine whether a collection
// should be iterated as an array or as an object.
// Related: https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
// Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
var getLength = shallowProperty('length');
// 只要是可以遍历的集合，都是类数组
function isArrayLike(collection) {
  var length = getLength(collection);
  return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
}

// Collection Functions
// --------------------

// The cornerstone, an `each` implementation, aka `forEach`.
// Handles raw objects in addition to array-likes. Treats all
// sparse array-likes as if they were dense.
// 使用iteratee（callback）遍历obj，返回结果对象
export function each(obj, iteratee, context) {
  // map、forEach
  iteratee = optimizeCb(iteratee, context);
  var i, length;
  if (isArrayLike(obj)) {
    for (i = 0, length = obj.length; i < length; i++) {
      iteratee(obj[i], i, obj);
    }
  } else {
    var _keys = keys(obj);
    for (i = 0, length = _keys.length; i < length; i++) {
      iteratee(obj[_keys[i]], _keys[i], obj);
    }
  }
  // 这里很明显是返回了改变了的obj，each就不是纯函数
  return obj;
}
export { each as forEach };

// Return the results of applying the iteratee to each element.
// 使用iteratee（callback）遍历obj，返回结果数组，如果iteratee不会改变obj，就是纯函数
export function map(obj, iteratee, context) {
  // map、forEach
  iteratee = cb(iteratee, context);
  var _keys = !isArrayLike(obj) && keys(obj),
      length = (_keys || obj).length,
      results = Array(length);
  for (var index = 0; index < length; index++) {
    var currentKey = _keys ? _keys[index] : index;
    results[index] = iteratee(obj[currentKey], currentKey, obj);
  }
  return results;
}
export { map as collect };

// Create a reducing function iterating left or right.
//dir为累加幅度。dir为正整数，生成一个left累加器，dir为负整数，生成一个right累加器
function createReduce(dir) {
  // Wrap code that reassigns argument variables in a separate function than
  // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
  var reducer = function(obj, iteratee, memo, initial) {
    var _keys = !isArrayLike(obj) && keys(obj),
        length = (_keys || obj).length,
        // 从前面开始还是从末尾开始
        index = dir > 0 ? 0 : length - 1;
    if (!initial) {
      // 先跑一次计算，进入初始值
      // 为false时，这里没有使用到参数memo，而是内部生成的memo
      memo = obj[_keys ? _keys[index] : index];
      index += dir;
    }
    for (; index >= 0 && index < length; index += dir) {
      var currentKey = _keys ? _keys[index] : index;
      // 不停地改变memo
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  return function(obj, iteratee, memo, context) {
    // 如果参数个数为2，没有memo，内部就会初始化一个memo
    var initial = arguments.length >= 3;
    return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
  };
}

// **Reduce** builds up a single result from a list of values, aka `inject`,
// or `foldl`.
export var reduce = createReduce(1);
export { reduce as foldl, reduce as inject };

// The right-associative version of reduce, also known as `foldr`.
export var reduceRight = createReduce(-1);
export { reduceRight as foldr };

// Return the first value which passes a truth test.
// 整合了数组和对象，查找某个值
export function find(obj, predicate, context) {
  var keyFinder = isArrayLike(obj) ? findIndex : findKey;
  var key = keyFinder(obj, predicate, context);
  if (key !== void 0 && key !== -1) return obj[key];
}
export { find as detect };

// Return all the elements that pass a truth test.
// 过滤对象，返回数组
export function filter(obj, predicate, context) {
  var results = [];
  predicate = cb(predicate, context);
  each(obj, function(value, index, list) {
    if (predicate(value, index, list)) results.push(value);
  });
  return results;
}
export { filter as select };

// Return all the elements for which a truth test fails.
// filter的否定版，返回不符合条件的数组
export function reject(obj, predicate, context) {
  return filter(obj, negate(cb(predicate)), context);
}

// Determine whether all of the elements match a truth test.
// 只要obj有一项item不符合条件就返回false，否则true(需要每个都符合才行)
export function every(obj, predicate, context) {
  predicate = cb(predicate, context);
  var _keys = !isArrayLike(obj) && keys(obj),
      length = (_keys || obj).length;
  for (var index = 0; index < length; index++) {
    var currentKey = _keys ? _keys[index] : index;
    if (!predicate(obj[currentKey], currentKey, obj)) return false;
  }
  return true;
}
export { every as all };

// Determine if at least one element in the object matches a truth test.
// 只要obj有一项item符合条件就返回true，否则false(只要有一个符合就行)
export function some(obj, predicate, context) {
  predicate = cb(predicate, context);
  var _keys = !isArrayLike(obj) && keys(obj),
      length = (_keys || obj).length;
  for (var index = 0; index < length; index++) {
    var currentKey = _keys ? _keys[index] : index;
    if (predicate(obj[currentKey], currentKey, obj)) return true;
  }
  return false;
}
export { some as any };

// Determine if the array or object contains a given item (using `===`).
export function contains(obj, item, fromIndex, guard) {
  if (!isArrayLike(obj)) obj = values(obj);
  if (typeof fromIndex != 'number' || guard) fromIndex = 0;
  return indexOf(obj, item, fromIndex) >= 0;
}
export { contains as includes, contains as include };

// Invoke a method (with arguments) on every item in a collection.
/**
 * invoke： 反射执行obj，args是执行时的参数,
 * path: 属性路径数组（obj某个方法的路径）或者提供的函数
 * 
 * const obj = {
 *   item1: {
 *      a: 1,
 *      b: '2',
 *      c: ()=>console.log(this.a+item.b)
 *    }
 * }
 */
export var invoke = restArguments(function(obj, path, args) {
  var contextPath, func;
  if (isFunction(path)) {
    func = path;
  } else if (isArray(path)) {
    // context path数组
    contextPath = path.slice(0, -1);
    // 方法的key
    path = path[path.length - 1];
  }
  // 只会遍历1级子属性
  return map(obj, function(context) {
    var method = func;
    if (!method) {
      if (contextPath && contextPath.length) {
        // 走完contextPath，更新context
        context = deepGet(context, contextPath);
      }
      if (context == null) return void 0;
      // 获取context中的方法
      method = context[path];
    }
    // 将获得的方法执行，没有获得返回null
    return method == null ? method : method.apply(context, args);
  });
});

// Convenience version of a common use case of `map`: fetching a property.
// item[key][]，哪些item含有key的val
export function pluck(obj, key) {
  return map(obj, property(key));
}

// Convenience version of a common use case of `filter`: selecting only objects
// containing specific `key:value` pairs.
// item[]，哪些匹配attrs
export function where(obj, attrs) {
  return filter(obj, matcher(attrs));
}

// Convenience version of a common use case of `find`: getting the first object
// containing specific `key:value` pairs.
// item，那个匹配attrs
export function findWhere(obj, attrs) {
  return find(obj, matcher(attrs));
}

// Return the maximum element (or element-based computation).
// 代替Math.max,只要obj是可遍历的，且obj是浅层的，item是可比较的
export function max(obj, iteratee, context) {
  var result = -Infinity,   // 最终值
      lastComputed = -Infinity,  // 中间值，上一次的结算值
      value,computed; // 中间值，本次的计算值
  if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
    obj = isArrayLike(obj) ? obj : values(obj);
    for (var i = 0, length = obj.length; i < length; i++) {
      value = obj[i];
      if (value != null && value > result) {
        result = value;
      }
    }
  } else {
    // 如果迭代器是函数类型，注入context
    iteratee = cb(iteratee, context);
    each(obj, function(v, index, list) {
      computed = iteratee(v, index, list);
      if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
        result = v;
        lastComputed = computed;
      }
    });
  }
  return result;
}

// Return the minimum element (or element-based computation).
// 代替Math.min,只要obj是可遍历的，且obj是浅层的，item是可比较的
export function min(obj, iteratee, context) {
  var result = Infinity, lastComputed = Infinity,
      value, computed;
  if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
    obj = isArrayLike(obj) ? obj : values(obj);
    for (var i = 0, length = obj.length; i < length; i++) {
      value = obj[i];
      if (value != null && value < result) {
        result = value;
      }
    }
  } else {
    iteratee = cb(iteratee, context);
    each(obj, function(v, index, list) {
      computed = iteratee(v, index, list);
      if (computed < lastComputed || computed === Infinity && result === Infinity) {
        result = v;
        lastComputed = computed;
      }
    });
  }
  return result;
}

// Shuffle a collection.
// 所有位置上打乱obj
export function shuffle(obj) {
  return sample(obj, Infinity);
}

// Sample **n** random values from a collection using the modern version of the
// [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
// If **n** is not specified, returns a single random element.
// The internal `guard` argument allows it to work with `map`.
/**
 * 0-n间打乱obj，然后返回这部分，
 * 如果没有给n或者guard为true，就随机位置返回一个item
 * 
 */
export function sample(obj, n, guard) {
  if (n == null || guard) {
    if (!isArrayLike(obj)) obj = values(obj);
    return obj[random(obj.length - 1)];
  }
  var sample = isArrayLike(obj) ? clone(obj) : values(obj);
  var length = getLength(sample);
  n = Math.max(Math.min(n, length), 0);
  var last = length - 1;
  // 0-n之间打乱对象或者数组
  for (var index = 0; index < n; index++) {
    // 产生一个任意位置，前面已经被打乱的item，不能使用它的位置
    var rand = random(index, last); 
    var temp = sample[index];
    sample[index] = sample[rand];
    sample[rand] = temp;
  }
  // 返回打乱的部分
  return sample.slice(0, n);
}

// Sort the object's values by a criterion produced by an iteratee.
export function sortBy(obj, iteratee, context) {
  var index = 0;
  // iteratee 排序基准方法
  iteratee = cb(iteratee, context);
  // pluck(,,'value')，返回的是[value1,value2,value3,...]
  return pluck(map(obj, function(value, key, list) {
    // index和criteria是临时用于排序的变量
    return {
      value: value,
      index: index++,
      criteria: iteratee(value, key, list)  // 基于value，返回基准值
    };
  }).sort(function(left, right) {
    var a = left.criteria;
    var b = right.criteria;
    // 按基准比较排序
    if (a !== b) {
      if (a > b || a === void 0) return 1;
      if (a < b || b === void 0) return -1;
    }
    // 如果2个基准值一样按index排序
    return left.index - right.index;
  }), 'value');
}

// An internal function used for aggregate "group by" operations.
/**
 * 返回一个接受分组对象、特征函数、上下文的函数
 * @param {func} behavior  分组行为函数
 * @param {boolean} partition  分组形式，数组还是数组对象
 */
function group(behavior, partition) {
  /**
   * 分组的动作（behavior）是一样的，分组的依据（iteratee）是不一样的
   * @param {object} obj  要分组的对象
   * @param {boolean} iteratee  分组特征函数，发挥分组位置key
   * @param {object} context  上下文
   */
  return function(obj, iteratee, context) {
    var result = partition ? [[], []] : {};
    iteratee = cb(iteratee, context);
    each(obj, function(value, index) {
      var key = iteratee(value, index, obj);
      // 分组行为函数按照分组特征将value存入result中
      behavior(result, value, key);
    });
    return result;
  };
}

// Groups the object's values by a criterion. Pass either a string attribute
// to group by, or a function that returns the criterion.
// { key: [value] }
export var groupBy = group(function(result, value, key) {
  if (_has(result, key)) result[key].push(value); else result[key] = [value];
});

// Indexes the object's values by a criterion, similar to `groupBy`, but for
// when you know that your index values will be unique.
// { key: value }
export var indexBy = group(function(result, value, key) {
  result[key] = value;
});

// Counts instances of an object that group by a certain criterion. Pass
// either a string attribute to count by, or a function that returns the
// criterion.
// 不存储分组后的value，只存储分组后的数量比例
export var countBy = group(function(result, value, key) {
  if (_has(result, key)) result[key]++; else result[key] = 1;
});

// 这段正则是对任意文字根据utf-16进行处理，来创建数组
var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
// Safely create a real, live array from anything iterable.
export function toArray(obj) {
  if (!obj) return [];
  if (isArray(obj)) return slice.call(obj);
  if (isString(obj)) {
    // Keep surrogate pair characters together
    // 如果是字符串转数组，根据reStrSymbol进行分割
    return obj.match(reStrSymbol);
  }
  if (isArrayLike(obj)) return map(obj, identity);
  return values(obj);
}

// Return the number of elements in an object.
// return length
export function size(obj) {
  if (obj == null) return 0;
  return isArrayLike(obj) ? obj.length : keys(obj).length;
}

// Split a collection into two arrays: one whose elements all satisfy the given
// predicate, and one whose elements all do not satisfy the predicate.
// [[value1, value3,...], [value2,...]]
export var partition = group(function(result, value, pass) {
  result[pass ? 0 : 1].push(value);
}, true);

// Array Functions
// ---------------

// Get the first element of an array. Passing **n** will return the first N
// values in the array. The **guard** check allows it to work with `map`.
// 获取前n个元素，没传n或guard为true，只获取一个
export function first(array, n, guard) {
  if (array == null || array.length < 1) return n == null ? void 0 : [];
  if (n == null || guard) return array[0];
  return initial(array, array.length - n);
}
export { first as head, first as take };

// Returns everything but the last entry of the array. Especially useful on
// the arguments object. Passing **n** will return all the values in
// the array, excluding the last N.
// 数组切片，但只能从0开始切，到n,返回一个数组
export function initial(array, n, guard) {
  return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
}

// Get the last element of an array. Passing **n** will return the last N
// values in the array.
// 获取后n个元素，没传n或guard为true，只获取一个
export function last(array, n, guard) {
  if (array == null || array.length < 1) return n == null ? void 0 : [];
  if (n == null || guard) return array[array.length - 1];
  return rest(array, Math.max(0, array.length - n));
}

// Returns everything but the first entry of the array. Especially useful on
// the arguments object. Passing an **n** will return the rest N values in the
// array.
// 数组切片，从n开始切，到最后,返回一个数组
export function rest(array, n, guard) {
  return slice.call(array, n == null || guard ? 1 : n);
}
export { rest as tail, rest as drop };

// Trim out all falsy values from an array.
export function compact(array) {
  return filter(array, Boolean);
}

// Internal implementation of a recursive `flatten` function.
/**
 * 数组展开
 * @param {*} input 多维数组
 * @param {*} shallow 是否展开多层
 * @param {*} strict 非(类)数组时，要不要添加
 * @param {*} output 一维数组
 */
function _flatten(input, shallow, strict, output) {
  output = output || [];
  var idx = output.length;
  for (var i = 0, length = getLength(input); i < length; i++) {
    var value = input[i];
    if (isArrayLike(value) && (isArray(value) || isArguments(value))) {
      // Flatten current level of array or arguments object.
      if (shallow) {
        // 只展开第二层
        var j = 0, len = value.length;
        while (j < len) output[idx++] = value[j++];
      } else {
        // 第3层第4层以下都要展开
        _flatten(value, shallow, strict, output);
        idx = output.length;
      }
    } else if (!strict) {
      // 如果遍历到value不是数组了，是否将value添加到output中
      output[idx++] = value;
    }
  }
  return output;
}

// Flatten out an array, either recursively (by default), or just one level.
// 只展开一层
export function flatten(array, shallow) {
  return _flatten(array, shallow, false);
}

// Return a version of the array that does not contain the specified value(s).
// 删除数组元素，without([1,2,3,4],1,4)
// 实参有多个，但形参只有2个，通过restArguments会将从第二个参数开始把参数移入otherArrays中
export var without = restArguments(function(array, otherArrays) {
  return difference(array, otherArrays);
});

// Produce a duplicate-free version of the array. If the array has already
// been sorted, you have the option of using a faster algorithm.
// The faster algorithm will not work with an iteratee if the iteratee
// is not a one-to-one function, so providing an iteratee will disable
// the faster algorithm.
// 数组去重，如果有序了，会加快速度。如果有iteratee去重方式，则使用
export function uniq(array, isSorted, iteratee, context) {
  // 如果不能转布尔值，就将它视为false
  if (!isBoolean(isSorted)) {
    context = iteratee;
    iteratee = isSorted;
    isSorted = false;
  }
  if (iteratee != null) iteratee = cb(iteratee, context);
  var result = []; // 存放结果值
  var seen = []; // 存放计算值（特征值），去重不一定要2个value是否完全相同，如果2个value都有一样的特征值，可以视为相同
  for (var i = 0, length = getLength(array); i < length; i++) {
    var value = array[i],
        // 没有iteratee，则以当前value为计算值
        // 每个value产生它的特征值
        computed = iteratee ? iteratee(value, i, array) : value;
    if (isSorted && !iteratee) {
      // 没有iteratee但是是有序的，这里value === computed，此时seen是一个单值(加快速度)
      // 如果第一个位置，直接填充
      if (!i || seen !== computed) result.push(value);
      seen = computed;
    } else if (iteratee) {
      // 有iteratee(有computed)，不管有不有序时，此时seen是一个数组
      if (!contains(seen, computed)) {
        seen.push(computed);
        result.push(value);
      }
    } else if (!contains(result, value)) {
      // !(isSorted || iteratee) && !contains(result, value)
      // !isSorted && !iteratee && !contains(result, value)
      // 既不是有序，也没有iteratee（没有computed）时，当result没有包含value时
      // 这里按value去重，前2个是按computed去重
      result.push(value);
    }
  }
  return result;
}
export { uniq as unique };

// Produce an array that contains the union: each distinct element from all of
// the passed-in arrays.
// 求各个数组的合集，数组展开一层再去重
export var union = restArguments(function(arrays) {
  return uniq(_flatten(arrays, true, true));
});

// Produce an array that contains every item shared between all the
// passed-in arrays.
// 求各个数组的交集
// ([a,b,c,...],x,y,z,...)
export function intersection(array) {
  var result = [];
  var argsLength = arguments.length;
  for (var i = 0, length = getLength(array); i < length; i++) {
    var item = array[i];
    // 如果a,b相同，且a在result中，b略过
    if (contains(result, item)) continue;
    var j;
    for (j = 1; j < argsLength; j++) {
    // !contains(x, a)
      if (!contains(arguments[j], item)) break;
    }
    // 如果x,y,z...都不包含a时，a存入result中
    if (j === argsLength) result.push(item);
  }
  return result;
}

// Take the difference between one array and a number of other arrays.
// Only the elements present in just the first array will remain.
// 求第一个数组相对于第二个数组的差集
export var difference = restArguments(function(array, rest) {
  rest = _flatten(rest, true, true);
  // 返回第一个数组有的而第二个数组没有的元素集合
  return filter(array, function(value){
    return !contains(rest, value);
  });
});

// Complement of zip. Unzip accepts an array of arrays and groups
// each array's elements on shared indices.
// 拆分：[['Adam', 85], ['Lisa', 92], ['Bart', 59]] => [['Adam', 'Lisa', 'Bart'], [85, 92, 59]]
export function unzip(array) {
  // 元素最多的item的长度
  var length = array && max(array, getLength).length || 0;
  var result = Array(length);

  for (var index = 0; index < length; index++) {
    // result[index] = [item0[index],item1[index],...] = item[index][]
    result[index] = pluck(array, index);
  }
  return result;
}

// Zip together multiple lists into a single array -- elements that share
// an index go together.
// 合体：[['Adam', 'Lisa', 'Bart'], [85, 92, 59]] => [['Adam', 85], ['Lisa', 92], ['Bart', 59]]
export var zip = restArguments(unzip);

// Converts lists into objects. Pass either a single array of `[key, value]`
// pairs, or two parallel arrays of the same length -- one of keys, and one of
// the corresponding values. Passing by pairs is the reverse of pairs.
// 数组转对象，数组values用于值填充
export function object(list, values) {
  var result = {};
  for (var i = 0, length = getLength(list); i < length; i++) {
    if (values) {
      // 此时list就是[k1,k2,k3,...]，values就是[v1,v2,v3,...]
      result[list[i]] = values[i];
    } else {
      // 此时list就是[[k1,v1],[k2,v2],...]
      result[list[i][0]] = list[i][1];
    }
  }
  return result;
}

// Generator function to create the findIndex and findLastIndex functions.
// 数组通用查找柯里函数
function createPredicateIndexFinder(dir) {
  return function(array, predicate, context) {
    predicate = cb(predicate, context);
    var length = getLength(array);
    var index = dir > 0 ? 0 : length - 1;
    for (; index >= 0 && index < length; index += dir) {
      // predicate相当于[].findIndex
      if (predicate(array[index], index, array)) return index;
    }
    return -1;
  };
}


// Returns the first index on an array-like that passes a predicate test.
// 数组正向查找
export var findIndex = createPredicateIndexFinder(1);
// 数组反向查找
export var findLastIndex = createPredicateIndexFinder(-1);

// Use a comparator function to figure out the smallest index at which
// an object should be inserted so as to maintain order. Uses binary search.
// 如果obj要插入有序array中，返回要插入的位置
export function sortedIndex(array, obj, iteratee, context) {
  iteratee = cb(iteratee, context, 1);
  // 使用iteratee获取obj的value
  var value = iteratee(obj);
  var low = 0, high = getLength(array);
  // 二分查找
  while (low < high) {
    var mid = Math.floor((low + high) / 2);
    if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
  }
  return low;
}

// Generator function to create the indexOf and lastIndexOf functions.
/**
 * 
 * @param {number} dir 循环时的步长step
 * @param {function} predicateFind 条件查找函数
 * @param {function} sortedIndex  有序查找函数
 */
function createIndexFinder(dir, predicateFind, sortedIndex) {
  /**
   * 返回更新后的idx
   * @param {array} array 数组
   * @param {any} item 被查找的元素
   * @param {number} idx  查找位置，动态的
   */
  return function(array, item, idx) {
    var i = 0, length = getLength(array);
    if (typeof idx == 'number') {
      if (dir > 0) {
        // 更新起始位置，从|idx|开始或者倒数|idx|开始
        i = idx >= 0 ? idx : Math.max(idx + length, i);
      } else {
        // 更新查找返回
        length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
      }
    } else if (sortedIndex && idx && length) {
      // 如果有排序函数，更新idx
      idx = sortedIndex(array, item);
      return array[idx] === item ? idx : -1;
    }
    // 如果item是NaN类型
    if (item !== item) {
      // 查找NaN的位置，findIndex提供了基本的按XX查找位置的功能
      idx = predicateFind(slice.call(array, i, length), isNaN);
      return idx >= 0 ? idx + i : -1;
    }
    // 向前或者向后查找，每次查找需要更新idx
    for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
      if (array[idx] === item) return idx;
    }
    return -1;
  };
}

// Return the position of the first occurrence of an item in an array,
// or -1 if the item is not included in the array.
// If the array is large and already in sort order, pass `true`
// for **isSorted** to use binary search.
export var indexOf = createIndexFinder(1, findIndex, sortedIndex);
export var lastIndexOf = createIndexFinder(-1, findLastIndex);

// Generate an integer Array containing an arithmetic progression. A port of
// the native Python `range()` function. See
// [the Python documentation](https://docs.python.org/library/functions.html#range).
// 带有step分片的函数
export function range(start, stop, step) {
  if (stop == null) {
    stop = start || 0;
    start = 0;
  }
  if (!step) {
    step = stop < start ? -1 : 1;
  }

  var length = Math.max(Math.ceil((stop - start) / step), 0);
  var range = Array(length);

  for (var idx = 0; idx < length; idx++, start += step) {
    range[idx] = start;
  }

  return range;
}

// Chunk a single array into multiple arrays, each containing `count` or fewer
// items.
// 将一维数组按count长度分批成二维数组，最后一个元素可能没有达到count长度
export function chunk(array, count) {
  if (count == null || count < 1) return [];
  var result = [];
  var i = 0, length = array.length;
  while (i < length) {
    result.push(slice.call(array, i, i += count));
  }
  return result;
}

// Function (ahem) Functions
// ------------------

// Determines whether to execute a function as a constructor
// or a normal function with the provided arguments.
/**
 * sourceFunc：未绑定的函数，context上下文
 * boundFunc： 绑定了的函数，callingContext上下文
 */
function executeBound(sourceFunc, boundFunc, context, callingContext, args) {
  // callingContext和boundFunc的关系用来处理sourceFunc的调用方式
  // sourceFunc当做普通函数执行
  if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
  // 作为构造函数执行，使用apply的方式
  var self = baseCreate(sourceFunc.prototype);
  var result = sourceFunc.apply(self, args);
  // 返回值是一个实例，对象
  if (isObject(result)) return result;
  return self;
}

// Create a function bound to a given object (assigning `this`, and arguments,
// optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
// available.
/**
 * func： 要绑定的函数
 * bound： 绑定后的函数，
 * 要执行bound，如果当成构造函数使用，执行作用域是this，如果当成普通函数使用，作用域是context
 */
export var bind = restArguments(function(func, context, args) {
  if (!isFunction(func)) throw new TypeError('Bind must be called on a function');
  // 绑定过后的函数
  var bound = restArguments(function(callArgs) {
    return executeBound(func, bound, context, this, args.concat(callArgs));
  });
  return bound;
});

// Partially apply a function by creating a version that has had some of its
// arguments pre-filled, without changing its dynamic `this` context. _ acts
// as a placeholder by default, allowing any combination of arguments to be
// pre-filled. Set `partial.placeholder` for a custom placeholder argument.
// 和绑定context的作用一样，绑定一个部分固定+占位符参数
export var partial = restArguments(function(func, boundArgs) {
  var placeholder = partial.placeholder;

  // 接收的arguments用来替换占位符
  var bound = function() {
    var position = 0, length = boundArgs.length;
    var args = Array(length);
    for (var i = 0; i < length; i++) {
      // 用args替换boundArgs，boundArgs可能含有placeholder，需要替换
      args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
    }
    while (position < arguments.length) args.push(arguments[position++]);
    return executeBound(func, bound, this, this, args);
  };
  return bound;
});

// partial的占位符是_
partial.placeholder = _;

// Bind a number of an object's methods to that object. Remaining arguments
// are the method names to be bound. Useful for ensuring that all callbacks
// defined on an object belong to it.
// 给一个对象绑定多个方法
export var bindAll = restArguments(function(obj, _keys) {
  // 展开
  _keys = _flatten(_keys, false, false);
  var index = _keys.length;
  if (index < 1) throw new Error('bindAll must be passed function names');
  while (index--) {
    var key = _keys[index];
    obj[key] = bind(obj[key], obj);
  }
});

// Memoize an expensive function by storing its results.
// 缓存函数，可以提供hasher
export function memoize(func, hasher) {
  var memoize = function(key) {
    var cache = memoize.cache;
    // 作为缓存对象的key
    var address = '' + (hasher ? hasher.apply(this, arguments) : key);
    if (!_has(cache, address)) cache[address] = func.apply(this, arguments);
    return cache[address];
  };
  memoize.cache = {};
  return memoize;
}

// Delays a function for the given number of milliseconds, and then calls
// it with the arguments supplied.
export var delay = restArguments(function(func, wait, args) {
  return setTimeout(function() {
    return func.apply(null, args);
  }, wait);
});

// Defers a function, scheduling it to run after the current call stack has
// cleared.
// boundArgs：_,1，delay的默认参数就是boundArgs
export var defer = partial(delay, _, 1);

// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time. Normally, the throttled function will run
// as much as it can, without ever going more than once per `wait` duration;
// but if you'd like to disable the execution on the leading edge, pass
// `{leading: false}`. To disable execution on the trailing edge, ditto.
export function throttle(func, wait, options) {
  // 公有
  var timeout, context, args, result;
  var previous = 0;
  if (!options) options = {};

  // 定时器一到，就会执行later
  var later = function() {
    previous = options.leading === false ? 0 : now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  // 闭包
  var throttled = function() {
    var _now = now();
    // 将现在的是时间点设为上一次的时间点
    if (!previous && options.leading === false) previous = _now;
    // 剩余等待时间
    // _now - previous = wait - remaining
    var remaining = wait - (_now - previous);
    context = this;
    args = arguments;
    // remaining > wait是避免用户改变系统时间
    // remaining > wait => _now < previous，上一次的时间大于现在的时间，显然不合理
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = _now;
      // 最终计算
      result = func.apply(context, args);
      // 清空数据
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      // 在间隔时间内又一次触发，重新计时，上一次的setTimeout还是会执行的
      timeout = setTimeout(later, remaining);
    }
    return result;
  };


  // 取消，清空数据
  throttled.cancel = function() {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
export function debounce(func, wait, immediate) {
  var timeout, result;

  var later = function(context, args) {
    timeout = null;
    if (args) result = func.apply(context, args);
  };

  var debounced = restArguments(function(args) {
    if (timeout) clearTimeout(timeout);
    if (immediate) {
      var callNow = !timeout;
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(this, args);
    } else {
      //如果本次调用时，上一个定时器没有执行完，将再生成一个定时器
      timeout = delay(later, wait, this, args);
    }

    return result;
  });

  debounced.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
}

// Returns the first function passed as an argument to the second,
// allowing you to adjust arguments, run code before and after, and
// conditionally execute the original function.
// wrapper包裹func
export function wrap(func, wrapper) {
  // func作为wrapper的参数
  return partial(wrapper, func);
}

// Returns a negated version of the passed-in predicate.
// 注意里面的!
export function negate(predicate) {
  return function() {
    return !predicate.apply(this, arguments);
  };
}

// Returns a function that is the composition of a list of functions, each
// consuming the return value of the function that follows.
// 将多个函数整合为一个函数执行
export function compose() {
  var args = arguments;
  var start = args.length - 1;
  return function() {
    var i = start;
    // 从右往左执行，结果作为下一个函数的参数
    var result = args[start].apply(this, arguments);
    while (i--) result = args[i].call(this, result);
    return result;
  };
}

// Returns a function that will only be executed on and after the Nth call.
export function after(times, func) {
  return function() {
    if (--times < 1) {
      return func.apply(this, arguments);
    }
  };
}

// Returns a function that will only be executed up to (but not including) the Nth call.
export function before(times, func) {
  var memo;
  // 闭包，可多次执行beforeFn产生结果memo，直到times <= 1，得到最终结果
  return function beforeFn() {
    if (--times > 0) {
      memo = func.apply(this, arguments);
    }
    if (times <= 1) func = null;
    return memo;
  };
}

// Returns a function that will be executed at most one time, no matter how
// often you call it. Useful for lazy initialization.
// 只能执行多少次，说明有闭包存在，里面控制了func的执行
export var once = partial(before, 2);

// Object Functions
// ----------------

// Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
  'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
/**
 * 更新obj的keys
 * 低版本ie，使用for..in..迭代（会自动获取所有keys）遍历不完整，需要手动获取所有的keys，手动遍历
 */
function collectNonEnumProps(obj, _keys) {
  var nonEnumIdx = nonEnumerableProps.length;
  var constructor = obj.constructor;
  var proto = isFunction(constructor) && constructor.prototype || ObjProto;

  // Constructor is a special case.
  var prop = 'constructor';
  if (_has(obj, prop) && !contains(_keys, prop)) _keys.push(prop);

  while (nonEnumIdx--) {
    prop = nonEnumerableProps[nonEnumIdx];
    // 更新可遍历的keys
    if (prop in obj && obj[prop] !== proto[prop] && !contains(_keys, prop)) {
      _keys.push(prop);
    }
  }
}
 
// Retrieve the names of an object's own properties.
// Delegates to **ECMAScript 5**'s native `Object.keys`.
// 自有的key
export function keys(obj) {
  if (!isObject(obj)) return [];
  if (nativeKeys) return nativeKeys(obj);
  var _keys = [];
  for (var key in obj) if (_has(obj, key)) _keys.push(key);
  // Ahem, IE < 9. 手动更新
  if (hasEnumBug) collectNonEnumProps(obj, _keys);
  return _keys;
}

// Retrieve all the property names of an object.
// 所有的key
export function allKeys(obj) {
  if (!isObject(obj)) return [];
  var _keys = [];
  for (var key in obj) _keys.push(key);
  // Ahem, IE < 9.
  if (hasEnumBug) collectNonEnumProps(obj, _keys);
  return _keys;
}

// Retrieve the values of an object's properties.
// 自有的key对应的val
export function values(obj) {
  var _keys = keys(obj);
  var length = _keys.length;
  var values = Array(length);
  for (var i = 0; i < length; i++) {
    values[i] = obj[_keys[i]];
  }
  return values;
}

// Returns the results of applying the iteratee to each element of the object.
// In contrast to map it returns an object.
// 改变obj中的每一个val，相当于数组的map
export function mapObject(obj, iteratee, context) {
  iteratee = cb(iteratee, context);
  var _keys = keys(obj),
      length = _keys.length,
      results = {};
  for (var index = 0; index < length; index++) {
    var currentKey = _keys[index];
    // 改变val
    results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
  }
  return results;
}

// Convert an object into a list of `[key, value]` pairs.
// The opposite of object.
// obj => [[key, value],...]
export function pairs(obj) {
  var _keys = keys(obj);
  var length = _keys.length;
  var pairs = Array(length);
  for (var i = 0; i < length; i++) {
    pairs[i] = [_keys[i], obj[_keys[i]]];
  }
  return pairs;
}

// Invert the keys and values of an object. The values must be serializable.
// {key:val} => {val:key}
export function invert(obj) {
  var result = {};
  var _keys = keys(obj);
  for (var i = 0, length = _keys.length; i < length; i++) {
    result[obj[_keys[i]]] = _keys[i];
  }
  return result;
}

// Return a sorted list of the function names available on the object.
// 整理出obj中哪些item的val可以执行的，把他们的key到一个数组中
export function functions(obj) {
  var names = [];
  for (var key in obj) {
    if (isFunction(obj[key])) names.push(key);
  }
  return names.sort();
}
export { functions as methods };

// An internal function for creating assigner functions.
/**
 * 返回一个函数，这个函数可接受多个对象，通过keysFunc取出满足条件的key，
 * 按key来合并成一个对象
 * @param keysFunc -- 返回需要的对象的keys
 * @param defaults -- 默认对象
 */
function createAssigner(keysFunc, defaults) {
  // 接收多个对象，然后合并为一个对象返回，第一个对象覆盖到其它对象
  return function(obj) {
    // arguments包含obj
    var length = arguments.length;
    // 如果自己提供了默认值，优先使用自己的
    if (defaults) obj = Object(obj);
    // 当函数参数只有一个obj时返回obj
    if (length < 2 || obj == null) return obj;
    for (var index = 1; index < length; index++) {
      var source = arguments[index],
          _keys = keysFunc(source),
          l = _keys.length;
      for (var i = 0; i < l; i++) {
        var key = _keys[i];
        // 将obj覆盖到source中，成为新obj
        if (!defaults || obj[key] === void 0) obj[key] = source[key];
      }
    }
    return obj;
  };
}

// Extend a given object with all the properties in passed-in object(s).
export var extend = createAssigner(allKeys);

// Assigns a given object with all the own properties in the passed-in object(s).
// (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
// assign
export var extendOwn = createAssigner(keys);
export { extendOwn as assign };

// Returns the first key on an object that passes a predicate test.
// 查找第一个符合条件的key
export function findKey(obj, predicate, context) {
  predicate = cb(predicate, context);
  var _keys = keys(obj), key;
  for (var i = 0, length = _keys.length; i < length; i++) {
    key = _keys[i];
    if (predicate(obj[key], key, obj)) return key;
  }
}

// Internal pick helper function to determine if `obj` has key `key`.
function keyInObj(value, key, obj) {
  return key in obj;
}

// Return a copy of the object only containing the whitelisted properties.
// 返回含有白名单_keys的obj的子集
export var pick = restArguments(function(obj, _keys) {
  var result = {}, iteratee = _keys[0];
  if (obj == null) return result;
  if (isFunction(iteratee)) {
    // _keys[0]是判断函数，_keys[1]是上下文
    // 判断key是否符合指定条件
    if (_keys.length > 1) iteratee = optimizeCb(iteratee, _keys[1]);
    _keys = allKeys(obj);
  } else {
    iteratee = keyInObj; // 判断key是否存在
    _keys = _flatten(_keys, false, false);
    obj = Object(obj);
  }
  for (var i = 0, length = _keys.length; i < length; i++) {
    var key = _keys[i];
    var value = obj[key];
    // 如果判断函数返回true才能使用白名单的值
    if (iteratee(value, key, obj)) result[key] = value;
  }
  return result;
});

// Return a copy of the object without the blacklisted properties.
// 返回不含有黑名单_keys的obj的子集
export var omit = restArguments(function(obj, _keys) {
  var iteratee = _keys[0], context;
  if (isFunction(iteratee)) {
    // 判断函数取反
    iteratee = negate(iteratee);
    if (_keys.length > 1) context = _keys[1];
  } else {
    _keys = map(_flatten(_keys, false, false), String);
    iteratee = function(value, key) {
      return !contains(_keys, key);
    };
  }
  return pick(obj, iteratee, context);
});

// Fill in a given object with default properties.
export var defaults = createAssigner(allKeys, true);

// Creates an object that inherits from the given prototype object.
// If additional properties are provided then they will be added to the
// created object.
export function create(prototype, props) {
  var result = baseCreate(prototype);
  // 对象result又扩展了props
  if (props) extendOwn(result, props);
  return result;
}

// Create a (shallow-cloned) duplicate of an object.
export function clone(obj) {
  if (!isObject(obj)) return obj;
  return isArray(obj) ? obj.slice() : extend({}, obj);
}

// Invokes interceptor with the obj, and then returns obj.
// The primary purpose of this method is to "tap into" a method chain, in
// order to perform operations on intermediate results within the chain.
// 操作obj时，先触发拦截器
export function tap(obj, interceptor) {
  interceptor(obj);
  return obj;
}

// Returns whether an object has a given set of `key:value` pairs.
// attrs是否为object的子集
export function isMatch(object, attrs) {
  var _keys = keys(attrs), length = _keys.length;
  if (object == null) return !length;
  var obj = Object(object);
  for (var i = 0; i < length; i++) {
    var key = _keys[i];
    if (attrs[key] !== obj[key] || !(key in obj)) return false;
  }
  return true;
}


// Internal recursive comparison function for `isEqual`.
function eq(a, b, aStack, bStack) {
  // Identical objects are equal. `0 === -0`, but they aren't identical.
  // See the [Harmony `egal` proposal](https://wiki.ecmascript.org/doku.php?id=harmony:egal).
  if (a === b) return a !== 0 || 1 / a === 1 / b;
  // `null` or `undefined` only equal to itself (strict comparison).
  if (a == null || b == null) return false;
  // `NaN`s are equivalent, but non-reflexive.
  if (a !== a) return b !== b;
  // Exhaust primitive checks
  var type = typeof a;
  if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
  // 前面ab都是普通类型比较，这里指定路径进行深度比较
  return deepEq(a, b, aStack, bStack);
}

// Internal recursive comparison function for `isEqual`.
function deepEq(a, b, aStack, bStack) {
  // Unwrap any wrapped objects.
  if (a instanceof _) a = a._wrapped;
  if (b instanceof _) b = b._wrapped;
  // Compare `[[Class]]` names.
  var className = toString.call(a);
  if (className !== toString.call(b)) return false;
  switch (className) {
    // Strings, numbers, regular expressions, dates, and booleans are compared by value.
    case '[object RegExp]':
    // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
    case '[object String]':
      // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
      // equivalent to `new String("5")`.
      return '' + a === '' + b;
    case '[object Number]':
      // `NaN`s are equivalent, but non-reflexive.
      // Object(NaN) is equivalent to NaN.
      if (+a !== +a) return +b !== +b;
      // An `egal` comparison is performed for other numeric values.
      return +a === 0 ? 1 / +a === 1 / b : +a === +b;
    case '[object Date]':
    case '[object Boolean]':
      // Coerce dates and booleans to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are not equivalent.
      return +a === +b;
    case '[object Symbol]':
      return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
  }

  var areArrays = className === '[object Array]';
  if (!areArrays) {
    if (typeof a != 'object' || typeof b != 'object') return false;

    // Objects with different constructors are not equivalent, but `Object`s or `Array`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(isFunction(aCtor) && aCtor instanceof aCtor &&
                             isFunction(bCtor) && bCtor instanceof bCtor)
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
  }
  // Assume equality for cyclic structures. The algorithm for detecting cyclic
  // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

  // Initializing stack of traversed objects.
  // It's done here since we only need them for objects and arrays comparison.
  aStack = aStack || [];
  bStack = bStack || [];
  var length = aStack.length;
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    if (aStack[length] === a) return bStack[length] === b;
  }

  // Add the first object to the stack of traversed objects.
  aStack.push(a);
  bStack.push(b);

  // Recursively compare objects and arrays.
  if (areArrays) {
    // Compare array lengths to determine if a deep comparison is necessary.
    length = a.length;
    if (length !== b.length) return false;
    // Deep compare the contents, ignoring non-numeric properties.
    while (length--) {
      if (!eq(a[length], b[length], aStack, bStack)) return false;
    }
  } else {
    // Deep compare objects.
    var _keys = keys(a), key;
    length = _keys.length;
    // Ensure that both objects contain the same number of properties before comparing deep equality.
    if (keys(b).length !== length) return false;
    while (length--) {
      // Deep compare each member
      key = _keys[length];
      if (!(_has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
    }
  }
  // Remove the first object from the stack of traversed objects.
  aStack.pop();
  bStack.pop();
  return true;
}

// Perform a deep comparison to check if two objects are equal.
export function isEqual(a, b) {
  return eq(a, b);
}

// Is a given array, string, or object empty?
// An "empty" object has no enumerable own-properties.
// obj: array/string/obj
export function isEmpty(obj) {
  // null是一个特殊的对象
  if (obj == null) return true;
  // 如果是类数组/数组/字符串，用length判断是否为空
  if (isArrayLike(obj) && (isArray(obj) || isString(obj) || isArguments(obj))) return obj.length === 0;
  // 如果是对象，判断是否有自己的key
  return keys(obj).length === 0;
}

// Is a given value a DOM element?
export function isElement(obj) {
  // 用值和特征判断obj是否为一个Element
  return !!(obj && obj.nodeType === 1);
}

// Internal function for creating a toString-based type tester.
// check type
function tagTester(name) {
  return function(obj) {
    return toString.call(obj) === '[object ' + name + ']';
  };
}

// Is a given value an array?
// Delegates to ECMA5's native Array.isArray
// nativeIsArray es5新api,es3的用不了
export var isArray = nativeIsArray || tagTester('Array');

// Is a given variable an object?
// 普通对象，函数，数组都是对象
export function isObject(obj) {
  var type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
}

// Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
export var isArguments = tagTester('Arguments'); // ie 9下不兼容
export var isFunction = tagTester('Function');
export var isString = tagTester('String');
export var isNumber = tagTester('Number');
export var isDate = tagTester('Date');
export var isRegExp = tagTester('RegExp');
export var isError = tagTester('Error');
export var isSymbol = tagTester('Symbol');
export var isMap = tagTester('Map');
export var isWeakMap = tagTester('WeakMap');
export var isSet = tagTester('Set');
export var isWeakSet = tagTester('WeakSet');

// Define a fallback version of the method in browsers (ahem, IE < 9), where
// there isn't any inspectable "Arguments" type.
(function() {
  if (!isArguments(arguments)) {
    // ie 9下的兼容
    isArguments = function(obj) {
      return _has(obj, 'callee');
    };
  }
}());

// Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
// IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
var nodelist = root.document && root.document.childNodes;
if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
  isFunction = function(obj) {
    return typeof obj == 'function' || false;
  };
}

// Is a given object a finite number?
export function isFinite(obj) {
  return !isSymbol(obj) && _isFinite(obj) && !_isNaN(parseFloat(obj));
}

// Is the given value `NaN`?
export function isNaN(obj) {
  return isNumber(obj) && _isNaN(obj);
}

// Is a given value a boolean?
export function isBoolean(obj) {
  return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
}

// Is a given value equal to null?
export function isNull(obj) {
  return obj === null;
}

// Is a given variable undefined?
export function isUndefined(obj) {
  return obj === void 0;
}

// Shortcut function for checking if an object has a given property directly
// on itself (in other words, not on a prototype).
// 是否又某个属性，可以检查多级属性，path可以是字符串或字符串数组
export function has(obj, path) {
  if (!isArray(path)) {
    // 只能检查一级属性
    return _has(obj, path);
  }
  var length = path.length;
  for (var i = 0; i < length; i++) {
    var key = path[i];
    if (obj == null || !hasOwnProperty.call(obj, key)) {
      return false;
    }
    obj = obj[key];
  }
  return !!length;
}

// Utility Functions
// -----------------

// Keep the identity function around for default iteratees.
// 用于函数式编程
export function identity(value) {
  return value;
}

// Predicate-generating functions. Often useful outside of Underscore.
export function constant(value) {
  return function() {
    return value;
  };
}
// 返回undefined
export function noop(){}

// Creates a function that, when passed an object, will traverse that object’s
// properties down the given `path`, specified as an array of keys or indexes.
// 已给定了属性，返回一个接收obj的属性查找函数
export function property(path) {
  // string
  if (!isArray(path)) {
    return shallowProperty(path);
  }
  // string[]
  return function(obj) {
    return deepGet(obj, path);
  };
}

// Generates a function for a given object that returns a given property.
// 已给定了obj，返回一个接收path的属性查找函数
export function propertyOf(obj) {
  if (obj == null) {
    return function(){};
  }
  return function(path) {
    return !isArray(path) ? obj[path] : deepGet(obj, path);
  };
}

// Returns a predicate for checking whether an object has a given set of
// `key:value` pairs.
// 子对象匹配柯里化，先接收子对象再接收父对象
export function matcher(attrs) {
  attrs = extendOwn({}, attrs);
  return function(obj) {
    return isMatch(obj, attrs);
  };
}
export { matcher as matches };

// Run a function **n** times.
// 指定一个fn在context中执行n次
export function times(n, iteratee, context) {
  var accum = Array(Math.max(0, n));
  iteratee = optimizeCb(iteratee, context, 1);
  // 跑n次后将结果存到accum中，然后返回
  for (var i = 0; i < n; i++) accum[i] = iteratee(i);
  return accum;
}

// Return a random integer between min and max (inclusive).
export function random(min, max) {
  // 如果只给了一个值(min)，范围就为0-min
  if (max == null) {
    max = min;
    min = 0;
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

// A (possibly faster) way to get the current timestamp as an integer.
// || 兼容性写法
export var now = Date.now || function() {
  return new Date().getTime();
};

// List of HTML entities for escaping.
// 转义字符映射
var escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;'
};
var unescapeMap = invert(escapeMap);

// Functions for escaping and unescaping strings to/from HTML interpolation.
function createEscaper(map) {
  var escaper = function(match) {
    return map[match];
  };
  // Regexes for identifying a key that needs to be escaped.
  var source = '(?:' + keys(map).join('|') + ')';
  var testRegexp = RegExp(source);
  // 生成匹配map的key字符串的正则
  var replaceRegexp = RegExp(source, 'g');
  return function(string) {
    string = string == null ? '' : '' + string;
    // replace： 如果找到key字符串，替换成val字符串
    return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
  };
}
// 实体字符转义
export var escape = createEscaper(escapeMap);
// 转为实体字符
export var unescape = createEscaper(unescapeMap);

// Traverses the children of `obj` along `path`. If a child is a function, it
// is invoked with its parent as context. Returns the value of the final
// child, or `fallback` if any child is undefined.
// 用于匹配一个child
// path：obj属性的数组, fallback: 可执行的方法或者值
export function result(obj, path, fallback) {
  if (!isArray(path)) path = [path];
  var length = path.length;
  if (!length) {
    // 匹配不到时，使用fallback
    return isFunction(fallback) ? fallback.call(obj) : fallback;
  }
  for (var i = 0; i < length; i++) {
    // 匹配的child命名为prop
    var prop = obj == null ? void 0 : obj[path[i]];
    // 无法满足匹配时
    if (prop === void 0) {
      // 使用fallback备用匹配
      prop = fallback;
      // 提早结束for
      i = length; // Ensure we don't continue iterating.
    }
    // 满足匹配时，更新obj，然后进入下一次循环
    obj = isFunction(prop) ? prop.call(obj) : prop;
  }
  return obj;
}

// Generate a unique integer id (unique within the entire client session).
// Useful for temporary DOM ids.
// 返回一个id叠加的前缀
var idCounter = 0;
export function uniqueId(prefix) {
  var id = ++idCounter + '';
  return prefix ? prefix + id : id;
}

// By default, Underscore uses ERB-style template delimiters, change the
// following template settings to use alternative delimiters.
export var templateSettings = _.templateSettings = {
  evaluate: /<%([\s\S]+?)%>/g,   // /<%name%> /  可执行语句
  interpolate: /<%=([\s\S]+?)%>/g,  // /<%=name%> /  打印表达式
  escape: /<%-([\s\S]+?)%>/g  // /<%-name%> /  html实体编码，防XSS
};

// <% _.each(obj, function(e, i, a){ %>
//   <% if (i === 0) %>
//     <li><%- e.name %>
//   <% else if (i === a.length - 1) %>
//     <li class="last-item"><%= e.name %></li>
//   <% else %>
//     <li><%= e.name %></li>
// <% }) %>

// When customizing `templateSettings`, if you don't want to define an
// interpolation, evaluation or escaping regex, we need one that is
// guaranteed not to match.
var noMatch = /(.)^/;

// Certain characters need to be escaped so that they can be put into a
// string literal.
var escapes = {
  "'": "'",
  '\\': '\\',
  '\r': 'r',
  '\n': 'n',
  '\u2028': 'u2028',
  '\u2029': 'u2029'
};

var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

var escapeChar = function(match) {
  return '\\' + escapes[match];
};

// JavaScript micro-templating, similar to John Resig's implementation.
// Underscore templating handles arbitrary delimiters, preserves whitespace,
// and correctly escapes quotes within interpolated code.
// NB: `oldSettings` only exists for backwards compatibility.
export function template(text, settings, oldSettings) {
  if (!settings && oldSettings) settings = oldSettings;
  settings = defaults({}, settings, _.templateSettings);

  // Combine delimiters into one regular expression via alternation.
  var matcher = RegExp([
    (settings.escape || noMatch).source,
    (settings.interpolate || noMatch).source,
    (settings.evaluate || noMatch).source
  ].join('|') + '|$', 'g');

  // Compile the template source, escaping string literals appropriately.
  var index = 0;
  // 函数体源码，打印函数fn.toLocaleString()
  var source = "__p+='";
  text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
    source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
    index = offset + match.length;

    // 比配到的escape，interpolate，evaluate分组信息填充到source
    if (escape) {
      source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
    } else if (interpolate) {
      source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
    } else if (evaluate) {
      source += "';\n" + evaluate + "\n__p+='";
    }

    // Adobe VMs need the match returned to produce the correct offset.
    return match;
  });
  source += "';\n";

  // If a variable is not specified, place data values in local scope.
  // with指定作用域
  if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

  source = "var __t,__p='',__j=Array.prototype.join," +
    "print=function(){__p+=__j.call(arguments,'');};\n" +
    source + 'return __p;\n';

  var render;
  try {
    // new Function(param1, ..., paramN, funcBody)
    render = new Function(settings.variable || 'obj', '_', source);
  } catch (e) {
    e.source = source;
    throw e;
  }

  var template = function(data) {
    return render.call(this, data, _);
  };

  // Provide the compiled source as a convenience for precompilation.
  var argument = settings.variable || 'obj';
  // source属性以便于进行预编译，出现错误构建可以看source源码
  template.source = 'function(' + argument + '){\n' + source + '}';

  return template;
}

// Add a "chain" function. Start chaining a wrapped Underscore object.
// 给_实例添加一个_chain为true的属性，表明这个实例是可链式调用的
export function chain(obj) {
  var instance = _(obj);
  instance._chain = true;
  return instance;
}

// OOP
// ---------------
// If Underscore is called as a function, it returns a wrapped object that
// can be used OO-style. This wrapper holds altered versions of all the
// underscore functions. Wrapped objects may be chained.

// Helper function to continue chaining intermediate results.
// 如果实例可以链式调用，就让对象成为下一个可链式调用的实例，否则直接返回这个对象
function chainResult(instance, obj) {
  return instance._chain ? _(obj).chain() : obj;
}

// Add your own custom functions to the Underscore object.
export function mixin(obj) {
  each(functions(obj), function(name) {
    var func = _[name] = obj[name];
    _.prototype[name] = function() {
      var args = [this._wrapped];
      push.apply(args, arguments);
      return chainResult(this, func.apply(_, args));
    };
  });
  return _;
}

// Add all mutator Array functions to the wrapper.
// 增强_.prototype
each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
  var method = ArrayProto[name];
  _.prototype[name] = function() {
    var obj = this._wrapped;
    method.apply(obj, arguments);
    if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
    return chainResult(this, obj);
  };
});

// Add all accessor Array functions to the wrapper.
each(['concat', 'join', 'slice'], function(name) {
  var method = ArrayProto[name];
  _.prototype[name] = function() {
    return chainResult(this, method.apply(this._wrapped, arguments));
  };
});

// Extracts the result from a wrapped and chained object.
// 实例的value就是它本身
_.prototype.value = function() {
  return this._wrapped;
};

// Provide unwrapping proxy for some methods used in engine operations
// such as arithmetic and JSON stringification.
// _.prototype.value的别名
_.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

// 返回实例的字符串形式
_.prototype.toString = function() {
  return String(this._wrapped);
};
