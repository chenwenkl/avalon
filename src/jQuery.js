
/*********************************************************************
 *                      迷你jQuery对象的原型方法                    *
 **********************************************************************/

function hyphen(target) {
    //转换为连字符线风格
    return target.replace(/([a-z\d])([A-Z]+)/g, "$1-$2").toLowerCase();
}

function camelize(target) {
    //转换为驼峰风格
    if (target.indexOf("-") < 0 && target.indexOf("_") < 0) {
        return target; //提前判断，提高getStyle等的效率
    }
    return target.replace(/[-_][^-_]/g, function(match) {
        return match.charAt(1).toUpperCase();
    });
}
var rparse = /^(?:null|false|true|NaN|\{.*\}|\[.*\])$/;
var rnospaces = /\S+/g;
mix(avalon.fn, {
    hasClass: function(cls) {
        var el = this[0] || {};
        if (el.nodeType === 1) {
            return !!el.className && (" " + el.className + " ").indexOf(" " + cls + " ") > -1;
        }
    },
    addClass: function(cls) {
        var node = this[0];
        if (cls && typeof cls === "string" && node && node.nodeType === 1) {
            if (!node.className) {
                node.className = cls;
            } else {
                var a = (node.className + " " + cls).match(rnospaces);
                a.sort();
                for (var j = a.length - 1; j > 0; --j)
                    if (a[j] === a[j - 1])
                        a.splice(j, 1);
                node.className = a.join(" ");
            }
        }
        return this;
    },
    removeClass: function(cls) {
        var node = this[0];
        if (cls && typeof cls > "o" && node && node.nodeType === 1 && node.className) {
            var classNames = (cls || "").match(rnospaces) || [];
            var cl = classNames.length;
            var set = " " + node.className.match(rnospaces).join(" ") + " ";
            for (var c = 0; c < cl; c++) {
                set = set.replace(" " + classNames[c] + " ", " ");
            }
            node.className = set.slice(1, set.length - 1);
        }
        return this;
    },
    toggleClass: function(value, stateVal) {
        var state = stateVal,
            className, i = 0;
        var classNames = value.match(rnospaces) || [];
        var isBool = typeof stateVal === "boolean";
        while ((className = classNames[i++])) {
            state = isBool ? state : !this.hasClass(className);
            this[state ? "addClass" : "removeClass"](className);
        }
        return this;
    },
    attr: function(name, value) {
        if (arguments.length === 2) {
            this[0].setAttribute(name, value);
            return this;
        } else {
            return this[0].getAttribute(name);
        }
    },
    data: function(name, value) {
        name = "data-" + hyphen(name || "");
        switch (arguments.length) {
            case 2:
                this.attr(name, value);
                return this;
            case 1:
                var val = this.attr(name);
                return parseData(val);
            case 0:
                var attrs = this[0].attributes,
                    ret = {};
                for (var i = 0, attr; attr = attrs[i++]; ) {
                    name = attr.name;
                    if (!name.indexOf("data-")) {
                        name = camelize(name.slice(5));
                        ret[name] = parseData(attr.value);
                    }
                }
                return ret;
        }
    },
    removeData: function(name) {
        name = "data-" + hyphen(name);
        this[0].removeAttribute(name);
        return this;
    },
    css: function(name, value) {
        var node = this[0];
        if (node && node.style) { //注意string经过call之后，变成String伪对象，不能简单用typeof来检测
            var prop = /[_-]/.test(name) ? camelize(name) : name;
            name = cssName(prop) || prop;
            if (arguments.length === 1) { //获取样式
                var fn = cssHooks[prop + ":get"] || cssHooks["@:get"];
                return fn(node, name);
            } else { //设置样式
                var type = typeof value;
                if (type === "number" && !isFinite(value + "")) {
                    return;
                }
                if (type === "number" && !cssNumber[prop]) {
                    value += "px";
                }
                fn = cssHooks[prop + ":set"] || cssHooks["@:set"];
                fn(node, name, value);
                return this;
            }
        }
    },
    bind: function(type, fn, phase) {
        if (this[0]) { //此方法不会链
            return avalon.bind(this[0], type, fn, phase);
        }
    },
    unbind: function(type, fn, phase) {
        if (this[0]) {
            avalon.unbind(this[0], type, fn, phase);
        }
        return this;
    },
    val: function(value) {
        var node = this[0];
        if (node && node.nodeType === 1) {
            var get = arguments.length === 0;
            var access = get ? ":get" : ":set";
            var fn = valHooks[getValType(node) + access];
            if (fn) {
                var val = fn(node, value);
            } else if (get) {
                return (node.value || "").replace(/\r/g, "");
            } else {
                node.value = value;
            }
        }
        return get ? val : this;
    }
});
function parseData(val) {
    var _eval = false;
    if (rparse.test(val) || +val + "" === val) {
        _eval = true;
    }
    try {
        return _eval ? eval("0," + val) : val;
    } catch (e) {
        return val;
    }
}
  