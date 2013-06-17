/*********************************************************************
 *                           Define                                 *
 **********************************************************************/
/**
 *  定义一个ViewModel对象
 *
 *  Ｍ，即model，一个普通的ＪＳ对象，可能是后台传过来的，也可能是直接从ＶＭ中拿到，即ＶＭ.$json。
 *  V， 即View，HTML页面，通过绑定属性或插值表达式，呈现数据，处理隐藏，绑定事件或动画等各种交互效果。Ｖ只与ＶＭ打交道。
 *
 *  ＶＭ，即ViewModel，我们通过avalon.define("xxx", function(vm){vm.firstName = "正美"})，
 *      这里的vm是一个临时的对象，用于定义，真正的ＶＭ是avalon.define方法的返回值。
 *      它上面的$json属性就是Ｍ，可以见ＶＭ处于一切的核心。我们对ＶＭ的每一个操作，都会向上同步到Ｖ，向下同步到Ｍ。
 *      并且出于节能低碳起见（减少对象的创建），我们在生成Ｍ时，会重复利用ＶＭ中的一些属性，比如vm的某个属性是一个对象，
 *      那么这个对象会直接搬到$json中。若它是一个数组，它里面每个元素为对象，这些数组或对象都会直接$json中去，
 *      当然有时会修复一下（比如计算属性会转换一个简单的数据类型）
 *
 *      经过内部的转换，它的属性与方法会换胎换骨，产出以下东西。
 *      1 监控属性：定义时为一个简单的数据类型，如undefined, string, number, boolean。
 *      2 计算属性：定义时为一个最多拥有get，set方法的对象（get方法是必需的），注意，get, set里面的this不能改为vm，框架内部会帮你调整好指向。
 *      3 监控数组：定义时为一个数组
 *      4 普通属性或方法：我们可以在vm里面设置一个$skipArray数组，里面装着你不想处理的方法与属性名。
 *
 */
avalon.define = function(name, deps, factory) {
    //转化数组
    var args = [].slice.call(arguments);

    if (typeof name !== "string") {
        name = generateID();
        args.unshift(name);
    }

    //如果第二个参数不是数组
    //转换 avalon.define("on",fn); -> avalon.define("on",[],fn);
    if (!Array.isArray(args[1])) {
        args.splice(1, 0, []);
    }
    //依赖列表
    deps = args[1];

    //必须第3个参数是回函
    if (typeof args[2] !== "function") {
        avalon.error("factory必须是函数");
    }

    //取出定义的VM
    factory = args[2];

    var scope = {
        $watch: noop
    };
    deps.unshift(scope);//置前
    factory(scope); //收集用户写的定义 ,因为是对象所以能引用到内部的值
    var model = modelFactory(scope); //转为一个ViewModel
    stopRepeatAssign = true;
    deps[0] = model;
    //精妙的思路
    /*
         用户定义的函数
         vm.xxx = 1;
         vm.fullName = fucntion(){
                vm.xxxx       ->这时候内部引用不对了 ＶＭ还是指向原来的普通ＪＳ对象，而不是真正的ＶＭ
                                 所以需要apply一次，改变
         }
         所以把方法执行一次把内部引用换给model
         因为转换了模型关系，所以监控属性与计算属性都会有对应的set get操作了
         但是由于stopRepeatAssign return 阻止了，防止重复赋值
     */
    factory.apply(0, deps); //重置它的上下文   ０只是为节约比特数
    deps.shift();
    stopRepeatAssign = false;
    model.$id = name;
    return avalon.models[name] = model;
};

function updateViewModel(a, b, isArray,c) {
    if (isArray) {
        var an = a.length,
            bn = b.length;
        if (an > bn) {
            a.splice(bn, an - bn);
        } else if (bn > an) {
            a.push.apply(a, b.slice(an));
        }
        var n = Math.min(an, bn);
        for (var i = 0; i < n; i++) {
            a.set(i, b[i]);
        }
    } else {
        for (var i in b) {
            if (b.hasOwnProperty(i) && a.hasOwnProperty(i) && i !== "$id") {
                a[i] = b[i];
                c[i] = b[i];
            }
        }
    }
}

var systemOne = avalon.oneObject("$index,$remove,$first,$last");

//默认的内部处理方法（转换VM时不处理）
var watchOne = avalon.oneObject("$json,$skipArray,$watch,$unwatch,$fire,$events");

