(function(){

    // 基础设置
    // ------------------

    // 在浏览器中建立根对象，`window` (`self`), `global`
    // 在服务器上，或者在某些虚拟机中使用`this`。
    // 我们使用`self`，而不是用于`webworker`支持的`window`

    var root = typeof self == 'object' && self.self === self ||
              typeof global == 'object' && global.global === global ||
              this || 
              {};

    // 保存 Underscore 使用 `_` 变量前的值，
    // 如果 Underscore 放弃 _ 变量将会释放该变量。
    var previousUnderscore = root._;

    // 在以前（但不是gzip）版本中保存字节
    var ArrayProto = Array.prototype, ObjProto = Object.prototype;
    var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

    // 创建快速引用变量以快速访问核心原型方法
    var push = ArrayProto.push,
        slice = ArrayProto.slice,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;
    
    // 使用本地所有 **ECMAScript 5** 函数实现
    var nativeIsArray = Array.isArray,
        nativeKeys = Object.keys,
        nativeCreate = Object.create;
    
    // 代理原型交换的直接函数引用
    var Ctor = function(){};

    // 创建对`_`对象的安全引用，以便在下面使用
    var _ = function(obj){
        // `obj` 是否是 `_` 的实例
        if (obj instanceof _) return obj;
        // 如果 `this` 不是 `_` 的实例，将返回一个新的实例
        if (!(this instanceof _)) return new _(obj);
        // 把 `obj` 挂载给 `this._wrapped`
        this._wrapped = obj;
    };

    // 从 `Node.js` 输出的 `Underscore` 对象和他们的旧模块API向后兼容
    // 如果我们在浏览器中，将 `_` 添加为全局对象，
    // 判断 `nodeType` 以确保 `module` 和 `exports` 不是 HTML 元素
    if (typeof exports != 'undefined' && !exports.nodeType) { // 判断 exports 对象是否存在并且不为 HTML 元素，为 `true` 时当前运行为 NodeJs
        if (typeof module != 'undefined' && !module.nodeType && module.exports) { // 判断 module 对象是否存在并且不为 HTML 元素
            exports = module.exports = _; 
        }
        // 输出 `_`
        exports._ = _;
    } else { // 为 `false` 时知道当前运行环境为浏览器并将 `_` 添加到全局对象
        root._ = _;
    }

    // 当前版本
    _.VERSION = '1.9.1';

    // 返回传入回调的有效（对于当前引擎）版本的内部函数，
    // 以便在其它 `Underscore` 函数中重复应用
    // 公共方法，根据 `func` 不同，所需要的参数不同，用公共方法统一执行
    /**
     * optimizeCb
     * @param {Function} func [需要执行的函数] 
     * @param {Object} context [指定的上下文对象]
     * @param {Number} argCount [回调方法需要除context外的额外参数数量]
     */
    var optimizeCb = function(func, context, argCount) {
        if (context === void 0) return func; // 判断 `context` 是否为 `undefined`
        switch (argCount == null ? 3 : argCount) { // 三目运算，是否传入了 `argcount` 参数，未传就初始值为 3
            case 1: return function(value) {
                return func.call(context, value);
            };
            // 2 个 `argument` 的情况被省略，因为后面并不会使用
            case 3: return function(value, index, collection){
                return func.call(context, value, index, collection);
            };
            /**
             * *
             * @param {Number} accumulator [累加值]
             */
            case 4: return function(accumulator, value, index, collection){
                return func.call(context, accumulator, value, index, collection);
            }
        }
        return function() { // 如果 argCount 不等于 [null || 1 || 3 || 4]，执行 apply 方法改变执行函数体内的 this 指向
            return func.apply(context, arguments);
        }
    };

    var builtinIteratee; // 内置迭代器

    // 用于生成回调的内部函数，该回调可应用于集合中的每个元素
    // return 所需的结果标识、任意回调、属性匹配器或属性访问器
    var cb = function(value, context, argCount) {
        // 判断 `_.iteratee` 是否与 `builtinIteratee` 不相等，为 true 时，`return _.iteratee(value, context)` 函数执行结果
        if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
        // 如果 value 为 null，那么直接 `return _.identity`
        if (value == null) return _.identity;
        // 如果 value 类型是 Function，那么 `return optimizeCb(value, context, argCount)` 函数执行结果
        if (_.isFunction(value)) return optimizeCb(value, context, argCount);
        // 如果 value 类型是 Object 并且类型不为 Array，那么 `return _.matcher(value)` 函数执行结果
        if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
        // 如果以上所有判断结果都为 false，那么 `return _.property(value)` 函数执行结果
        return _.property(value); 
        /**
         *  _.property = function(path) {
         *      if (!_.isArray(path)) {
         *          return shallowProperty(path);
         *      }
         *      return function(obj) {
         *          return deepGet(obj, path);
         *      };
         *  };
         *  */
    };

    // 回调生成器的外部包装，用户可以自定义 `_.iteratee`，
    // 如果他们需要额外的谓词/迭代器速记样式。
    // 此抽象隐藏了仅限内部的 `argCount` 参数
    _.iteratee = builtinIteratee = function(value, context) {
        return cb(value, context, Infinity);
    };

    // 有些函数在开始时接受可变数量的参数，或一些预期的参数，然后接受可变数量的值进行操作。
    // 此帮助程序将超过函数参数长度（或显式的"startIndex"）的所有剩余参数
    // 累积到成为最后一个参数的数组中。类似于 ES6 的 `rest parameter`(...)参数解构
    // 接受一个函数为参数，返回一个包装后的函数，参数用 arguments 获取；
    // 包装后的函数接受的所有参数，根据 func 函数接受的参数数量按照情况将多余的参数打包为数组，
    // 将该数组作为 func 函数接受的最后一个参数传入
    var restArguments = function(func, startIndex) {
        // 得到起始index，并确定能得到数值类型(+startIndex)
        startIndex = startIndex == null ? func.length - 1 : +startIndex; 
        // return 一个匿名函数，参数数量不定
        return function() { 
                // 获取排除第一个参数后的参数数量并确定不管传入任何参数都能得到数值类型
            var length = Math.max(arguments.length - startIndex, 0),
                // 初始化剩余参数数组集合，参数 push 到数组内
                rest = Array(length), 
                // 循环起始值
                index = 0; 
            for(; index < length; index++) {
                // index + startIndex 得到剩余参数起始下标
                // 遍历 arguments，把 arguments 剩余元素放在初始化数组集合的对应地址
                rest[index] = arguments[index + startIndex]; 
            }
            // 判断 startIndex 参数，根据结果返回不同的回调函数
            switch (startIndex) {
                // 原函数只接受一个剩余参数
                case 0: return func.call(this, rest);
                // 原函数只接受一个参数 + 剩余参数
                case 1: return func.call(this, arguments[0], rest);
                // 原函数只接受两个参数 + 剩余参数
                case 2: return func.call(this, arguments[0], arguments[1], rest);
            }
            // 如果上面判断并未有结果，那么执行下面的代码
            // 如果 func 函数接受三个以上的参数
            // 初始化一个空数组，将根据 func 的所有参数数量确定该空数组的长度；
            // 因为为了满足上面代码的情况 startIndex 是 func 的参数数量 -1.
            var args = Array(startIndex + 1);
            // 循环 args 数组，并给该数组每个元素赋值，
            // 因为循环条件是 startIndex，所以 args 数组的最后一位是空着的；
            // 为该函数的 arguments 中多传入的参数打包成为的数组作为最后一个参数统一传给 func
            for(index = 0; index < startIndex; index++) {
                args[index] = arguments[index];
            }
            args[startIndex] = rest;
            return func.apply(this, args);
        }
    };

    // 用于创建从其他对象继承的新对象的内部函数
    var baseCreate = function(prototype) {
        if (!_.isObject(prototype)) return {};
        if (nativeCreate) return nativeCreate(prototype);
        Ctor.prototype = prototype;
        var result = new Ctor;
        Ctor.prototype = null;
        return result;
    };

    // 用于查找某个 obj 中是否存在 key 属性，如果存在即返回该属性值
    var shallowProperty = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        }
    };

    // 该方法返回一个 Boolean 值，判断 obj 自身属性中是否具有指定的属性。
    var has = function(obj, path) {
        return obj != null && hasOwnProperty.call(obj, path);
    };

    // 根据 path 数组获取 obj 内的数据，深获取
    /**
     * 例：
     * var obj = {
     *     a: 1,
     *     b: {
     *         c: {
     *             d: 2
     *         }
     *     }
     * };
     * 
     * var path = ('b.c.d').split('.');
     * deepGet(obj, ['b', 'c', 'd']) // 2
     */
    var deepGet = function(obj, path) {
        var length = path.length;
        for (var i = 0; i < length; i++) {
            if (obj == null) return void 0;
            obj = obj[path[i]];
        }
        return length ? obj : void 0;
    };

    // 用于确定集合是作为数组还是作为对象进行迭代的集合方法的帮助程序
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1; // 数组最大数量，从 0 开始计
    var getLength = shallowProperty('length'); // 获取对象 length 值
    var isArrayLike = function(collection) { // 判断 collection 是否为 类 Array 数据（arguments...）
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // 基础，一个 `each` 实现，又名 `forEach`
    // 处理原始对象以及类似数组的对象。
    // 将所有稀疏数组视为密集数组。
    _.each = _.forEach = function(obj, iteratee, context) {
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        // 判断是否为数组
        if (isArrayLike(obj)) { // 数组或类数组情况
            for (i = 0, length = obj.length; i < length; i++) {
                // 对每个循环出来的数据执行 iteratee 函数
                iteratee(obj[i], i, obj);
            }
        } else { // 非数组情况
            // 执行 Object.keys 函数得到 Object 对象内所有元素名的数组集合
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        // 返回执行 iteratee 函数结果之后的数组集合
        return obj; 
    };

    // 返回对每个元素应用迭代器的结果。
    _.map = _.collect = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        // 判断是否为类数组对象，
        // 如果不是，就执行 _.keys 函数将 Object 对象里的 keys 取出来作为一个新数组
        var keys = !isArrayLike(obj) && _.keys(obj),
            // 获取长度 length 
            length = (keys || obj).length,
            // 根据长度 length 初始化一个新的空数组
            results = Array(length);
        for (var index = 0; index < length; index++) {
            // 根据两种参数类型情况利用三目运算符赋值给一个临时变量
            // Object 类型时为元素名 { key: val } 中的 key
            // ArrayLike 类数组数据类型时 [val0, val1] 中的 index
            var currentKey = keys ? keys[index] : index;
            // 给新数组每个位置赋值，赋值的内容是执行 iteratee 函数后返回的结果
            result[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        // 返回一个每个元素执行了 iteratee 函数后的结果数组集合
        return results;
    };

    // 创建一个向左或向右迭代的缩减函数
    var createReduce = function(dir) {
        // 在访问 `arguments.length` 的函数之外的单独函数中
        // 重新分配参数变量的包装代码，以避免性能受损
        var reducer = function(obj, iteratee, memo, initial) {
                // 根据 obj 类型判断执行 _.keys 函数得到 key 的集合
            var keys = !isArrayLike(obj) && _.keys(obj),
                // 获取 key 数组集合或者类数组数据的 length 长度
                length = (keys || obj).length,
                // 根据 dir 参数得到起始下标
                index = dir > 0 ? 0 : length - 1;
            // 如果 initial 参数为假，代表没有 memo 参数，需要初始化 memo 参数
            if (!initial) {
                memo = obj[keys ? keys[index] : index];
                index += dir;
            }
            // 根据 dir 参数执行遍历顺序(递增 或者 递减)
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            return memo;
        };

        return function(obj, iteratee, memo, context) {
            var initial = arguments.length >= 3;
            return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
        };
    };

    // 从左开始迭代
    _.reduce = _.foldl = _.inject = createReduce(1);

    // 顾名思义，从右开始迭代
    _.reduceRight = _.folder = createReduce(-1);

    // 返回通过 真 值测试的第一个值，别名为 `detect`
    _.find = _.detect = function(obj, predicate, context) {
        // 三目运算符判断 obj 是否是类数组数据，
        // 根据结果赋值不同查找功能的函数给 keyFinder 变量
        var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
        // 根据 keyFinder 赋值的函数查找对应集合拿到第一个相匹配的结果
        var key = keyFinder(obj, predicate, context);
        // 判断结果是否存在并返回该匹配结果
        if (key !== void 0 && key !== -1) return obj[key];
    };

    // 返回所有通过 真 值测试的元素集合，别名为 `select`
    _.filter = _.select = function(obj, predicate, context) {
        // 生成一个空数组，准备返回所有匹配通过的元素集合
        var result = [];
        // 调用 cb 函数覆盖重置 predicate 函数
        predicate = cb(predicate, context);
        // 利用已经存在的 _.each 方法，遍历传入的集合
        _.each(obj, function(value, index, list) {
            // 把匹配为真的值 push 到 results 集合中去
            if(predicate(value, index, list)) results.push(value);
        });
        // 返回该集合
        return results;
    };

    // 返回 真 值测试失败的所有元素集合
    _.reject = function(obj, predicate, context) {
        // 利用 _.filter 方法筛选匹配通过的值
        // 改变 _.filter 的筛选方式，修改 predicate 函数
        return _.filter(obj, _.negate(cb(predicate)), context);
    };

    // 确定所有元素是否通过 真 值测试，别名 `all`
    _.every = _.all = function(obj, predicate, context) {
        // 调用 cb 函数重置覆盖 predicate 函数
        predicate = cb(predicate, context);
            // 根据 obj 类型是否执行 _.keys 函数得到 key 的集合
        var keys = !isArrayLike(obj) && _.keys(obj),
            // 得到需要被匹配集合的 length 长度
            length = (keys || obj).length;
        // 循环遍历集合，判断每个元素是否匹配，
        // 如果存在不匹配的元素直接返回 false，结束遍历节省性能
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (!predicate(obj[currentKey], currentKey, obj)) return false;
        }
        // 遍历结束后没有不匹配的元素返回 true
        return true;
    };

    // 确定目标集合中是否至少有一个元素通过 真 值测试，别名 `any`
    _.some = _.any = function(obj, predicate, context) {
        // 调用 cb 函数重置覆盖 predicate 函数
        predicate = cb(predicate, context);
            // 根据 obj 类型是否执行 _.keys 函数得到 key 的集合
        var keys = !isArrayLike(obj) && _.keys(obj),
            // 得到需要被匹配集合的 length 长度
            length = (keys || obj).length;
        // 循环遍历集合，判断每个元素是否匹配，
        // 如果存在匹配元素直接返回 true，结束遍历节省性能
        for (var index = 0; index < length; index ++) {
            var currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        // 遍历完成后如果不存在匹配元素，那么返回 false
        return false;
    };

    // 确定集合中是否包含给定的元素项
    _.contains = _.includes = _.includ = function(obj, item, fromIndex, guard) {
        // 判断非类数组数据时调用 _.values(Object.vulues) 函数得到 values 集合
        if (!isArrayLike(obj)) obj = _.values(obj);
        // fromIndex 是否为不为数值类型 或者 guard 是否存在，如果为 true 则初始化为 0
        if (typeof fromIndex != 'number' || guard) fromIndex = 0;
        // 调用 _.indeOf 方法，返回 Boolean 结果
        return _.indexOf(obj, item, fromIndex) >= 0;
    };

    // 对集合中的每个元素(带参数)调用指定(path)方法;
    _.invoke = restArguments(function(obj, path, args) {
        var contextPath, func;
        // 判断第二个参数是否为 function 类型
        if (_.isFunction(path)) {
            // 把第二个参数赋值给 func 变量
            func = path;
        // 判断第二个参数是否为 Array 类型
        } else if (_.isArray(path)) {
            // 如果第二个参数是数组，那么排除最后一个元素后生成一个新数组并赋值给 contextPath 变量，
            // 得到一个数据路径(a.b.c => ['a','b','c'])，又称 上下文地址
            contextPath = path.slice(0, -1);
            // 把第二个参数重置覆盖为数组中的最后一个元素，此变量代表执行的方法名称  Objec[path]
            path = path[path.length - 1];
        }
        // 返回执行 _.map 函数执行结果，对每个元素执行函数并返回执行结果集合
        return _.map(obj, function(context) {
            var method = func;
            // 判断 method 变量是否有值
            if (!method) {
                // 判断上下文地址是否存在并且数组内容长度大于0
                if (contextPath && contextPath.length) {
                    // 利用 上下文地址 深获取某个指定元素并赋值给 context
                    context = deepGet(context, contextPath);
                }
                // 如果获取的元素不存在，返回 undefined
                if (context == null) return void 0;
                // 如果不存在以上情况，那么直接赋值给 method
                method = context[path];
            }
            // 根据 method 中的值返回不同的结果
            return method == null ? method : method.apply(context, args);
        });
    });

    // _.map 函数再封装便利方法：获取指定 key 
    /**
     * @param obj [Object || Array(Lick)]
     * @param key [String || Number || Array]
     */
    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    // _.filter 函数再封装便利方法：仅选择包含特定 `key: value` 对的对象
    /**
     * @param obj [Object || Array(Lick)]
     * @param attrs [String || Object]
     */
    _.where = function(obj, attrs) {
        return _.filter(obj, _.matcher(attrs));
    };

    // _.find 函数再封装便利方法：获取包含特定 `key: value` 对的第一个对象
    /**
     * @param obj [Object || Array(Lick)]
     * @param attrs [String || Object]
     */
    _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matcher(attrs));
    };

    // 返回 list 中的最大值。
    // 如果传递 迭代器函数(iteratee)，iteratee 将作为 list 中每个字的排序依据。
    // 如果 list 为空，将返回 -Infinity，所以可能需要事先用 isEmpty 检查list
    // 有用到冒泡算法思路
    _.max = function(obj, iteratee, context) {
        /**
         * result：缓存需要返回的参数或是该方法计算后已经得到的最大元素
         * lastComputed: 缓存上次遍历时的计算结果
         * computed：缓存该次遍历时的计算结果
         * value：缓存 iteratee 参数不满足下方 if 条件时遍历 obj 数据得到的该次元素
         */
        var result = -Infinity, lastComputed = -Infinity,
            value, computed;
        // 判断 iteratee 参数类型，根据该参数选择对比方式，
        // 如果该参数为 null 或者 该参数为 数值 类型并且 obj 参数内第一个数据不为 object 并且 obj 参数不为 null
        if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
            // 根据 obj 数据类型获取需要对比的数据集合
            obj = isArrayLike(obj) ? obj : _.value(obj);
            // 遍历 obj 数据
            for (var i = 0, length = obj.length; i < length; i++) {
                // 临时每次迭代时把该次迭代元素赋值给 value 变量
                value = obj[i];
                // 判断该次元素是否为 null 并且 该次元素是否大于 retult
                if (value != null && value > result) {
                    // 如果满足条件把该次元素赋值给 result 变量
                    result = value;
                }
            }
        } else {
            // 此种情况为 iteratee 参数有值并且数据类型不为 number 同时 obj 数据集合中第一个元素类型为 object
            // 根据 iteratee 参数调用 cb 方法统一包装回调函数
            iteratee = cb(iteratee, context);
            // 遍历 obj 数据
            _.each(obj, function(v, index, list) {
                // 调用已经统一包装的 迭代器(iteratee) 并执行迭代器拿到执行结果赋值给 computed 参数
                computed = iteratee(v, index, list);
                // 判断该次遍历元素计算结果是否大于上次遍历元素结算结果，
                // 或者该次遍历元素计算结果等于 -infinity 并且 result 也等于 -Infinity，证明初始数据还保持原始状态
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    // 满足条件把该次遍历元素赋值给 result，
                    // 然后把该次遍历元素计算结果赋值给 lastComputed 变量，等待下次遍历比对大小
                    result = v;
                    lastComputed = computed;
                }
            });
            // 返回该方法已得到的结果
            return result;
        }
    };

    // 返回最小元素(或基于计算元素的结果)
    _.min = function(obj, iteratee, context) {
        var result = Infinity, lastComputed = Infinity,
            value, computed;
        if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if(value != null && value < result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list){
                computed = iteratee(v, index, list);
                if (computed < lastComputed || computed === Infinity && result === Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // 随机打乱集合顺序：洗牌方法
    _.shuffle = function(obj) {
        return _.samplp(obj, Infinity);  
    };

    // 从集合中抽取随机值
    // 如果未指定 n，则返回单个随机元素。
    // 内部的 guard 参数允许它与 map 一起使用
    _.sample = function(obj, n, guard) {
        // 判断是否传入 n 参数
        if (n == null || guard) {
            // 根据 obj 数据类型获取目标数据集合
            if (!isArrayLike(obj)) obj = _.values(obj);
            // 返回 obj 数据中随机位置的元素
            return obj[_.random(obj.length - 1)]
        }
        // 指定了 n 参数时，
        // 根据 obj 数据类型获取目标数据集合，
        // 调用 _.clone 方法生成一个新的目标数据集合
        var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
        // 获取目标数据集合的 length 长度
        var length = getLength(sample);
        // 得到需要返回的指定随机元素数量，该写法保证了极端情况下能正常获取到数值，最少能取到 0
        n = Math.max(Math.min(n, length), 0);
        // 得到最后一个元素下标地址
        var last = length - 1;
        // 遍历 n 次
        for (var index = 0; index < n; index++) {
            // 拿到指定范围内的随机数，最小值为该次遍历次数，避免重复数据
            var rand = _.random(index, last);
            // 临时缓存该次遍历元素
            var temp = sample[index];
            // 把该次遍历元素覆盖为随机位置的元素
            sample[index] = sample[rand];
            // 把上次拿到的随机位置的元素覆盖为临时缓存的该次遍历的源
            sample[rand] = temp;
        }
        // 返回获取指定长度的随机元素数据集合
        return sample.slice(0, n);
    };

    // 根据 迭代器 生成的 条件 对 对象 的值进行排序
    _.sortBy = function(obj, iteratee, context) {
        // 初始化迭代下标 index
        var index = 0;
        // 调用 cb 函数初始化 迭代器回调函数
        iteratee = cb(iteratee, context);
        // 调用 _.pluck 函数获取元素集合中指定属性并返回一个数组
        // 调用 _.map 函数遍历 obj 数据并格式化后返回一个新的元素数组集合，
        // 格式化的新元素数组内包含对象结构，criteria 元素表示排序标准，
        // 值是 _.sortBy 函数传入的参数，代表排序条件，根据该参数得到 -1 或者 1 的结果
        // 再利用 数组对象 原生的 sort 方法对已格式化的新元素数组集合进行排序，
        // 最后在返回该结果
        // _.pluck 获取传入的数组对象中指定的元素 'value'
        return _.pluck(_.map(obj, function(value, key, list){
            // 格式化 obj 数据
            return {
                value: value,
                index: index++,
                criteria: iteratee(value, key, list)
            };
        // 调用原生 sort 方法排序
        }).sort(function(left, right){
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b){
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }), 'value');
    };

    // 用于聚合分组操作的内部函数，一个公共方法
    // 可自定义 行为(behavior)函数，可根据需求进行 分区(partition)
    var group = function(behavior, partition) {
        // 返回类似 cb(回调) 函数规则的函数
        return function(obj, iteratee, context) {
            // 根据 partition 参数判断是返回一个对象集合还是二维数组
            var result = partition ? [[] , []] : {};
            // 初始化 迭代器 函数
            iteratee = cb(iteratee, context);
            // 遍历传入集合
            _.each(obj, function(value, index) {
                // 执行 迭代器 函数，传入遍历集合中的每个元素，获得根据传入分组规则统计后的分组名称
                var key = iteratee(value, index, obj);
                // 执行行为函数，根据行为函数结果进行分组
                behavior(result, value, key);
            });
            // 返回聚合分组结果
            return result;
        }
    };

    // 按条件对对象的值进行分组。将字符串属性传递给 `groupBy` 或 传入返回条件的函数
    // 例：根据 length 长度进行聚合分组一个数组
    // _.groupBy(['aaa','bbb','ccc','dddd','eeeee'], 'length')
    // => {3: ['aaa','bbb','ccc'], 4: ['dddd'], 5: ['eeeee']}
    // [3,4,5] 分别为集合每个元素的 length
    _.groupBy = group(function(result, value, key) {
        // 判断已分组对象 result 中是否存在 key 属性
        if (has(result, key)) { // true: 将新元素 push 进入该分组
            result[key].push(value);
        } else { // false: 添加一个新分组，并初始化该组属性为 数组
            result[key] = [value];
        }
    });

    // 给定一个数组集合 和 一个用来返回在列表中的每个元素 key 的 iteratee 函数(或属性名)，
    // 返回具有每项索引 key 的对象
    // var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
    // _.indexBy(stooges, 'age');
    // => {
    //     "40": {name: 'moe', age: 40},
    //     "50": {name: 'larry', age: 50},
    //     "60": {name: 'curly', age: 60}
    // }
    // 可以数组去重
    _.indexBy = group(function(result, value, key) {
        result[key] = value;
    });

    // 返回统计按特定条件分组的对象实例。
    // 传递要计数的字符串属性或返回条件的函数
    // _.countBy([1, 2, 3, 4, 5], function(num) {
    //     return num % 2 == 0 ? 'even': 'odd';
    // });
    // => {odd: 3, even: 2}
    // 统计满足条件元素个数并分组
    _.countBy = group(function(result, value, key) {
        if (has(result, key)) result[key]++; else result[key] = 1;
    });

    // 字符数组 的正则表达式
    var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
    // 从任何无法识别的数据类型中安全的创建一个新的并且真实的数组。
    _.toArray = function(obj) {
        // 是否传入参数，没有就直接返回一个空数组
        if (!obj) return [];
        // 是否为 Array 类型，如果是，就执行 slice 方法返回一个新数组
        if (_.isArray(obj)) return slice.call(obj);
        // 是否为 String 类型，如果是，
        // 就执行 match 方法正则解析 数组字符串 并返回一个解析后的数组
        if (_.isString(obj)) {
            return obj.match(reStrSymbol);
        }
        // 是否为 类数组 数据，如果是，那么直接执行 _.map 方法
        if (isArrayLike(obj)) return _.map(obj, _.identity);
        // 以上判断都未执行，那么默认认为该传入参数类型为 Object，执行 _.values 方法
        return _.values(obj);
    };

    // 返回一个集合的大小
    _.size = function(obj) {
        if (obj == null) return 0;
        // 根据数据类型用不同的方式获得该数据的 length
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // 根据条件将一个数组分组为一个二维数组，
    // 满足条件分为第一组，
    // 不满足条件分为第二组
    // _.partition([0, 1, 2, 3, 4, 5], isOdd);
    // => [[1, 3, 5], [0, 2, 4]]
    _.partition = group(function(result, value, pass) {
        result[pass ? 0 : 1].push(value);
    });


    // Array Functions
    // ---------------

    // 获取数组的第一个元素。
    // 传递 `n` 将返回数组中前 n 个值。
    // 别名为 `head` 和 `take`。
    // 返回数组中前 n 个元素。
    _.first = _.head = _.take = function(array, n, guard) {
        if (array == null || array.length < 1) return n == null ? void 0 : [];
        if (n == null || guard) return array[0];
        return _.initial(array, array.length - n);
    };

    // 返回数组的最后一个条目以外的所有内容。
    // 对 arguments 对象尤其有用。
    // 传递 `n` 将返回数组中的所有值，传递 `n` 参数将从结果中排除从最后一个开始的n个元素。
    // 排除数组后面的 n 个元素。
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // 获取数组的最后一个元素。
    // 传递 `n` 将返回数组从最后一个元素开始的 n 个集合
    _.last = function(array, n, guard) {
        if (array == null || array.length < 1) return n == null ? void 0 : [];
        if (n == null || guard) return array[array.length - 1];
        return _.rest(array, Math.max(0, array.length - n));
    };

    // 返回数组第一个条目以外的所有内容。
    // 别名 `tail` 和 `drop`。对 arguments 对象尤其有用。
    // 传递一个 `n`，将返回数组中其余 n 个值(n 为 index)
    // _.rest([5, 4, 3, 2, 1], 1);
    // => [3, 2, 1]
    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };

    // 返回一个除去了所有 falsy(假) 值的数组副本。
    // 在 JavaScript 中，false, null, 0, "", undefined 和 NAN 都是 falsy 值。
    _.compact = function(array) {
        return _.filter(array, Boolean);
    };

    // 递归 `flatten` 函数的内部实现
    var flatten = function(input, shallow, strict, output) {
        output = output || [];
        // 缓存输出集合的长度，保证每次递归时不会覆盖之前的元素
        var idx = output.length;
        for (var i = 0, length = getLength(input); i < length; i++) {
            var value = input[i];
            if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
                // 展开数组或参数对象的当前级别。
                // 该 shallow 参数为 true(真) 值时，只展开一层。
                if (shallow) {
                    var j = 0, len = value.length;
                    while (j < len) output[idx++] = value[j++];
                } else { // 为 falsy(假) 值时，递归展开所有层级。
                    flatten(value, shallow, strict, output);
                    idx = output.length;
                }
            } else if (!strict) {
                output[idx++] = value;
            }
        }
        return output;
    };

    // 递归的方式展开一个多维数组(将多维数组展开为一个一维的普通数组)，
    // 如果传递了 shallow 参数，那么数组将只减少一层嵌套。

    // _.flatten([1, [2], [3, [[4]]]]);
    // => [1, 2, 3, 4];

    // _.flatten([1, [2], [3, [[4]]]], true);
    // => [1, 2, 3, [[4]]];

    _.flatten = function(array, shallow) {
        return flatten(array, shallow, false);
    };

    // 返回不包含指定值的数组版本。
    // _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
    // => [2, 3, 4]
    _.without = restArguments(function(array, otherArrays) {
        return _.difference(array, otherArrays);
    });

    // 返回 array 去重后的副本，使用 === 做相等测试。
    // 如果 array 已排序，那么给 isSorted 参数传递 true 值，此函数将会运行更快的算法。
    // 如果要处理对象元素，传递 iteratee 函数来获取要对比的属性
    // _.uniq([1, 2, 1, 4, 1, 3]);
    // => [1, 2, 4, 3]
    _.uniq = _.unique = function(array, isSorted, iteratee, context) {
        // 根据 array 是否排序过确定传入 isSorted 参数
        // 传 true 就会选择速度更快的算法
        if (!_.isBoolean(isSorted)) {
            context = iteratee;
            iteratee = isSorted;
            isSorted = false;
        }
        // 迭代器函数 iteratee 不为 null时，初始化 iteratee 函数
        if (iteratee != null) iteratee = cb(iteratee, context);
        // 声明两个临时的空数组
        var result = [];
        var seen = [];
        // 循环 array 每个元素
        for (var i = 0, length = getLength(array); i < length; i++) {
            // 声明一个 value 变量并缓存当前迭代元素
            var value = array[i],
                // 三目运算符判断是否存在迭代器，
                // 存在迭代器的话就把当前迭代元素传入迭代器计算并返回得到结果
                // 否则把 value 变量值存入 computed 变量
                computed = iteratee ? iteratee(value, i, array) : value;
            // 判断 isSorted 结果为真并且 iteratee 结果为假
            if (isSorted && !iteratee){
                // 当前迭代下标不为 0 或者 seen 变量不全等 computed时，
                // 把当前迭代元素 push 到 result 变量
                if (!i || seen !== computed) result.push(value);
                // 把 computed 赋值给 seen 变量，等待下次迭代使用
                seen = computed;
                // 以上代码应该是使用的冒泡算法的思路来比较每个迭代元素与之后迭代元素的结果
            } else if (iteratee) { // 当前判断为传入 isSorted 参数值为 真 的情况
                // 判断 seen 集合中是否有指定的 computed 变量中的值
                if (!_.contains(seen, computed)) {
                    // 如果没有就把 computed 变量 push 到 seen 集合中
                    seen.push(computed);
                    // 再把当前迭代元素 push 到 result 集合
                    result.push(value);
                }
            // 判断 result 集合中是否存在 value 变量的值
            } else if (!_.contains(result, value)) {
                // 如果不存在，那么再把 value push 到 result 集合
                result.push(value);
            }
        }
        // 返回去重结果
        return result;
    };

    // 把传入的多个或一个数组合并为一个去重数组并按照顺序返回
    _.union = restArguments(function(arrays) {
        return _.uniq(faltten(arrays, true, true));
    });

    // 返回传入的多个数组内所有元素集合的交集。
    // 交集：所有集合中都存在的元素集合

    // _.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
    // => [1, 2]
    _.intersection = function(array) {
        var result = [];
        // 缓存传入参数数量
        var argsLength = arguments.length;
        // 遍历第一个参数
        for (var i = 0, length = getLength(array); i < length; i++) {
            // 缓存当前遍历元素
            var item = array[i];
            // 调用 _.contains 函数，
            // 判断 result 数组中是否存在当前遍历元素，
            // 如果存在就直接退出当次循环
            if (_.contains(result, item)) continue;
            var j;
            // 遍历除第一个元素外的其他参数
            for (j = 1; j < argsLength; j++) {
                // 调用 _.contains 函数，
                // 判断当次遍历参数集合中是否存在外层循环当次遍历元素
                // 如果不存在就直接退出该循环
                if (!_.contains(arguments[j], item)) break;
            }
            // 如果遍历次数等于所有参数数量时，
            // 把当次遍历元素添加到 result 集合末尾
            if (j === argsLength) result.push(item);
        }
        // 返回结果
        return result;
    };

    // 类似 _.without，
    // 返回的集合是基于 array 参数集合所有元素中不存在于 other 数组元素的集合
    // _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
    // => [1, 3, 4]
    _.difference = restArguments(function(array, rest) {
        // 展开 rest 参数集合
        rest = flatten(rest, true, true);
        // 筛选，遍历 array
        return _.filter(array, function(value) {
            // 每次遍历判断当前遍历元素是否存在 rest 集合中，
            // 存在时返回 false，不存在时返回 true
            return !_.contains(rest, value);
        });
    });

    // 传入若干二维数组集合，返回一相同格式的新数组，
    // 该新数组格式内的所有位置都是之前传入二维数组集合中每个元素集合的相同 index 的集合
    // _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
    // => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
    _.unzip = function(array) {
        // 缓存二维数组中最长元素集合的长度
        var length = array && _.max(array, getLength).length || 0;
        // 根据最长元素长度声明一个长度相同的新空数组
        var result = Array(length);

        // 遍历最长元素集合的 length 次数
        for(var index = 0; index < length; index++) {
            // 调用 _.pluck 函数获取传入的二维数组中的所有元素相同 index 的元素
            // 并返回一个新数组放到 result 集合对应 index 位置
            result[index] = _.pluck(array, index);
        }
        return result;
    };


    // 与 _.unzip 功能相同，传入参数不同，可传入若干个数组集合
    // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
    // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
    _.zip = restArguments(_.unzip);

    // 把 list 集合格式化为 object
    // 可只传入  _.object([[key1, value1], [key2, value2]]) 一个二维数组集合
    // 也可传入  _.object([key1, key2], [value1, value2]) 两个独立数组
    _.object = function(list, values) {
        var result = {};
        for (var i = 0, length = getLength(list); i < length; i++) {
            // 判断是否传入 values 参数
            if (values) { // 传了 values 参数时，获取 values 集合中的元素作为 object 的值
                result[list[i]] = values[i];
            } else { // 未传 values 时，获取当前遍历的第二个元素作为 object 的值
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // 创建真值检测索引查找器
    var createPredicateIndexFinder = function(dir) {
        return function(array, predicate, context) {
            // 初始化 真值检测 函数
            predicate = cb(predicate, context);
            // 声明变量，缓存 array 参数的 length
            var length = getLength(array);
            // 根据 dir 传参内容判断下面的 for 迭代是倒序还是正序
            var index = dir > 0 ? 0 : length - 1;
            for (; index >= 0 && index < length; index += dir) {
                // 如果通过 真值检测 ，那么返回当前的 索引
                if (predicate(array[index], index, array)) return index;
            }
            return -1;
        };
    };

    // 从 array 数组第一个开始查找，返回第一个通过真值检测的索引
    // _.findIndex([4, 6, 8, 12], isPrime);
    // => -1 // not found
    // _.findIndex([4, 6, 7, 12], isPrime);
    // => 2
    _.findIndex = createPredicateIndexFinder(1);

    // 从 array 数组最后一个开始查找，返回从末端开始的第一个通过真值检测的索引
    // var users = [{'id': 1, 'name': 'Bob', 'last': 'Brown'},
    //     {'id': 2, 'name': 'Ted', 'last': 'White'},
    //     {'id': 3, 'name': 'Frank', 'last': 'James'},
    //     {'id': 4, 'name': 'Ted', 'last': 'Jones'}];
    // _.findLastIndex(users, {
    //     name: 'Ted'
    // });
    // => 3
    _.findLastIndex = createPredicateIndexFinder(-1);


    // 使用 二分查找 方法确定 obj 参数在 array 中的索引位置，
    // obj 参数按此索引插入能保持 array 原有的排序。
    // 如果传入 iteratee 迭代器参数，
    // (该参数可以是也可以是字符串或对象中的属性名用来排序(比如length))
    // 那么 iteratee 将作为排序的依据。
    _.sortedIndex = function(array, obj, iteratee, context) {
        // 初始化 iteratee 参数
        iteratee = cb(iteratee, context, 1);
        // 执行 iteratee 函数并缓存该函数执行的结果到 value 变量
        var value = iteratee(obj);
        // 初始化 low 变量，确定循环起始序号
        // 获取 array 的 length 长度并用 high 变量缓存
        var low = 0, high = getLength(array);
        // while 循环，传入初始条件 (low < high)
        // 二分查找法
        // 将一个已经排序的 list 分为两个部分并判断中间元素是否满足条件，  ←───┐
        // 如果满足条件，就代表该 list 前半部分都不满足该条件，              │
        // 那么再把后半部分分为两个区间并回到第一步继续循环判断；反之亦然   ────┘
        while (low < high) {
            // 计算 array 中间索引位置并执行 Math.floor 函数向下取整得到一个整型数值，
            // 将计算结果缓存到 mid 变量中
            var mid = Math.floor((low + high) / 2);
            // iteratee 函数计算 array 中间 mid 索引元素是否小于 value 变量
            // true(真): 将 low 重新赋值为 中间索引位置并 +1，以便下次循环确定范围
            // falsy(假): 将 high 变量赋值为 mid 变量，以便下次循环确定范围
            if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
        }
        // 循环结束后返回已经计算结束后的索引位置序号
        return low;
    };

    // 用于创建 indexOf 和 lastIndexOf 函数的生成器函数
    /**
     *
     * @param dir {Number} 该参数确定内部循环遍历时的顺序(正序、倒序)
     * @param predicateFind {Function} 根据需求传入 _.findIndex 或 _.findLastIndex 方法
     * @param sortedIndex {Function} 根据需求判断是否传入 _.sortedIndex 方法
     * @returns {Function} 闭包返回一个匿名函数
     */
    var createIndexFinder = function(dir, predicateFind, sortedIndex) {
        return function(array, item, idx) {
            // 初始化声明 i 变量，
            // 获取 array 的 length 长度并赋值给 length 变量
            var i = 0, length = getLength(array);
            // 判断 idx 参数是否是 number 类型
            if (typeof idx == 'number') {
                // 根据 dir 参数确定遍历顺序
                if (dir > 0) {
                    // 如果 idx 大于等于 0 ，那么 i 等于 idx ，
                    // 否则 i 等于 (length - 1) 或 (i) 之间的最大值
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else {
                    // 如果 idx 大于等于 0 ，那么 length 等于 (idx + 1) 或 (length) 之间的最大值，
                    // 否则 length 等于 idx + length + 1
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            // 是否传入了 sortedIndex 参数 并且 idx 和 length 结果都为 true
            } else if (sortedIndex && idx && length) {
                // 如果确定传入的 array 已排序，那么便使用更快的二分查找法
                // 利用 sortedIndex 函数计算并获得满足条件的索引序号
                idx = sortedIndex(array, item);
                // 判断 array[idx] 的元素是否全等 item 参数，满足条件返回该元素索引序号；否则返回 -1
                return array[idx] === item ? idx : -1;
            }
            // 如果该方法被用作查找 array 中的 NaN 元素时，需要单独处理
            if (item !== item) {
                // 因为 NaN 与 NaN 是不相等的，
                // 那么如果传入的 item 参数为 NaN 的情况时，
                // 对 array 参数作不改变原来数据的情况下利用 slice 方法传入 i 与 length 变量生成一个新数组
                // 并执行 predicateFind 函数 传入 _.isNaN 方法查找 NaN 元素的索引序号
                idx = predicateFind(slice.call(array, i, length), _.isNaN());
                // 因为 idx 变量缓存的是生成的新数组查找的元素索引位置结果，
                // 所以需要根据 i 变量再次计算该元素的索引位置并返回结果
                return idx >= 0 ? idx + i : -1;
            }
            // dir 参数确定循环顺序
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                // 如果 array[idx] 全等 item，那么直接返回该次循环时的索引序号
                if (array[idx] === item) return idx;
            }
            // 以上代码执行完毕都未结束该方法，
            // 证明未查找到目标元素位置，那么直接返回 -1
            return -1
        };
    };

    // _.indexOf([1, 2, 3], 2);
    // => 1
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

    // _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
    // => 4
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);


    // 用来创建一个 start 到 stop 之间的整数列表，
    // 每个元素是 (该元素索引序号 * step + start) 的结果。
    // _.range(10);
    // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    // _.range(1, 11);
    // => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    // _.range(0);
    // => []

    // _.range(0, 30, 5);
    // => [0, 5, 10, 15, 20, 25]

    // stop 可为负数。
    // _.range(0, -10, -1);
    // => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
    _.range = function(start, stop, step){
        // 如果没有传入 stop 参数时
        if (stop == null) {
            // stop 赋值为 start 或者 0
            stop = start || 0;
            // start 赋值为 0
            start = 0;
        }
        // 未传入 step 参数
        if (!step) {
            // 初始化 step 参数，
            // 如果 stop 小于 start 证明该方法返回数组内元素都为负数，
            // step 初始化赋值为 -1；
            // 否则初始化赋值为 1。
            step = stop < start ? -1 : 1;
        }

        // 获取需要返回的数组的长度，
        // 调用 Math.max 方法确定结果至少为 0
        // 调用 Math.ceil 方法确定 (stop - start) / step 结果向上取整并且至少为整数
        var length = Math.max(Math.ceil((stop - start) / step), 0);
        // 声明一个长度为 length 的空数组
        var range = Array(length);

        // 根据 length 循环
        for (var idx = 0; idx < length; idx++, start += step) {
            // 每次循环把每次 start += step 结果赋值给数组对应下标索引的位置
            range[idx] = start;
        }

        // 返回已经生成并赋值的数组
        return range;
    };

    // 将 array 分解成多个数组，每个数组元素数量为 count 或者更少，
    // 分解完成后返回一个二维数组；
    // var kindergarten = ["Tyrone", "Elie", "Aidan", "Sam", "Katrina", "Billie", "Little Timmy"]
    // var partners = _.chunk(_.shuffle(kindergarten), 1);
    // => [["Tyrone"], ["Elie"], ["Aidan"], ["Sam"], ["Katrina"], ["Billie"], ["Little Timmy"]]
    _.chunk = function(array, count) {
        // 未传 count 参数或者 count 小于 1，
        // 结束执行方法并返回一个空数组
        if (count == null || count < 1) return [];
        // 初始化一个临时空数组
        var result = [];
        // 声明循环起始条件与终止条件
        var i = 0, length = array.length;
        // 满足条件时，最多循环 i < length 次
        while (i < length) {
            // 调用 slice 方法保留 array 数组从 i 到 i += count(改变 i 变量的起始位置索引以便第二次循环) 之间的元素，
            // 利用该方法返回一个新数组并 push 到 result 数组中
            result.push(slice.call(array, i, i += count));
        }
        // 返回结果
        return result;
    };

    // Function (ahem) Functions
    // ----------------------

    // 确定是作为构造函数执行函数，还是使用提供的参数执行普通函数。
    var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
        // 如果 callingContext 不是 boundFunc 的实例， 则把 sourceFunc 作为普通函数调用；
        if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
        // 否则把 sourceFunc 作为构造函数调用。
        // baseCreate 函数可以构造一个对象，继承传入的 Object.prototype 。
        // self 变量是缓存继承了 sourceFunc.prototype 原型的一个空白对象。
        var self = baseCreate(sourceFunc.prototype);
        // 得到执行 sourceFunc.apply 函数的结果
        var result = sourceFunc.apply(self, args);
        // 判断结果是否为 Object。
        // 因为如果构造函数有返回值并且该返回值为一个对象，
        // 那么新构造的 Object 就是返回值，而不是 this 所指向的值，
        // 才会返回 result 变量内的构造函数执行结果。
        if (_.isObject(result)) return result;
        // 只有在构造函数没有返回值或者返回值不是 Object 时，才会返回 this 所指向的值
        return self;
    };

    // 将指定函数中的 this 绑定到指定的上下文中，并传递一些参数作为默认参数。
    // args 为默认参数，之后再调用新的函数是无须再次传递这些参数。
    // var func = function(greeting){ return greeting + ': ' + this.name };
    // func = _.bind(func, {name: 'moe'}, 'hi');
    // func();
    // => 'hi: moe'
    _.bind = restArguments(function(func, context, args) {
        // 限制 func 必须为 Function 类型
        if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
        // 这里是闭包，生成一个私有作用域，保证在 bound 函数执行之前 func 变量是存在的。
        var bound = restArguments(function(callArgs) {
            // 调用 executeBound 方法，根据 bound 函数的调用方式返回不同的结果。
            return executeBound(func, bound, context, this, args.concat(callArgs));
        });
        return bound;
    });

    // 创建一个已填充一些默认参数的函数而不改变其动态 this 上下文。
    // 默认 _ 作为占位符，允许预先填充任何参数与占位符组合。
    // _.partial.placeholder 可自定义设置占位符。
    // var subtract = function(a, b) { return b - a; };
    // sub5 = _.partial(subtract, 5);
    // sub5(20);
    // => 15
    //
    // 有占位符的情况
    // subFrom20 = _.partial(subtract, _, 20);
    // subFrom20(5);
    // => 15
    _.partial = restArguments(function(func, boundArgs) {
        var placeholder = _.partial.placeholder;
        // 声明该函数是为了生成一个私有作用域(闭包)，保证 bound 函数在执行之前 func 变量还存在
        var bound = function() {
            // 声明 position 变量初始赋值为 0，
            // func 中传入的占位符索引序号对应 arguments 中的元素顺序，如果未传入占位符，
            // 则 arguments 在遍历时会从 args 最后一个元素开始循环赋值
            // 声明 length 变量，赋值为 boundArgs 的长度 length
            var position = 0, length = boundArgs.length;
            // 声明一个长度为 length 变量的空数组
            var args = Array(length);
            // 循环遍历 args 与 boundArgs 集合
            for (var i = 0; i < length; i++) {
                // 如果本次循环 boundArgs[i] 元素是占位符，
                // 则按顺序赋值 arguments 内的元素，
                // i 为本次循环的次数；position 为 arguments 中的元素下标；
                args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
            }
            // 如果 boundArgs.length 次循环完毕之后，arguments 中还剩有元素，
            // 则继续循环 arguments ，把剩余的元素按顺序 push 到 args 数组
            while (position < arguments.length) args.push(arguments[position++]);
            // 调用 executeBound 函数，用 func.apply(this, args) 的方式调用函数，
            // 确保排序后的每个参数(args)都传入了 func 函数
            return executeBound(func, bound, this, this, args);
        };
        return bound;
    });

    // 初始化占位符
    _.partial.placeholder = _;

    // 改变 obj 内所有指定的属性 this 指向
    // var buttonView = {
    //     label  : 'underscore',
    //     onClick: function(){ console.log('clicked: ' + this.label); },
    //     onHover: function(){ console.log('hovering: ' + this.label); }
    // };
    // _.bindAll(buttonView, 'onClick', 'onHover');
    // 将 buttonView.onClick 函数传入 jQuery 事件绑定方法，
    // this 指向并不会指向 jQuery 对象
    // jQuery('#underscore_button').on('click', buttonView.onClick);
    // => 'clicked: underscore'
    _.bindAll = restArguments(function(obj, keys) {
        keys = flatten(keys, false, false);
        var index = keys.length;
        if (index < 1) throw new Error('bindAll must be passed function names');
        // 循环 obj 中 keys 数组中每个元素名称属性
        while (index--) {
            var key = keys[index];
            // 遍历改变每个指定属性的 this 指向，将 this 指向锁死
            obj[key] = _.bind(obj[key], obj);
        }
    });

    // 该方法缓存某个函数的计算结果，传入的 key 作为属性名。
    // 如果该方法传入了 hasher 函数，那么 hasher 的返回值作为缓存的属性名。
    // 斐波那契数列
    // var fibonacci = _.memoize(function(n) {
    //     return n < 2 ? n: fibonacci(n - 1) + fibonacci(n - 2);
    // });
    // fibonacci(30);
    // console.log(fibonacci.cache);
    // => {
    //     0: 0,
    //     1: 1,
    //     2: 1,
    //     3: 2,
    //     4: 3,
    //     5: 5,
    //     6: 8,
    //     7: 13,
    //     8: 21,
    //     9: 34
    //     10: 55,
    //     11: 89,
    //     12: 144,
    //     13: 233,
    //     14: 377,
    //     15: 610,
    //     16: 987,
    //     17: 1597,
    //     18: 2584,
    //     19: 4181,
    //     20: 6765,
    //     21: 10946,
    //     22: 17711,
    //     23: 28657,
    //     24: 46368,
    //     25: 75025,
    //     26: 121393,
    //     27: 196418,
    //     28: 317811,
    //     29: 514229,
    //     30: 832040,
    // }
    _.memoize = function(func, hasher) {
        // 形成一个闭包，存在私有作用域，保证在执行该返回函数之前 func 变量还存在
        var memoize = function(key) {
            // 声明 cache 变量缓存 memoize.cache ，方便下次使用
            var cache = memoize.cache;
            // 判断是否传入 hasher 参数，根据结果确定缓存该函数执行后结果的属性名
            var address = '' + (hasher ? hasher.apply(this, arguments) : key);
            // 如果 cache 中不存在该属性，证明还未缓存该结果
            if (!has(cache, address)) cache[address] = func.apply(this, arguments);
            // 返回该次结果
            return cache[address];
        };
        memoize.cache = {};
        return memoize;
    };

    // 等待 wait 毫秒之后调用 func，如果 func 有参数，那么在调用时 args 会作为参数传入
    // var log = _.bind(console.log, console);
    // _.delay(log, 1000, 'logged later'); // 1秒后执行 log 方法
    // => 'logged later'
    _.delay = restArguments(function (func, wait, args) {
        // 返回一个 setTimeout 函数
        return setTimeout(function() {
            // 调用 func.apply 方法 args 作为参数传入
            return func.apply(null, args);
        }, wait);
    });

    // 类似 _.delay 方法，延迟调用 function ，默认时间为 1 毫秒，
    // 等价 setTimeout(function(){ // code... },0);
    // 如果传递 arguments 参数，那么当函数 function 执行时，arguments 会作为参数入
    // _.defer(function(){ alert('deferred'); });
    _.defer = _.partial(_.delay, _, 1);

    // 创建并返回一个类似节流阀一样的函数，
    // 在高频率的调用该函数时，保证每次都间隔 wait 毫秒之后再执行；
    // 比如在触发 scroll 事件时，使用该方法创建的函数不会被高频率的事件触发所执行，以便节省性能

    // var throttled = _.throttle(console.log($(window).scrollTop()), 100);
    // $(window).scroll(throttled);
    _.throttle = function(func, wait, options) {
        var timeout, context, args, result;
        // 记录上次执行函数时的时间
        var previous = 0;
        // 未传入配置项参数时初始化该配置项为一个空对象
        if (!options) options = {};

        // 执行最后一次 func
        var later = function () {
            // 如果禁用第一次调用时立即执行的话，previous 赋值为 0；
            // 否则记录该函数执行时间
            previous = option.leading === false ? 0 : _.now();
            // 执行该函数后 timeout 变量初始化
            timeout = null;
            // 将 func 函数执行结果赋值给 result 变量以便缓存
            result = func.apply(context, args);
            // 如果 timeout 变量转换 Boolean 值为 false，
            // 则 context 与 args 变量都同时初始化
            if (!timeout) context = args = null;
        };

        // 创建阀门函数
        var throttled = function() {
            // 执行该函数时缓存当前执行时的时间戳
            var now = _.now();
            // 如果 previous 未赋值并且配置参数已禁用立即执行 previous 赋值为 now
            if (!previous && options.leading === false) previous = now;
            // 延迟时间 - (上次执行时间 - 当前时间时间) = 距离下次执行 func 的等待时间
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            // 如果等待时间到了(未传入 leading 配置时，且第一次触发回调，即立即执行，
            // 此时 previous 为 0，remaining 满足小于等于 0 的条件)，
            // 或者下次执行 func 的等待时间 remaining 大于延迟时间 wait，
            // 那么便执行 func 函数；
            if (remaining <= 0 || remaining > wait) {
                // 判断 timeout 变量是否存在非 null 的值
                if (timeout) {
                    // 清除 clearTimeout
                    clearTimeout(timeout);
                    // 解除引用，释放内存
                    timeout = null;
                }
                // 记录当前调用时间戳
                previous = now;
                result = func.apply(context, args);
                // 初始化 context 与 args 变量
                if (!timeout) context = args = null;
            // 不存在定时器并且允许执行最后一次函数
            } else if (!timeout && options.trailing !== false) {
                // 最后一次等待 remaining 时间执行函数，并将该定时器缓存
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
        // 取消定时器并重置变量
        throttled.cancel = function() {
            clearTimeout(timeout);
            previous = 0;
            timeout = context = args = null;
        };

        return throttled;
    };

    // 构建一个防止"抖动"的函数，函数执行将延迟到最后一次调用函数 wait 毫秒之后再执行。
    // 比如可用在用户输入验证的情况，在保证用户已经停止输入 wait 毫秒之后再开始验证代码的执行。
    _.debounce = function(func, wait, immediate) {
        // 初始化定时器与返回结果变量
        var timeout, result;

        // 最后一次执行函数
        var later = function(context, args) {
            timeout = null;
            // 如果 args 参数存在，就直接执行 func 函数
            if (args) result = func.apply(context, args);
        };

        // 构建 防抖动 函数
        var debounced = restArguments(function(args) {
            // 如果在定时器等待执行 func 函数时又再次调用该函数时就清除该定时器并重新定时
            if (timeout) clearTimeout(timeout);
            // 如果 immediate 参数为 true ，那么会在执行该函数时定时器生效开始就调用该函数
            // 执行顺序为 (func() ----- func() ----- func())
            if (immediate) {
                // 在 timeout 为 null 时，声明一个临时变量，该变量是确定当前是否存在定时器
                var callNow = !timeout;
                // 定时最后一次等待 wait 毫秒后执行的函数
                timeout = setTimeout(later, wait);
                // 如果在上方 timeout 变量赋值之前不存在定时器，立即执行一次 func 函数，
                // 以便下次触发 debounced 函数时确定是否是首次触发该函数
                if (callNow) result = func.apply(this, args);
            } else {
                // 否则需要等待计时器生效之后再执行函数 func
                // 执行顺序为 ( ----- func() ----- func())
                timeout = _.delay(later, wait, this, args);
            }
            // 返回执行结果
            return result;
        });

        // 取消定时器
        debounced.cancel = function() {
            clearTimeout(timeout);
            timeout = null;
        };

        // 返回构建的函数
        return debounced;
    };

    // 将第一个 func 函数封装到 wrapper 里面，并把函数 func 作为第一个参数传给 wrapper 。
    // 这样可以让 wrapper 在 func 运行之前和运行之后执行代码，调整参数然后附有条件地执行。
    // var hello = function(name) { return "hello: " + name; };
    // hello = _.wrap(hello, function(func) {
    //     return "before, " + func("moe") + ", after";
    // });
    // hello();
    // => 'before, hello: moe, after'
    _.warp = function (func, wrapper) {
        return _.partial(wrapper, func);
    };

    // 返回一个新的传入函数执行后返回结果的否定版本
    // var isTrue = function(){
    //     return true;
    // };
    // var isFalsy = _.negate(isTrue);
    // isFalsy();
    // => false
    _.negate = function(predicate) {
        return function() {
            // 将 predicate 执行结果否定
            return !predicate.apply(this, arguments);
        };
    };

    // 将传入的所有函数组合成一个复合函数。
    // 也就是执行完之后把返回的参数传递给下一个函数执行；以此类推。
    // f(),g(),h() => f(g(h()));
    // var greet    = function(name){ return "hi: " + name; };
    // var exclaim  = function(statement){ return statement.toUpperCase() + "!"; };
    // var welcome = _.compose(greet, exclaim);
    // welcome('moe');
    // => 'hi: MOE!'
    _.compose = function() {
        // 声明变量缓存传入的参数集合
        var args = arguments;
        // 在循环开始的起始位置
        var start = args.length - 1;
        return function() {
            // 缓存起始索引
            var i = start;
            // 开始执行 start 函数并缓存结果
            var result = args[start].apply(this, arguments);
            // 循环遍历 args 函数集合，把上次函数执行结果传入当前函数，
            // 然后执行韩式得到结果并缓存
            while (i--) result = args[i].call(this, result);
            // 返回最后执行结果
            return result;
        };
    };

    // 创建一个函数，该函数在调用了 times 次之后才执行。
    // 处理某些异步方法，并且该异步方法都执行完成之后才会执行该方法创建的函数，
    // 在该情况下将特别有效。
    _.after = function(times, func) {
        // 返回一个函数，
        // 因为是闭包，所以在用该方法创建函数时传入的 times 参数将会一直存在
        return function() {
            // 判断该次执行是否为最后一次
            if (--times < 1) {
                return func.apply(this, arguments);
            }
        };
    };

    // 创建一个函数，该函数在 times 次之内调用才执行，超过次数之后会无效；
    // 当该函数执行次数已经达到时，最后一次的执行结果将被缓存并返回。
    _.before = function(times, func) {
        // 声明变量，以便用于函数每次执行结果的缓存
        var memo;
        // 闭包
        return function() {
            // 判断该次次数是否达到执行 func 函数的条件
            if (--times > 0){
                memo = func.apply(this, arguments);
            }
            // 如果次数达到，那么 func 变量将赋值为 null;
            if (times <= 1) func = null;
            // 返回已缓存的执行结果
            return memo;
        };
    };

    // 创建一个只能调用一次的函数。
    // 重复调用该方法创建的函数也没有效果；适合执行初始化函数。
    // 利用 _.partial 方法将 _.before 方法传入，
    // 然后传入初始默认参数，这个代码灵感真的佩服。
    _.once = _.partial(_.before, 2);

    // 返回传入的 function 的包装函数；
    // 该函数在调用时接受来自 startIndex 的所有参数，并将其收集到单个数组中。
    // 如果为确定 startIndex 参数，将通过查看传入 function 本身的参数数量来决定。

    // 类似 ES6 的 rest 参数语法
    // function f(a, b, ...theArgs) {
    //     // ...
    // }
    _.restArguments = restArguments;


    // Object Functions
    // ----------------

    // 因为在 IE8 的环境下，toString 属性被置为不可枚举的属性，根据该属性是否可枚举判断当前环境。
    // {toString: null}.propertyIsEnumerable('toString') 在低于 IE9 版本的执行环境会返回 false;
    var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
    // IE < 9 版本中不可用 for in 来枚举的 key 属性
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    var collectNonEnumProps = function(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;
        // 如果 constructor 是 Function 并且 constructor 的原型存在；
        // 根据 || 运算确定缓存结果。
        // 一个对象的原型可以 obj.constructor.prototype 获取，
        // 如果重写了 constructor 就无法照这种方式获取原型；则缓存 Object.prototype 。
        var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

        var prop = 'constructor';
        // 如果 obj 对象中存在 constructor 属性并且 keys 集合中不存在该元素，
        // 那么便把该属性添加到数组中
        if (has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

        // 倒序循环 nonEnumerableProps 集合
        while (nonEnumIdx--) {
            // 缓存每次循环的元素
            prop = nonEnumerableProps[nonEnumIdx];
            // obj 中是否存在当前循环元素的属性名称；
            // 并且 obj 当前遍历的属性不是继承原型链而是重写的
            // (保证自定义的相同属性(toString/valueOf...)也能被迭代出来)；
            // 同时，keys 集合中不存在当前遍历的元素名；
            if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
                // 同时满足以上条件就把该次遍历属性添加到 keys 数组
                keys.push(prop);
            }
        }
    };

    // 获取一个 Object 类型数据中的所有可枚举的属性名称集合
    _.keys = function(obj) {
        // 如果不是 Object 类型的数据就返回一个空数组。
        if (!_.isObject(obj)) return [];
        // 如果本地函数存在 Object.keys 方法就用本地函数实现。
        if (nativeKeys) return nativeKeys(obj);
        // 声明一个空数组
        var keys = [];
        // 遍历 obj 的属性，如果每次遍历的属性是 obj 对象中拥有的，
        // 那么就把当前属性名添加到 keys 数组
        for (var key in obj) if (has(obj, key)) keys.push(key);
        // 如果是在 IE < 9 的环境中执行该方法，
        // 那么就调用 collectNonEnumProps 方法搜索是否存在有自定义属性，
        // 并且该属性因为环境问题无法被遍历，如果有就添加到 keys 数组
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        // 返回结果
        return keys;
    };

    // 返回 obj 的所拥有的和继承的所有属性名称集合。
    _.allKeys = function(obj) {
        if (!_.isObject(obj)) return [];
        var keys = [];
        // 这里和 _.keys 方法有点区别，
        // 遍历的时候没有判断该属性是否为 obj 属性拥有的，把继承的属性也加入了集合
        for (var key in obj) keys.push(key);
        // _.keys 方法一样的逻辑
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // 返回 obj 所拥有属性值的集合。
    _.values = function(obj) {
        // 先获取 obj 属性名称集合
        var keys = _.keys(obj);
        // 缓存 keys 的长度
        var length = keys.length;
        // 声明一个相同长度的空数组
        var values = Array(length);
        // 遍历该数组
        for (var i = 0; i < length; i++) {
            // 给空数组的每个元素赋值为 boj 的属性值
            values[i] = obj[keys[i]];
        }
        return values;
    };

    // 格式化 obj 对象的属性与值并返回一个新集合。
    // 用于接口请求参数的格式化特别有效。
    // var obj = {
    //     key1: 'value1',
    //     key2: 'value2'
    // };
    // _.pairs(obj);
    // => [['key1', 'value1'], ['key2', 'value2']]
    _.pairs = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            // 格式化对象并转换为数组
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    // 将 obj 的 key: value 交换并返回一个新的对象。
    // var obj = {
    //     key1: 'value1',
    //     key2: 'value2'
    // };
    // _.invert(obj);
    // => {
    //     value1: 'key1',
    //     value2: 'key2'
    // }
    _.invert = function(obj) {
        var result = {};
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            // 交换属性的核心代码
            result[obj[keys[i]]] = keys[i];
        }
        return result;
    };

    // 获取 obj 对象中的所有值为 Function 类型的属性名称；
    // 并且返回已排序的集合，就是获取 obj 中所有的方法。
    _.function = _.methods = function(obj) {
        var names = [];
        for (var key in obj) {
            // 判断每个遍历元素的值类型是否为 Function
            if (_.isFunction(obj[key])) names.push(key);
        }
        // 调用 sort 方法排序再返回该集合
        return names.sort();
    };

    // 用于创建赋值函数的内部函数。
    // 浅拷贝的核心代码
    // keysFunc 一般为 _.keys 或者 _.allKeys
    var createAssigner = function(keysFunc, defaults) {
        return function(obj) {
            // 缓存所有参数的数量(参数集合的长度)
            var length = arguments.length;
            // 判断是否存在 defaults(默认参数) 参数，如果存在就把 obj 参数转换为 Object 类型
            if (defaults) obj = Object(obj);
            // 如果只传入了 obj 参数或者未传该参数，就返回 undefined，
            // 因为未传入 obj 参数，所以该参数相当于已经在函数内声明但又未赋值，
            // 那在未传入该参数的情况下该参数默认值为 undefined
            if (length < 2 || obj == null) return obj;
            // 循环遍历 arguments，初始循环从索引为 1 的元素开始
            for (var index = 1; index < length; index++) {
                // 缓存当前的元素
                var source = arguments[index],
                    // 执行 keysFunc 方法得到当前元素对象下的 key 集合
                    keys = keysFunc(source),
                    // 声明变量缓存已获取的 keys 集合长度
                    l = keys.length;
                // 循环 keys 集合
                for (var i = 0; i < l; i++) {
                    // 缓存 keys 集合的元素
                    var key = keys[i];
                    // 如果未设置 defaults 默认参数，
                    // 或者在 obj 对象中当前遍历的属性名称不存在，
                    // 就把 arguments 集合中除 obj 参数对象的其他对象的属性拷贝给 obj 对象。
                    // _.extent 和 _.extentOwn 或者 _.assign 执行时，defaults 为 false，直接做后续操作；
                    // _.default 执行时，defaults 为 true 并且该对象在属性不存在时，做后续操作；
                    if (!defaults || obj[key] === void 0) obj[key] = source[key];
                }
            }
            // 返回已经完成浅拷贝的对象
            return obj;
        };
    };

    // 将除第一个传入对象之外的其他参数对象的所有属性简单的复制到第一个对象上。
    // 复制是按顺序的，所以后续的属性可能会覆盖前面的属性。
    _.extent = createAssigner(_.allKeys);

    // 类似 _.extent 方法，但是只复制自己拥有的属性(不复制继承过来的属性)。
    _.extentOwn = _.assign = createAssigner(_.keys);

    // 返回第一个通过真值检测的 key 属性，否则返回 undefined。
    _.findKey = function(obj, predicate, context){
        // predicate 通过 cb() 方法进行转换
        predicate = cb(predicate, context);
        // 获取 obj 的属性集合并缓存，再临时声明一个 key 变量
        var keys = _.keys(obj), key;
        // 遍历属性集合
        for (var i = 0, length = keys.length; i < length; i++) {
            // 缓存当前遍历到的每个属性的名称
            key = keys[i];
            // 调用包装后的 predicate 方法进行真值检测，如果通过将返回属性名称
            if (predicate(obj[key], key, obj)) return key;
        }
    };

    // 内部的帮助函数，用于确定 obj 是否具有键为 key 的属性名
    var keyInObj = function(value, key, obj) {
        return key in obj;
    };

    // 返回一个 object 的副本，只过滤出 keys(有效键组成的数组) 参数指定的属性值；
    // 或者接受一个判断函数，指定挑选某些通过该函数检测的属性值。
    // _.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
    // => {name: 'moe', age: 50}
    // _.pick({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
    //     return _.isNumber(value);
    // });
    // => {age: 50}
    _.pick = restArguments(function(obj, keys) {
        // 声明一个空对象
        // 获取 iteratee 函数
        var result = {}, iteratee = keys[0];
        // 如果 obj 为 null，那就直接返回一个空对象
        if (obj == null) return result;
        // 如果 iteratee 为 Function 并且 keys 集合的长度大于 1，
        // 那么便调用 optimizeCb 方法包装一次 iteratee 函数
        if (_.isFunction(iteratee)) {
            if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
            // 将 keys 重置为 obj 的所有属性名称集合
            keys = _.allKeys(obj);
        } else {
            // 如果不为 Function，
            // 那么 iteratee 就为查找 obj 对象中是否存在某些属性的方法
            iteratee = keyInObj;
            // 证明 keys 经过 restArguments 包装后的集合为多维数组，
            // 将 keys 集合内所有数组展开，得到一个完整的一维数组
            keys = flatten(keys, false, false);
            // obj 转换为 Object 类型
            obj = Object(obj);
        }
        // 遍历 keys 集合
        for (var i = 0, length = keys.length; i < length; i++) {
            // 缓存当前遍历的属性名称
            var key = keys[i];
            // 获取当前 key 在 obj 中的 value
            var value = obj[key];
            // 通过真值检测后，把该属性赋值给 result 对象
            if (iteratee(value, key, obj)) result[key] = value;
        }
        // 返回结果对象
        return result;
    });

    // 返回一个 object 副本，只过滤除去 keys(有效键组成的数组) 参数指定的属性值；
    // 或者接受一个判断函数，指定忽略某些或某个 key。
    // 逆向的 _.pick 方法。
    // _.omit({name: 'moe', age: 50, userid: 'moe1'}, 'userid');
    // => {name: 'moe', age: 50}
    // _.omit({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
    //     return _.isNumber(value);
    // });
    // => {name: 'moe', userid: 'moe1'}
    _.omit = restArguments(function(obj, keys) {
        // 因为 restArguments 将会返回一个封装函数，
        // 这个函数传入的除第一个参数外所有参数都会被集合成一个数组传给执行该函数时传入的 func，
        // 所以 keys 是个数组。
        // 获取 iteratee 参数并缓存。
        var iteratee = keys[0], context;
        // 判断 iteratee 是否为 Function
        if (_.isFunction(iteratee)) {
            // 将 iteratee 执行结果否定
            iteratee = _.negate(iteratee);
            // 如果执行 _.omit 函数时传入的参数大于 3 ，那么确定也传入了上下文
            if (keys.length > 1) context = keys[1];
        } else {
            // 如果执行 _.omit 函数时传入的参数有多个数组，
            // keys 参数将会变成多维数组，那么在这里展开所有数组成为一维数组
            keys = _.map(flatten(keys, false, false), String);
            // 如果 iteratee 不是 Function 类型，将给该变量赋值一个函数；
            // 该函数的作用是确定传入的 key 不存在 keys 数组集合中。
            iteratee = function(value, key) {
                return !_.contains(keys, key);
            };
        }
        // 执行 _.pick 方法，指定挑选出通过 iteratee 函数检测后的属性，
        // 并返回通过该检测函数的属性集合。
        // 在该处的作用是忽略指定 key 生成的对象集合。
        return _.pick(obj, iteratee, context);
    });

    // 用传入的 defaults 对象中的属性填充到 object 中的 undefined 属性，
    // 并且返回这个 object。
    _.defaults = createAssigner(_.allKeys, true);

    // 根据传入的原型创建一个新对象，如果传入了 props ，可将 props 的属性附加给新对象。
    // var moe = _.create(Object.prototype, {name: "Moe"});
    _.create = function(prototype, props) {
        // 根据传入的原型生成一个新的对象
        var result = baseCreate(prototype);
        // 如果传入了 props 对象，将 props 的属性复制给 result 对象。
        if (props) _.extendOwn(result, props);
        // 返回创建的新对象
        return result;
    };

    // 克隆一个传入的 object 对象或者数组。
    _.clone = function(obj) {
        // 如果 obj 的类型不是 Object ，那么将直接返回传入的参数。
        if (!_.isObject(obj)) return obj;
        // 如果 obj 是数组，则执行数组的 slice 方法，创建一个新的数组并返回；
        // 否则执行 _.extent 方法，将 obj 的属性复制到一个新的空对象上达成克隆效果。
        // 这个方法好简洁，佩服作者。
        return _.isArray(obj) ? obj.slice() : _.extent({}, obj);
    };

    // 将 obj 作为参数调用 interceptor 函数。
    // 如果链式调用该函数为了不断链，该函数执行后将返回 obj 本身。
    _.tap = function(obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // 判断传入的 attrs 对象中的键和值是否存在于 object 对象中。
    _.isMatch = function(object, attrs) {
        var keys = _.key(attrs), length = keys.length;
        // 如果未传入 object 或者 object 为 falsy，那么将直接返回 !length
        if (object == null) return !length;
        // 将传入的 object 初始化一次
        var obj = Object(object);
        // 循环遍历 keys 集合
        for (var i = 0; i < length; i++) {
            // 缓存该次遍历 keys 的属性名称
            var key = keys[i];
            // arrts 对象中该属性的 value 值不存在 obj 对象中；
            // 或者该属性不存在于 obj 对象，返回 false
            if (arrts[key] !== obj[key] || !(key in obj)) return false;
        }
        // 通过检测将返回 true
        return true;
    };

    // _.isEqual 的内部递归比较函数
    var eq, deepEq;
    eq = function(a, b, aStack, bStack) {
        // a 对象与 b 对象相等就返回 true
        // 因为相同的对象是相等的。0 === -0 ，但是它们不相同
        if (a === b) return a !== 0 || 1 / a === 1 / b;
        // a 和 b 其中一个为 false，将直接返回 false
        // null 或者 undefined 只等于它本身(严格比较)
        if (a == null || b == null) return false;
        // 防止传入的为 NaN ，因为 NaN 是等价的，但是自身又反等的 (NaN !== NaN) === true
        if (a !== a) return b !== b;
        // a 对象的数据类型
        // 原始检查
        var type = typeof a;
        // 如果 a 不为 Function 并且不为 Object
        // 同时 b 不为 Object，则直接返回 false
        if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
        // 指定 deepEq 方法并返回结果
        return deepEq(a, b, aStack, bStack);
    };

    // 同上，_.isEqual 内部的递归比较函数
    deepEq = function(a, b, aStack, bStack) {
        // 如果 a 或者 b 为 _(underscore) 的实例
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;
        // 在 a 的上下文环境执行 toString 方法
        var className = toString.call(a);
        // 比较 Class 名称，
        // 如果 b 的上下文环境执行的 toSting 方法返回结果与 a 不想等，则返回 false
        if (className !== toString.call(b)) return false;
        // switch 比较 [[Class]] 名称
        switch  (className) {
            // 字符串、数值、正则表达式、日期和布尔值按值比较。
            case '[object RegExp]':
            case '[object String]':
                // 字面量语法('')与其对象初始化(new String(''))是等价的；
                // 因此，"5" 相当于 new String('5');
                // var a = new RegExp(/a/i);
                // '' + a === '/a/i';
                // => true
                // 不管什么类型的数据与空字符串相加都将调用该对象的 toString 方法，
                // 正则表达式就是按照该方法强制按照字符串形式比较('' + /a/i === '/a/i')
                return '' + a === '' + b;
            case '[object Number]':
                // 如果是 NaN 的数据，与自身不相等，将否定自身相等判断返回 true
                if (+a !== +a) return +b !== +b;
                // 对其他数值执行 egal 比较
                // 因为 0 === -0，虽然在代码当中相等，但严格来讲应该不相等；
                // 所以在 a === 0 的时候将用 1 除以该数字得到 ±Infinity；
                // 利用(Infinity !== -Infinity)来判断 +0 和 -0 是否相等。
                return +a === 0 ? 1 / +a === 1 / b : +a === +b;
            case '[object Date]':
            case '[object Boolean]':
                // 将时间和布尔值强制为数字基元值。
                // 用毫秒表示法比较日期，毫秒表示为 NaN 的无效日期是不相等的，所以不作 NaN 与自身的判断；
                // 布尔值比较就强制转为数值类型，true 为 1，false 为 0。
                // 在 Date 类型和 Boolean 类型的数据前用一元运算符(+)将会默认执行该类型对象的 vlaueOf 方法。
                return +a === +b;
            case '[object Symbol]':
                // 如果是 Symbol 类型的数据就直接在对应的上下文执行 valueOf 方法对执行结果判断
                return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
        }

        // class 名称为 Array 的情况
        var areArrays = className === '[object Array]';
        // 在非 Array 类型时
        if (!areArrays) {
            // 判断 a 或者 b 都不是 object 类型对象，那么就返回 false
            if (typeof a != 'object' || typeof b != 'object') return false;

            // 具有不同构造函数的对象不是等效的，但来自不同框架的 Object 或 Array 是等效的。
            var aCtor = a.constructor, bCtor = b.constructor;
            // a 与 b 的构造函数不相同，并且 a.constructor 类型不是 Function 同时 a.constructor 是 a.constructor 的实例；
            // 再 b.constructor 类型是 Function 然后 b.constructor 是 b.constructor 的实例；
            // 最后 a 和 b 对象或原型链中都存在 constructor 属性；该判断完成将返回 false
            if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                                     _.isFunction(bCtor) && bCtor instanceof bCtor)
                                && ('constructor' in a && 'constructor' in b)) {
                return false;
            }
        }
        // 假设循环结构相等。检测循环结构算法改编自ES 5.1第15.12.3节

        // 初始化遍历对象的堆栈。因为只需要用来比较对象和数组，所以在这里声明。
        aStack = aStack || [];
        bStack = bStack || [];
        var length = aStack.length;
        // 线性搜索。性能与唯一嵌套的数量成反比。
        while (length--) {
            // 递归调用该函数时判断在堆栈中该次遍历元素是否与比较对象相等，
            // 相等时将开始判断 b 堆栈中对应的位置，返回 b 堆栈当前遍历元素与 b 对象的判断结果
            if (aStack[length] === a) return bStack[length] === b;
        }

        // 将第一个对象添加到遍历对象的堆栈中
        aStack.push(a);
        bStack.push(b);

        // 递归的比较对象和数组
        if (areArrays) {
            // 数组的情况
            length = a.length;
            // 比较数组长度确定是否需要进行深度比较
            if (length !== b.length) return false;
            // 循环调用递归进行深度比较。
            while (length--) {
                if (!eq(a[length], b[length], aStack, bStack)) return false;
            }
        } else {
            // 深入比较对象
            // 获取比较对象的键集合
            var keys = _.keys(a), key;
            length = keys.length;
            // 根据 键集合 长度判断是否需要进行深度比较对象
            if (_.keys(b).length !== length) return false;
            // 循环调用递归进行深度比较。
            while (length--) {
                // 深入比较对象中每个成员
                key = keys[length];
                // 如果 b 中存在与 a 相同的 key 再执行递归，以节省性能
                if (!(has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
            }
        }
        // 递归完成时，从遍历的堆栈中移除第一个比较的对象。
        // 这里是倒序循环的，应该从数组的末尾开始移除。
        aStack.pop();
        bStack.pop();
        return true;
    };

    // 执行两个对象之间的优化深度比较，确定他们是否应被视为相等。
    _.isEqual = function(a, b) {
        return eq(a, b);
    };

    // 检查传入的数据是否为空
    // 如果 obj 不包含任何属性(没有可枚举的属性)，返回 true；
    // 对于类数组、字符串或者数组的情况下，如果 length 属性为 0 ，那么该函数检查结果也为 true
    _.isEmpty = function(obj) {
        // 未传入数据的情况直接返回 true
        if (obj == null) return true;
        // 如果是类数组类型，并且是 Array 或者 String 或者 Arguments 数据，长度为 0 时将会返回 true
        if (isArrayLike(obj) && (_.isArray(obj) ||
                                 _.isString(obj) ||
                                 _.isArguments(obj))) return obj.length === 0; // 这里不知到可不可以用 !!obj.length
        // 为 Object 的情况先获取 obj 中的所有属性名称集合，
        // 然后再获取集合长度，确定是否存在属性
        return _.keys(obj).length === 0;
    };

    // 传入的对象是否为 Element 对象
    _.isElement = function(obj) {
        // 根据 Element 对象的 nodeType 值来判断该 obj 是否为 Element
        return !!(obj && obj.nodeType === 1);
    };

    // 传入的对象是否为 Array 对象
    // 如果本地环境运行，直接调用本地的方法
    _.isArray = nativeIsArray || function(obj) {
        // 根据 class 名称判断数据类型
        return toString.call(obj) === '[object Array]'
    };

    // 判断传入对象是否为 Object 对象
    _.isObject = function(obj) {
        // typeof 获取 obj 的类型字符串
        var type = typeof obj;
        // null 在 JavaScript 中是特殊的 object 类型
        // obj 为 Function 或者 obj 为 object 类型并且 obj 不为 null 时，
        // 返回结果为 true
        return type === 'function' || type === 'object' && !!obj;
    };

    // 循环遍历生成 isType 方法：
    _.each(['Arguments',    // isArguments,
            'Function',     // isFunction,
            'String',       // isString,
            'Number',       // isNumber,
            'Date',         // isDate,
            'RegExp',       // isRegExp,
            'Error',        // isError,
            'Symbol',       // isSymbol
            'Map',          // isMap,
            'WeakMap',      // isWeakMap,
            'Set',          // isSet,
            'WeakSet'       // isWeakSet
    ], function(name) {
        _['is' + name] = function(obj) {
            // 根据 class 名称判断数据类型
            return toString.call(obj) === '[object ' + name + ']';
        }
    });

    // 在浏览器 IE < 9 的版本中，没有任何可检查的 arguments 类型；
    if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
            // 判断 obj 中是否存在 'callee' 属性来确定是否为 Arguments 类型
            return has(obj, 'callee');
        };
    }

    // 根据需要优化 isFunction 方法。
    // 在旧的 V8、IE 11、Safari 8 和 PhantomJS 中解决某些类型的错误。
    var nodelist = root.document && root.document.childNodes;
    // RegExp 和 document.childNodes 类型不为 function 并且 Int8Array 不为 object，
    // 就需要优化 isFunction 方法
    if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
        _.isFunction = function(obj) {
            // 直接判断类型是否为 function
            return typeof obj == 'function' || false;
        }
    }

    // 给定的对象是否为限数
    _.isFinite = function(obj) {
        return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj))
    };

    // 给定的对象是否为 NaN
    _.isNaN = function(obj) {
        return _.isNumber(obj) && isNaN(obj);
    };

    // 给定的对象是否为 null
    _.isNull = function(obj) {
        return obj === null;
    };

    // 给定的对象是否为 undefined
    _.isUndefined = function(obj) {
        return obj === void 0;
    };

    // 对象是否包含给定的键。
    // _.has({a: 1, b: {d: 4, e: {f:0}}, c: 3}, 'a')
    // => true
    // _.has({a: 1, b: {d: 4, e: {f:0}}, c: 3}, ['b','e','f'])
    // => true
    _.has = function(obj, path) {
        // 不为 Array 类型对象时
        if (!_.isArray(path)) {
            // 判断 obj 对象内是否存在 path 属性，根据结果返回
            return has(obj, path);
        }
        var length = path.length;
        for (var i = 0; i < length; i++) {
            var key = path[i];
            // obj 不为 null 或者 obj 不存在该 key 属性时，返回 false
            // 使用 hasOwnProperty 函数的一个安全引用，以防意外覆盖。
            if (obj == null || !hasOwnProperty.call(obj, key)) {
                return false;
            }
            // 根据 path 路径查找下一级对象中的属性
            obj = obj[key];
        }
        return !!length;
    };

    // Utility Functions
    // -----------------

    // 放弃 Underscore 的控制变量 `_`，返回 Underscore 对象的引用
    _.noConflict = function() {
        root._ = previousUnderscore;
        return this;
    };

    // 传入什么值便返回相同的值。
    // 在 cb 函数中当作默认的迭代器返回。
    _.identity = function(value) {
        return value;
    };

    // 创建一个函数，这个函数返回相同的值用来作为 _.constant 的参数。
    _.constant = function(value) {
        return function() {
            return value;
        };
    };

    // 无论传入什么参数都返回 undefined。
    _.noop = function(){};

    // 传入对象/数组的 key 路径数组/索引，返回一个函数，该函数会返回指定属性。
    // path 可以为一个简单的 key 字符串；
    // 或者指定为对象或数组索引的数组，用于深度获取属性。
    _.property = function(path) {
        // 如果不是 Array 类型的数据
        if (!_.isArray(path)) {
            return shallowProperty(path);
        }
        // path 是 Object 类型时将调用深获取
        return function(obj) {
            return deepGet(obj, path);
        }
    };

    // _.property 的反向操作，先获取对象再传入 key 或者索引；
    // 返回一个函数，该函数将返回提供的属性的值
    _.propertyOf = function(obj) {
        if (obj == null) {
            return function(){};
        }
        return function(path) {
            // 根据传入 path 类型确定如何获取指定属性
            return !_.isArray(path) ? obj[path] : deepGet(obj, path);
        };
    };

    // 返回一个真值检测函数，
    // 这个函数执行后会给你一个用来辨别给定的对象是否匹配 attr 指定 key: value 的结果
    // 用来当断言函数是很有效的。
    // var ready = _.matcher({selected: true, visible: true});
    // var readyToGoList = _.filter(list, ready);
    _.matcher = _.matches = function(attrs) {
        // 将 attrs 的所有属性复制给一个空对象
        attrs = _.extentOwn({}, attrs);
        return function(obj) {
            // 判断 attrs 对象的 key: value 是否与传入对象的相等
            return _.isMatch(obj, attrs);
        };
    };

    // 调用给定的 iteratee 函数 n 次，每一次调用 iteratee 传递 index 参数。
    // 每次调用 iteratee 函数返回值集合成一个数组并返回
    _.times = function(n, iteratee, context) {
        // 确定调用次数，声明一个与次数相同长度的空数组，
        // 不管 n 传入什么类型，保证获得数值类型，不会抛出错误
        var accum = Array(Math.max(0, n));
        // 包装 iteratee 函数
        iteratee = optimizeCb(iteratee, context, 1);
        // 开始根据次数循环调用 iteratee 函数将 index 作为参数传入，
        // 并将返回值存入数组
        for (var i = 0; i < n; i++) accum[i] = iteratee(i);
        return accum;
    };

    // 返回一个给定范围的随机整数；
    // 如果只传递一个参数，那么将返回 0 和这个参数之间的整数。
    _.random = function(min, max) {
        // 如果未传入最大范围，将 min 作为最大范围，
        // 最小范围置为 0
        if (max == null) {
            max = min;
            min = 0;
        }
        // Math.floor 向下取整，保证获得的是个整数
        // Math.random 获得一个 0 - 1 的随机数与取值范围 +1 的结果相乘，
        // 因为要执行向下取整的函数，所以为了保证边界值也能获取到需要在得到范围区间时 +1
        return min + Math.floor((Math.random() * (max - min + 1)));
    };

    // 获取当前时间戳
    _.now = Date.now || function() {
        return new Date().getTime();
    };

    // html 转义字符对照表
    var escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;'
    };
    // 交换对照表中的 key: value，得到一个逆向对照表
    var unescapeMap = _.invert(escapeMap);

    // 用于将 HTML 字符串转义和取消转义的函数。
    var createEscaper = function(map) {
        // 根据 map 创建对照表属性查询函数
        var escaper = function(match) {
            return map[match];
        };
        // 创建正则表达式字符串，将 map 的 keys 集合转为字符串并用 | 间隔
        var source = '(?:' + _.keys(map).join('|') + ')';
        // 对象初始化正则表达式
        var testRegexp = RegExp(source);
        // 对象初始化正则表达式，传入全局标记 g ，表示尽可能多的匹配传入字符
        var replaceRegexp = RegExp(source, 'g');
        return function(string) {
            // 未传入 string 返回空字符串，将传入的数据类型强制装换为 String
            string = string == null ? '' : '' + string;
            // 返回匹配替换结果
            return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
        };
    };

    // 编码
    _.escape = createEscaper(escapeMap);
    // 解码
    _.unescape = createEscaper(unescapeMap);

    // 获取传入的 obj 对象中指定的属性值，
    // 如果获取的属性值为函数，那么在 obj 上下文环境下执行该函数并返回结果；
    // 如果传入了 fallback 参数，该参数为默认值，在获取不到指定属性时将返回该默认值，
    // 该参数的类型如果为 Function 时，将在 obj 上下文环境中执行该函数并返回结果。
    _.result = function(obj, path, fallback) {
        // 指定获取的属性路径，如果该参数不为数组类型时将转换为数组
        if (!_.isArray(path)) path = [path];
        // 缓存属性路径的长度
        var length = path.length;
        // 如果该长度为 0 时，说明没有需要获取的属性，
        // 将判断初始值的类型，根据类型确定是执行函数还是直接返回该默认值
        if (!length) {
            return _.isFunction(fallback) ? fallback.call(obj) : fallback;
        }
        // 遍历属性路径集合
        for (var i = 0; i < length; i++) {
            // 缓存每次遍历得到的属性名称在 obj 对象中的值，
            // obj 对象不存在时，直接将变量赋值为 undefined
            var prop = obj == null ? void 0 : obj[path[i]];
            // 如果该属性值不存在，将 prop 变量缓存为默认值；
            // i 变量赋值为 length ，终止循环。
            if (prop === void 0) {
                prop = fallback;
                i = length;
            }
            // 根据获取的属性内容确定操作 prop 变量的方式，并将结果赋值给 obj 变量
            obj = _.isFunction(prop) ? prop.call(obj) : prop;
        }
        // 返回结果
        return obj;
    };

    // 返回一个全局性的唯一的值，可用作 DOM 的 id 属性；
    // 可以根据需求传入前缀或者命名空间
    var idCounter = 0;
    _.uniqueId = function(prefix) {
        // 将 idCounter 自增并转换为 String 数据
        var id = ++idCounter + '';
        // 如果传入了前缀，则将前缀与 id 叠加；否则只返回 id值
        return prefix ? prefix + id : id;
    };

    // Underscore 提供的模版 ERB 分隔符格式。
    // 可自定义该模版格式。
    _.templateSettings = {
        //<% ... %> 模版中间可传入 Js 代码并会执行该代码
        evaluate: /<%([\s\S]+?)%>/g,
        // <%= ... %> 模板中间可传入变量
        interpolate: /<%=([\s\S]+?)%>/g,
        // <%- ... %> 模板中间的字符串进行 HTML 转义
        escape: /<%-([\s\S]+?)%>/g
    };

    // _.templateSettings.interpolate = {
    //     interpolate: /\{\{(.+?)\}\}/g
    // };

    // 在自定义 templateSettings 时，
    // 如果不想定义一个解释、计算或转义的 RegExp，
    // 那么需要一个不匹配的表达式。
    var noMatch = /(.)^/;

    // 某些字符串需要转义，以便可以放入字符串文字中。
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

    // 将 JavaScript 模版编译为可用于页面呈现的函数，
    // 对于通过 JSON 数据源生成复杂的 HTML 并呈现出来的操作非常有用。
    // 模板函数可以使用 <%= … %> 插入变量，也可以用 <% … %> 执行任意的 JavaScript 代码。
    // 如果希望插入一个值，并让其进行HTML转义，可以使用<%- … %>。
    // 当要给模版函数赋值的时候，可以传递一个含有与模板对应属性的 data 对象。
    _.template = function(text, settings, oldSettings) {
        // 如果未传入自定义配置项，那么将之前的配置项作为当前配置
        if (!settings && oldSettings) settings = oldSettings;

        // 对象初始化声明一个全局贪婪匹配的正则表达式，
        // 当配置对象中存在配置时就传入该配置的正则表达式，
        // 否则该配置为不匹配任何字符的表达式。
        // 每个配置都转化为字符串形式并集合为一整个表达式。
        var matcher = RegExp([
            (settings.escape || noMatch).source,
            (settings.interpolate || noMatch).source,
            (settings.evaluate || noMatch).source
        ].join('|') + '|$', 'g');

        var index = 0;
        var source = "__p+=";
        // escape = HTML 转义
        // evaluate = Js 代码
        // interpolate = 获取变量
        // text 调用 replace 方法，传入匹配表达式，
        // 如果该方法第二个参数为函数，该函数为回调函数，每个匹配都将调用该回调函数，
        // 该回调函数返回参数顺序为 匹配表达式字符串，传入表达式的匹配顺序
        // var matcher = RegExp([
        //         (settings.escape || noMatch).source,      => 1
        //         (settings.interpolate || noMatch).source, => 2
        //         (settings.evaluate || noMatch).source     => 3
        //     ].join('|') + '|$', 'g');
        // 最后一个参数为匹配的字符在 text 的位置
        text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
            // 将匹配的字符串转义一下，拼接该匹配到 source 变量
            source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
            // 匹配长度与偏移量相加得到当前匹配字符串的末尾位置，下次匹配时以该索引为起始位置
            index = offset + match.length;

            // 根据匹配格式确定拼接不同的字符
            // \n 为换行符
            if (escape) {
                // 匹配到需要 HTML 转义时，判断该变量不为 null 时，直接拼接 _.escape 方法并将 __t 变量作为参数
                source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
            } else if (interpolate) {
                // 匹配到该格式功能为获取变量时，将该匹配直接赋值给 __t ，如果该变量不为 null 时再返回该变量
                source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
            } else if (evaluate) {
                // 匹配需到要执行的 Js 代码时，将该 Js 代码最为字符串拼接到 source 变量，
                // 注意：需要给每个 Js 代码前拼接一个分号，以便解析该字符串时确定 Js 代码断句；
                // 在 Js 代码前后都拼接一个换行符，该作用是减少语法错误
                source += "';\n" + evaluate + "\n__p+='";
            }
            // Adobe 虚拟机需要返回匹配以产生正确的偏移量。
            return match;
        });
        source += "';\n";

        // 如果未指定变量，利用 with 函数将数据值放在本地作用域中。(在开发时并不推荐 with 方法生成新的作用域)
        if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

        // 声明全局变量 __t, __p, __j 和一个公共方法 print ，
        // 该公共方法传入的参数集合将被拆分为字符串，在每个字符串之间用一个空字符串间隔
        // 将 source 变量的值也拼接到这些声明方法之后再返回 __p 变量
        // __p 变量就是所有匹配解析字符串编译之后再组合的字符串。
        source = "var __t,__p='',__j=Array.prototype.join," +
            "print=function(){__p+=__j.call(arguments,'');};\n" +
            source + "return __p;\n";

        // 声明一个 render 变量
        var render;
        // try catch 捕获错误，并抛出错误信息堆栈
        try {
            // 初始化声明一个 Function 对象，
            // 并按顺序传入配置参数(根据是否存在该配置项确定该参数的值)、_ 参数(Underscore 对象) 和 source
            render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
            // 错误对象添加当前错误来源属性
            e.source = source;
            // 抛出错误信息
            throw e;
        }

        // 声明 template 函数，在该函数上下文环境中执行 render 函数
        var template = function(data) {
            return render.call(this, data, _);
        };

        // 根据配置确定 argument 参数。
        var argument = settings.variable || 'obj';
        // 提供已编译的源代码以便预编译。
        // 将 template 函数对象新增一个 source 属性，提供预编译功能。
        template.source = 'function(' + argument + '){\n' + source + '}';

        return template;
    };

    // 提供链式操作，链接包装好的 Underscore 对象。
    _.chain = function(obj) {
        var instance = _(obj);
        instance._chain = true;
        // 返回一个封装对象
        return instance;
    };

    // OOP
    // ---------------
    // 如果将 Underscore 作为函数调用，返回可使用 OO 模式的包装对象。
    // 这个包装器保存所有 Underscore 函数的更改版本，包裹的对象可以使用用链式操作。

    // 帮助程序函数继续链接中间结果
    var chainResult = function(instance, obj) {
        // 根据传入的 instance 对象的 _chain 属性判断是否继续链接
        return instance._chain ? _(obj).chain() : obj;
    };

    // 向 Underscore 对象添加自定义函数。
    // 混合模式
    // 传入自定义的函数对象集合
    _.mixin = function(obj) {
        // 遍历 obj 对象中所有值为 Function 的属性。
        _.each(_.function(obj), function(name) {
            // 将 obj 中每个 Function 属性添加给 Underscore 对象，
            // 并且缓存当前属性值
            var func = _[name] = obj[name];
            // 将该属性添加到 Underscore 的原型对象里
            _.prototype[name] = function() {
                // 获取 Underscore 对象的 _wrapped 属性，并用数组包裹
                // 该属性为调用 _(obj) 方法时传入的 obj 参数
                var args = [this._wrapped];
                // 将 arguments 添加到 args 数组末尾
                push.apply(args, arguments);
                // 让 func 函数在 Underscore 上线文环境中执行并且 args 数组作为参数传入。
                // 顺便调用帮助方法，让该自定义方法实现链式操作功能
                return chainResult(this, func.apply(_, args));
            };
        });
        // 返回 Underscore 对象
        return _;
    };

    // 将所有 Underscore 函数添加到包装对象中，并实现链式功能
    _.mixin(_);

    // 将所有改变源数组对象的函数添加到 Underscore 对象中。
    _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            // 将执行 _(obj) 方法时传入的 obj 挂载到 Underscore 对象的 _wrapped 属性
            var obj = this._wrapped;
            // 将当前遍历数组中 Array 对象的方法在 obj 对象的上下文环境中执行并返回结果。
            method.apply(obj, arguments);
            // 当方法名称为 shift 或者 splice 并且 obj 的长度为 0 时，
            // 删除 obj 对象索引为 0 的属性;
            // 该段代码为了兼容在 IE < 9 和 IE 兼容模式下的 bug。
            // 当类数组在 Underscore 对象使用 _(...) 链式结构时，
            // 不能通过 shift 和 splice 方法移除索引为 0 的值
            if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
            // 调用链式帮助方法并返回结果
            return chainResult(this, obj);
        };
    });

    // 将访问源数组的函数添加到 Underscore 对象中。
    _.each(['concat', 'join', 'slice'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            // 调用链式帮助方法，让添加的函数能接受链式操作。
            return chainResult(this, method.apply(this._wrapped, arguments));
        };
    });

    // 从已包装和链接的对象中获取结果。
    _.prototype.value = function() {
        return this._wrapped;
    };

    // 为隐式操作提供代理方法。
    // 比如 一元运算符和JSON字符串化
    _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

    // '' + _(obj)
    _.prototype.toString = function() {
        return String(this._wrapped);
    };

    // AMD 注册是为了 AMD 加载器的兼容性而进行的，
    // 后者可能不会在模块上强制执行转下一个语义。
    // 尽管 AMD 注册一般做法是匿名的，因为 Underscore 注册为一个命名模块，
    // 就像 jQuery 一样，Underscore 是一个基本库，非常流行，可以捆绑到第三方库中，
    // 但不是 AMD 加载请求的一部分。
    // 当在加载程序请求外部调用匿名 define() 时，这些情况可能会发生错误。
    if (typeof define == 'function' && define.amd) {
        // 为 Underscore 对象声明一个模块名称。
        define('underscore', [], function() {
            return _;
        });
    }
}());










