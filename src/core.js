/**
 *
 *   源码导读,皆在促进avalon的传播以及广大avalon爱好者提供一个进阶的途径
 * 让各位可以更加深入了解avalon
 *
 */

var DOC = document;
var Publish = {}; //将函数曝光到此对象上，方便访问器收集依赖
var readyList = [];
var expose = new Date - 0;
var subscribers = "$" + expose;
//这两个都与计算属性息息相关
var stopRepeatAssign = false;
var openComputedCollect = false;
var rword = /[^, ]+/g;
var prefix = "ms-";
var W3C = window.dispatchEvent;
var root = DOC.documentElement;
var serialize = Object.prototype.toString;
var domParser = document.createElement("div");
var documentFragment = DOC.createDocumentFragment();
var DONT_ENUM = "propertyIsEnumerable,isPrototypeOf,hasOwnProperty,toLocaleString,toString,valueOf,constructor".split(",");
function noop() {
}

function generateID() {
//http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
    return "avalon" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
/*********************************************************************
 *                 命名空间                                            *
 **********************************************************************/


/**
 *
 * 标准的JQuery构造方式
 *
 *  jQuery采用链式调用，但是调用的方式是函数调用
 *  如：$("#id").css().show().....
 *
 *  问题：
 *       以函数的方式调用返回jQuery对象，并且构造函数是init。
 *
 *  首先想到的是在函数式调用的时候返回一个jQuery对象
 *
 *
 *
 * @param el
 * @returns {avalon.init}
 */
avalon = function(el) {
    return new avalon.init(el);
};

function mix(a, b) {
    var args = [].slice.call(arguments),
        i = 1;
    while ((b = args[i++])) {
        for (var p in b) {
            a[p] = b[p];
        }
    }
    return a;
}

avalon.init = function(el) {
    this[0] = this.element = el;
};

avalon.fn = avalon.prototype = avalon.init.prototype;

mix(avalon, {
    mix: mix,
    rword: rword,
    subscribers: subscribers,
    ui: {},
    models: {},
    log: function log(a) {
        window.console && console.log(a);
    },
    noop: noop,
    error: function(str, e) { //如果不用Error对象封装一下，str在控制台下可能会乱码
        throw new (e || Error)(str);
    },
    ready: function(fn) {
        if (typeof fn === "function") {
            if (Array.isArray(readyList)) {
                readyList.push(fn);
            } else {
                fn();
            }
        }
    },
    type: function(obj) { //取得类型
        return obj === null ? "Null" : obj === void 0 ? "Undefined" : serialize.call(obj).slice(8, -1);
    },
    oneObject: function(array, val) {
        if (typeof array === "string") {
            array = array.match(rword) || [];
        }
        var result = {},
            value = val !== void 0 ? val : 1;
        for (var i = 0, n = array.length; i < n; i++) {
            result[array[i]] = value;
        }
        return result;
    },
    range: function(start, end, step) {
        step || (step = 1);
        if (end == null) {
            end = start || 0;
            start = 0;
        }
        var index = -1,
            length = Math.max(0, Math.ceil((end - start) / step)),
            result = Array(length);
        while (++index < length) {
            result[index] = start;
            start += step;
        }
        return result;
    },
    bind: function(el, type, fn, phase) {
        function callback(e) {
            var ex = e.target ? e : fixEvent(e || window.event);
            var ret = fn.call(el, ex);
            if (ret === false) {
                ex.preventDefault();
                ex.stopPropagation();
            }
            return ret;
        }
        if (W3C) {//addEventListener对return false不做处理，需要自己fix
            el.addEventListener(type, callback, !!phase);
        } else {
            try {
                el.attachEvent("on" + type, callback);
            } catch (e) {
            }
        }
        return callback;
    },
    unbind: W3C ? function(el, type, fn, phase) {
        el.removeEventListener(type, fn || noop, !!phase);
    } : function(el, type, fn) {
        el.detachEvent("on" + type, fn || noop);
    }
});
function forEach(obj, fn) {
    if (obj) { //不能传个null, undefined进来
        var isArray = Array.isArray(obj) || avalon.type(obj) === "Object" && !obj.setTimeout && isFinite(obj.length) && obj[0],
            i = 0;
        if (isArray) {
            for (var n = obj.length; i < n; i++) {
                fn(i, obj[i]);
            }
        } else {
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    fn(i, obj[i]);
                }
            }
        }
    }
}
avalon.forEach = function(obj, fn) {
    window.console && console.log("此方法已过时,请使用avalon.each");
    forEach(obj, fn);
};
avalon.each = forEach;

function fireReady() {
    if (readyList) {
        for (var i = 0, fn; fn = readyList[i++]; ) {
            fn();
        }
        //只会触发一次回调处理
        readyList = null;
    }
}
//兼容游览器
// 不是所有的浏览器都支持DomContentLoaded。
//load事件是在页面所有元素都加载完后触发
avalon.bind(window, "load", fireReady);
//它是指dom tree加载完就触发。这个事件要小心使用，当然它是个强大的事件，起码用上它在某一层面上防止了页面加载被堵塞。
avalon.bind(window, "DOMContentLoaded", fireReady);