function modelFactory(scope) {
    //@第一层作用域
    var skipArray = scope.$skipArray, //要忽略监控的属性名列表
        model = {},
        Descriptions = {}, //收集内部用于转换的对象
        json = {},  //收集原始的定义
        callSetters = [],
        callGetters = [],
        VBPublics = Object.keys(watchOne); //用于IE6-8
    //跳过处理
    skipArray = Array.isArray(skipArray) ? skipArray.concat(VBPublics) : VBPublics;


    forEach(scope, function(name, value) {
        //@第二层作用域
        if (!watchOne[name]) {
            json[name] = value;
        }
        //判断类型
        var valueType = avalon.type(value);

        if (valueType === "Function") {
            // 第一个就是$watch" 被重复假如到列表了
            VBPublics.push(name); //函数无需要转换
        } else {
            //字符串如果在排除列表中
            if (skipArray.indexOf(name) !== -1) {
                return VBPublics.push(name);
            }
            if (name.charAt(0) === "$" && !systemOne[name]) {
                return VBPublics.push(name);
            }
            var accessor, oldArgs;
            //转换计算属性：
            // 定义时为一个最多拥有get，set方法的对象（get方法是必需的），
            // 注意，get, set里面的this不能改为vm，框架内部会帮你调整好指向。
            if (valueType === "Object" && typeof value.get === "function" && Object.keys(value).length <= 2) {
                var setter = value.set,
                    getter = value.get;
                accessor = function(neo) { //创建计算属性
                    //@第三层作用域
                    if (arguments.length) {
                        if (stopRepeatAssign) {
                            return; //阻止重复赋值
                        }
                        if (typeof setter === "function") {
                            setter.call(model, neo);
                        }
                        if (oldArgs !== neo) { //由于VBS对象不能用Object.prototype.toString来判定类型，我们就不做严密的检测
                            oldArgs = neo;
                            notifySubscribers(accessor); //通知顶层改变
                            model.$events && model.$fire(name, neo, value);
                        }
                    } else {
                        if (openComputedCollect || !accessor.locked) {
                            collectSubscribers(accessor);
                        }
                        //解析出get函数,返回新的值
                        return value = json[name] = getter.call(model); //保存新值到json[name]
                    }
                };
                accessor.nick = name; //执行时通过这个属性找到对应的方法
                callGetters.push(accessor);
            } else {
                //转化监控属性：
                //定义时为一个简单的数据类型，如undefined, string, number, boolean。
                value = NaN;
                callSetters.push(name);
                accessor = function(neo) { //创建监控属性或数组
                    //如果有参数
                    if (arguments.length) {
                        //用于改变用户定义的函数内部能访问正确的是vm模型时,会触发这个处理需要跳过
                        if (stopRepeatAssign) {
                            return; //阻止重复赋值
                        }
                        if (value !== neo) {
                            var old = value;
                            //监控数组：定义时为一个数组
                            if (valueType === "Array" || valueType === "Object") {
                                if (value && value.$id) {
                                    updateViewModel(value, neo, Array.isArray(neo));
                                } else if (Array.isArray(neo)) {
                                    value = Collection(neo, model, name);
                                } else {
                                    value = modelFactory(neo);
                                }
                            } else {
                                //如果是简单类型
                                value = neo;
                            }
                            //修正赋值
                            json[name] = value && value.$id ? value.$json : value;
                            notifySubscribers(accessor); //通知顶层改变
                            model.$events && model.$fire(name, value, old);
                        }
                    } else {
                        collectSubscribers(accessor); //收集视图函数
                        return value;
                    }
                };
            }
            accessor[subscribers] = []; //$1371431261804: []
            //生成defineProperties需要的配置属性
            Descriptions[name] = {
                set: accessor,
                get: accessor,
                enumerable: true
            };
        }
    });
    //http://ejohn.org/blog/ecmascript-5-objects-and-properties/
    if (defineProperties) {
        defineProperties(model, Descriptions);
    } else {
        model = VBDefineProperties(Descriptions, VBPublics);
    }

    //添加用户定义的未转换的函数到模型
    VBPublics.forEach(function(name) {
        if (!watchOne[name]) {
            model[name] = scope[name];
        }
    });

    //给监控属性赋值,调用对应监控属性的set ->accessor方法
    callSetters.forEach(function(prop) {
       // model.firstName = '司徒' ->调用了 model.firstName->set->accessor方法
        model[prop] = scope[prop]; //为空对象赋值
    });

    //计算属性
    callGetters.forEach(function(fn) {
        Publish[expose] = fn;  //为了给收集依赖于这个访问器的订阅者
        callSetters = model[fn.nick]; //return get->的结果
        fn.locked = 1;  //不需要再次搜集collectSubscribers
        delete Publish[expose];
    });

    model.$json = json;  //纯净的js对象,所有访问器与viewModel特有的方法属性都去掉
    model.$events = {}; //VB对象的方法里的this并不指向自身，需要使用bind处理一下
    model.$watch = Observable.$watch.bind(model);//用于监听ViewModel中的某属性变化,它将新值与旧值都传给回调
    model.$unwatch = Observable.$unwatch.bind(model);//卸载$watch绑定的回调
    model.$fire = Observable.$fire.bind(model); //触发$watch指定的回调
    model.$id = generateID();    //ViewModel的ID,方便通过avalon.models[$id]访问
    //判断是否为模型中的原始数据
    model.hasOwnProperty = function(name) {
        return name in model.$json;
    };
    return model;
}


