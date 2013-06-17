
//=============================val相关=======================

function getValType(el) {
    var ret = el.tagName.toLowerCase();
    return ret === "input" && /checkbox|radio/.test(el.type) ? "checked" : ret;
}
var valHooks = {
    "option:get": function(node) {
        var val = node.attributes.value;
        //黑莓手机4.7下val会返回undefined,但我们依然可用node.value取值
        return !val || val.specified ? node.value : node.text;
    },
    "select:get": function(node, value) {
        var option, options = node.options,
            index = node.selectedIndex,
            getter = valHooks["option:get"],
            one = node.type === "select-one" || index < 0,
            values = one ? null : [],
            max = one ? index + 1 : options.length,
            i = index < 0 ? max : one ? index : 0;
        for (; i < max; i++) {
            option = options[i];
            //旧式IE在reset后不会改变selected，需要改用i === index判定
            //我们过滤所有disabled的option元素，但在safari5下，如果设置select为disable，那么其所有孩子都disable
            //因此当一个元素为disable，需要检测其是否显式设置了disable及其父节点的disable情况
            if ((option.selected || i === index) && !option.disabled) {
                value = getter(option);
                if (one) {
                    return value;
                }
                //收集所有selected值组成数组返回
                values.push(value);
            }
        }
        return values;
    },
    "select:set": function(node, values) {
        values = [].concat(values); //强制转换为数组
        var getter = valHooks["option:get"];
        for (var i = 0, el; el = node.options[i++]; ) {
            el.selected = !!~values.indexOf(getter(el));
        }
        if (!values.length) {
            node.selectedIndex = -1;
        }
    }
};
/*********************************************************************
 *                           ecma262 v5语法补丁                   *
 **********************************************************************/
if (!"司徒正美".trim) {
    String.prototype.trim = function() {
        return this.replace(/^[\s\xA0]+/, "").replace(/[\s\xA0]+$/, '');
    };
}
for (var i in {
    toString: 1
}) {
    DONT_ENUM = false;
}
if (!Object.keys) {
    Object.keys = function(obj) { //ecma262v5 15.2.3.14
        var result = [];
        for (var key in obj)
            if (obj.hasOwnProperty(key)) {
                result.push(key);
            }
        if (DONT_ENUM && obj) {
            for (var i = 0; key = DONT_ENUM[i++]; ) {
                if (obj.hasOwnProperty(key)) {
                    result.push(key);
                }
            }
        }
        return result;
    };
}
if (!Array.isArray) {
    Array.isArray = function(a) {
        return avalon.type(a) === "Array";
    };
}
if (!Function.prototype.bind) {
    Function.prototype.bind = function(scope) {
        if (arguments.length < 2 && scope === void 0)
            return this;
        var fn = this,
            argv = arguments;
        return function() {
            var args = [],
                i;
            for (i = 1; i < argv.length; i++)
                args.push(argv[i]);
            for (i = 0; i < arguments.length; i++)
                args.push(arguments[i]);
            return fn.apply(scope, args);
        };
    };
}

function iterator(vars, body, ret) {
    var fun = 'for(var ' + vars + 'i=0,n = this.length;i < n;i++){' + body.replace('_', '((i in this) && fn.call(scope,this[i],i,this))') + '}' + ret;
    return Function("fn,scope", fun);
}

mix(Array.prototype, {
    //定位操作，返回数组中第一个等于给定参数的元素的索引值。
    indexOf: function(item, index) {
        var n = this.length,
            i = ~~index;
        if (i < 0)
            i += n;
        for (; i < n; i++)
            if (this[i] === item)
                return i;
        return -1;
    },
    //定位引操作，同上，不过是从后遍历。
    lastIndexOf: function(item, index) {
        var n = this.length,
            i = index == null ? n - 1 : index;
        if (i < 0)
            i = Math.max(0, n + i);
        for (; i >= 0; i--)
            if (this[i] === item)
                return i;
        return -1;
    },
    //迭代操作，将数组的元素挨个儿传入一个函数中执行。Ptototype.js的对应名字为each。
    forEach: iterator('', '_', ''),
    //迭代类 在数组中的每个项上运行一个函数，如果此函数的值为真，则此元素作为新数组的元素收集起来，并返回新数组
    filter: iterator('r=[],j=0,', 'if(_)r[j++]=this[i]', 'return r'),
    //收集操作，将数组的元素挨个儿传入一个函数中执行，然后把它们的返回值组成一个新数组返回。Ptototype.js的对应名字为collect。
    map: iterator('r=[],', 'r[i]=_', 'return r'),
    //只要数组中有一个元素满足条件（放进给定函数返回true），那么它就返回true。Ptototype.js的对应名字为any。
    some: iterator('', 'if(_)return true', 'return false'),
    //只有数组中的元素都满足条件（放进给定函数返回true），它才返回true。Ptototype.js的对应名字为all。
    every: iterator('', 'if(!_)return false', 'return true')
});
/*********************************************************************
 *                          数组增强                        *
 **********************************************************************/
avalon.Array = {
    sortBy: function(target, fn, scope) {
        //根据指定条件进行排序，通常用于对象数组。
        var array = target.map(function(item, index) {
            return {
                el: item,
                re: fn.call(scope, item, index)
            };
        }).sort(function(left, right) {
                var a = left.re,
                    b = right.re;
                return a < b ? -1 : a > b ? 1 : 0;
            });
        return avalon.Array.pluck(array, 'el');
    },
    pluck: function(target, name) {
        //取得对象数组的每个元素的指定属性，组成数组返回。
        return target.filter(function(item) {
            return item[name] != null;
        });
    },
    ensure: function(target) {
        //只有当前数组不存在此元素时只添加它
        var args = [].slice.call(arguments, 1);
        args.forEach(function(el) {
            if (!~target.indexOf(el)) {
                target.push(el);
            }
        });
        return target;
    },
    removeAt: function(target, index) {
        //移除数组中指定位置的元素，返回布尔表示成功与否。
        return !!target.splice(index, 1).length;
    },
    remove: function(target, item) {
        //移除数组中第一个匹配传参的那个元素，返回布尔表示成功与否。
        var index = target.indexOf(item);
        if (~index)
            return avalon.Array.removeAt(target, index);
        return false;
    }
};