var defineProperty = Object.defineProperty;

try {
    defineProperty({}, "_", {
        value: "x"
    });
    var defineProperties = Object.defineProperties;
} catch (e) {
    if ("__defineGetter__" in avalon) {
        defineProperty = function(obj, prop, desc) {
            if ('value' in desc) {
                obj[prop] = desc.value;
            }
            if ('get' in desc) {
                obj.__defineGetter__(prop, desc.get);
            }
            if ('set' in desc) {
                obj.__defineSetter__(prop, desc.set);
            }
            return obj;
        };
        defineProperties = function(obj, descs) {
            for (var prop in descs) {
                if (descs.hasOwnProperty(prop)) {
                    defineProperty(obj, prop, descs[prop]);
                }
            }
            return obj;
        };
    }
}
if (!defineProperties && window.VBArray) {
    window.execScript([
        "Function parseVB(code)",
        "\tExecuteGlobal(code)",
        "End Function"
    ].join("\n"), "VBScript");
    function VBMediator(description, name, value) {
        var fn = description[name] && description[name].set;
        if (arguments.length === 3) {
            fn(value);
        } else {
            return fn();
        }
    }

    function VBDefineProperties(description, array) {
        var publics = array.slice(0);
        publics.push("hasOwnProperty", "$id")
        var className = "VBClass" + setTimeout("1"),
            owner = {}, buffer = [];
        buffer.push(
            "Class " + className,
            "\tPrivate [__data__], [__proxy__]",
            "\tPublic Default Function [__const__](d, p)",
            "\t\tSet [__data__] = d: set [__proxy__] = p",
            "\t\tSet [__const__] = Me", //链式调用
            "\tEnd Function");
        publics.forEach(function(name) { //添加公共属性,如果此时不加以后就没机会了
            if (owner[name] !== true) {
                owner[name] = true; //因为VBScript对象不能像JS那样随意增删属性
                buffer.push("\tPublic [" + name + "]"); //你可以预先放到skipArray中
            }
        });
        Object.keys(description).forEach(function(name) {
            owner[name] = true;
            buffer.push(
                //由于不知对方会传入什么,因此set, let都用上
                "\tPublic Property Let [" + name + "](val)", //setter
                "\t\tCall [__proxy__]([__data__], \"" + name + "\", val)",
                "\tEnd Property",
                "\tPublic Property Set [" + name + "](val)", //setter
                "\t\tCall [__proxy__]([__data__], \"" + name + "\", val)",
                "\tEnd Property",
                "\tPublic Property Get [" + name + "]", //getter
                "\tOn Error Resume Next", //必须优先使用set语句,否则它会误将数组当字符串返回
                "\t\tSet[" + name + "] = [__proxy__]([__data__],\"" + name + "\")",
                "\tIf Err.Number <> 0 Then",
                "\t\t[" + name + "] = [__proxy__]([__data__],\"" + name + "\")",
                "\tEnd If",
                "\tOn Error Goto 0",
                "\tEnd Property");
        });
        buffer.push("End Class"); //类定义完毕
        buffer.push(
            "Function " + className + "Factory(a, b)", //创建实例并传入两个关键的参数
            "\tDim o",
            "\tSet o = (New " + className + ")(a, b)",
            "\tSet " + className + "Factory = o",
            "End Function");
        window.parseVB(buffer.join("\r\n"));
        var model = window[className + "Factory"](description, VBMediator);
        return model;
    }
}

function collectSubscribers(accessor) { //收集依赖于这个访问器的订阅者
    if (Publish[expose]) {
        var list = accessor[subscribers];
        list && avalon.Array.ensure(list, Publish[expose]); //只有数组不存在此元素才push进去
    }
}

function notifySubscribers(accessor, el) { //通知依赖于这个访问器的订阅者更新自身
    var list = accessor[subscribers];
    if (list && list.length) {
        var args = [].slice.call(arguments, 1);
        var safelist = list.concat();
        for (var i = 0, fn; fn = safelist[i++]; ) {
            el = fn.element;
            if (el && (!el.noRemove) && (el.sourceIndex === 0 || el.parentNode === null)) {
                avalon.Array.remove(list, fn);
                avalon.log(fn + "");
            } else {
                fn.apply(0, args); //强制重新计算自身
            }
        }
    }
}