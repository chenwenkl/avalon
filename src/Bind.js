
/*********************************************************************
 *                         Bind                                    *
 **********************************************************************/
    //将视图中的需要局部刷新的部分与ViewModel用绑定处理函数连结在一起,生成updateView函数,
    //而它内部调用着之前编译好的函数compileFn，双向产生依赖，成为双向绑定链的最顶层

    //on binding相关
function fixEvent(event) {
    var target = event.target = event.srcElement;
    event.which = event.charCode != null ? event.charCode : event.keyCode;
    if (/mouse|click/.test(event.type)) {
        var doc = target.ownerDocument || DOC;
        var box = doc.compatMode === "BackCompat" ? doc.body : doc.documentElement;
        event.pageX = event.clientX + (box.scrollLeft >> 0) - (box.clientLeft >> 0);
        event.pageY = event.clientY + (box.scrollTop >> 0) - (box.clientTop >> 0);
    }
    event.preventDefault = function() { //阻止默认行为
        event.returnValue = false;
    };
    event.stopPropagation = function() { //阻止事件在DOM树中的传播
        event.cancelBubble = true;
    };
    return event;
}

//visible binding相关
var cacheDisplay = avalon.oneObject("a,abbr,b,span,strong,em,font,i,kbd", "inline");
avalon.mix(cacheDisplay, avalon.oneObject("div,h1,h2,h3,h4,h5,h6,section,p", "block"));

function parseDisplay(nodeName, val) {
    //用于取得此类标签的默认display值
    nodeName = nodeName.toLowerCase();
    if (!cacheDisplay[nodeName]) {
        var node = DOC.createElement(nodeName);
        root.appendChild(node);
        if (window.getComputedStyle) {
            val = window.getComputedStyle(node, null).display;
        } else {
            val = node.currentStyle.display;
        }
        root.removeChild(node);
        cacheDisplay[nodeName] = val;
    }
    return cacheDisplay[nodeName];
}

domParser.setAttribute("className", "t");
var fuckIEAttr = domParser.className === "t";

var propMap = {
    "class": "className",
    "for": "htmlFor"
};

var bindingHandlers = avalon.bindingHandlers = {
    "if": function(data, scopes) {
        var placehoder = DOC.createComment("@");
        var parent = data.element.parentNode;
        watchView(data.value, scopes, data, function(val, elem) {
            if (val) { //添加 如果它不在DOM树中
                if (!elem.parentNode || elem.parentNode.nodeType === 11) {
                    parent.replaceChild(elem, placehoder);
                    elem.noRemove = 0;
                }
            } else { //移除  如果它还在DOM树中
                if (elem.parentNode && elem.parentNode.nodeType === 1) {
                    parent.replaceChild(placehoder, elem);
                    elem.noRemove = 1;
                }
            }
        });
    },
    "template": function(data, scopes) {
        watchView(data.value, scopes, data, function(val, elem) {
            var id = data.args.join("-"),
                el = DOC.getElementById(id);
            if (el && val.$json) { //id为一个设置了type="ms"的script标签
                nextTick(function() {
                    elem.innerHTML = el.text;
                    avalon.scan(elem, val);
                });
            }
        });
    },
    "attr": function(data, scopes) {
        data.remove = false;
        watchView(data.value, scopes, data, function(val, elem) {
            var attrName = data.node.name;
            var toRemove = (val === false) || (val === null) || (val === void 0);
            if (toRemove)
                elem.removeAttribute(attrName);
            if (fuckIEAttr && attrName in propMap) {
                attrName = propMap[attrName];
                if (toRemove) {
                    elem.removeAttribute(attrName);
                } else {
                    elem[attrName] = val;
                }
            } else if (!toRemove) {
                elem.setAttribute(attrName, val);
            }
        });
    },
    "on": function(data, scopes) {
   //     console.log(data, scopes)
        watchView(data.value, scopes, data, function(fn, elem) {
            var type = data.args[0];
            if (type && typeof fn === "function") { //第一种形式
                if (!elem.$scopes) {
                    elem.$scope = scopes[0];
                    elem.$scopes = scopes;
                }
                avalon.bind(elem, type, fn);
            }
        });
    },
    "data": function(data, scopes) {
        watchView(data.value, scopes, data, function(val, elem) {
            var key = "data-" + data.args.join("-");
            elem.setAttribute(key, val);
        });
    },
    //抽取innerText中插入表达式，置换成真实数据放在它原来的位置
    //<div>{{firstName}} + java</div>，如果model.firstName为ruby， 那么变成
    //<div>ruby + java</div>
    "text": function(data, scopes) {
        watchView(data.value, scopes, data, function(val) {
            data.node.nodeValue = val;
        });
    },
    //控制元素显示或隐藏
    "visible": function(data, scopes) {
        var elem = data.element;
        var display = avalon(elem).css("display");
        display = display === "none" ? parseDisplay(elem.tagName) : display;
        watchView(data.value, scopes, data, function(val) {
            elem.style.display = val ? display : "none";
        });
    },
    //这是一个字符串属性绑定的范本, 方便你在title, alt,  src, href添加插值表达式
    //<a href="{{url.hostname}}/{{url.pathname}}.html">
    "href": function(data, scopes) {
        //如果没有则说明是使用ng-href的形式
        var text = data.value.trim();
        var simple = true;
        var name = data.type;
        if (text.indexOf("{{") > -1 && text.indexOf("}}") > 2) {
            simple = false;
            if (/^\{\{([^}]+)\}\}$/.test(text)) {
                simple = true;
                text = RegExp.$1;
            }
        }
        watchView(text, scopes, data, function(val, elem) {
            if (name === "css") {
                avalon(elem).css(data.args.join("-"), val);
            } else {
                elem[name] = val;
            }
        }, simple ? null : scanExpr(data.value));
    },
    //这是一个布尔属性绑定的范本，布尔属性插值要求整个都是一个插值表达式，用{{}}包起来
    //布尔属性在IE下无法取得原来的字符串值，变成一个布尔，因此需要用ng-disabled
    "disabled": function(data, scopes) {
        var name = data.type,
            propName = name === "readonly" ? "readOnly" : name;
        watchView(data.value, scopes, data, function(val, elem) {
            elem[propName] = !!val;
        });
    },
    //ms-bind-name="callback",绑定一个属性，当属性变化时执行对应的回调，this为绑定元素
    "bind": function(data, scopes) {
        var fn = data.value.trim(),
            name = data.args[0];
        for (var i = 0, scope; scope = scopes[i++]; ) {
            if (scope.hasOwnProperty(fn)) {
                fn = scope[fn];
                break;
            }
        }
        if (typeof fn === "function") {
            scope.$watch(name, function(neo, old) {
                fn.call(data.element, neo, old);
            });
        }
    },
    //切换类名，有三种形式
    //1、ms-class-xxx="flag" 根据flag的值决定是添加或删除类名xxx
    //2、ms-class=obj obj为一个{xxx:true, yyy:false}的对象，根据其值添加或删除其键名
    //3、ms-class=str str是一个类名或多个类名的集合，全部添加
    //http://www.cnblogs.com/rubylouvre/archive/2012/12/17/2818540.html
    "class": function(data, scopes) {
        watchView(data.value, scopes, data, function(val, elem) {
            var cls = data.args.join("-");
            if (typeof val === "function") {
                if (!elem.$scopes) {
                    elem.$scope = scopes[0];
                    elem.$scopes = scopes;
                }
                val = val.call(elem);
            }
            avalon(elem).toggleClass(cls, !!val);
        });
    },
    "hover": function(data) {
        var god = avalon(data.element);
        god.bind("mouseenter", function() {
            god.addClass(data.value);
        });
        god.bind("mouseleave", function() {
            god.removeClass(data.value);
        });
    },
    "active": function(data) {
        var elem = data.element;
        var god = avalon(elem);
        elem.tabIndex = elem.tabIndex || -1;
        god.bind("focus", function() {
            god.addClass(data.value);
        });
        god.bind("blur", function() {
            god.removeClass(data.value);
        });
    },
    "html": function(data, scopes) {
        watchView(data.value, scopes, data, function(val, elem) {
            val = val == null ? "" : val + "";
            if (data.replace) { //如果text被替换html过,内容用documentFragment填充过
                //拼接{{}}表达式前后的信息
                domParser.innerHTML = val;
                while (domParser.firstChild) {
                    documentFragment.appendChild(domParser.firstChild);
                }
                elem.replaceChild(documentFragment, data.node);
            } else {
                elem.innerHTML = val;
            }
        });
    },
    "ui": function(data, scopes, opts) {
        var uiName = data.value.trim(); //此UI的名字
        if (typeof avalon.ui[uiName] === "function") {
            var id = (avalon(data.element).data("id") || "").trim();
            id = id || uiName + setTimeout("1"); //ViewModel的$id
            data.element.setAttribute(prefix + "controller", id);
            var optsName = data.args[0]; //它的参数对象
            if (optsName) {
                for (var i = 0, scope; scope = scopes[i++]; ) {
                    if (scope.hasOwnProperty(optsName)) {
                        opts = scope[optsName];
                        break;
                    }
                }
                if (!opts) {
                    for (var i in avalon.models) {
                        scope = avalon.models[i];
                        if (scope.hasOwnProperty(optsName)) {
                            opts = scope[optsName];
                            break;
                        }
                    }
                }
            }

            avalon.ui[uiName](data.element, id, opts);
        }
    },
    "options": function(data, scopes) {
        var elem = data.element;
        if (elem.tagName !== "SELECT") {
            avalon.error("options绑定只能绑在SELECT元素");
        }
        while (elem.length > 0) {
            elem.remove(0);
        }
        var index = data.args[0];
        watchView(data.value, scopes, data, function(val) {
            if (Array.isArray(val)) {
                nextTick(function() {
                    elem.setAttribute(prefix + "each-option", data.value);
                    var op = new Option("{{option}}", "");
                    op.setAttribute("ms-value", "option");
                    elem.options[0] = op;
                    avalon.scan(elem);
                    if (isFinite(index)) {
                        op = elem.options[index];
                        if (op) {
                            op.selected = true;
                        }
                    }
                    var scope = scopes[0];
                    if (index && Array.isArray(scope[index])) {
                        var god = avalon(elem);
                        god.val(scope[index]);
                        god.bind("change", function() {
                            var array = god.val();
                            val.clear();
                            val.push.apply(val, array);
                        });
                    }
                });
            } else {
                avalon.error("options绑定必须对应一个字符串数组");
            }
        });
    }
};
/**
 *   生成近似方法，从而大大减少代码量，提高维护性
 *   循环生成是艺术，需要深刻了解它们的功能与共同点，
 *   然后将特异点组成一个对象，这样方法内的if else就减到最小。
 */

/*********************************************************************
 *                         boolean preperty binding            *
 **********************************************************************/
//与disabled绑定器 用法差不多的其他布尔属性的绑定器
var bools = "checked,readonly,selected";
bools.replace(rword, function(name) {
    bindingHandlers[name] = bindingHandlers.disabled;
});
bindingHandlers.enabled = function(data, scopes) {
    watchView(data.value, scopes, data, function(val, elem) {
        elem.disabled = !val;
    });
};

/////////////////////////// string preperty binding///////////////////////////
//与href绑定器 用法差不多的其他字符串属性的绑定器
//建议不要直接在src属性上修改，这样会发出无效的请求，请使用ms-src
"title,alt,src,value,css".replace(rword, function(name) {
    bindingHandlers[name] = bindingHandlers.href;
});


/////////////////////////// model binding  ///////////////////////////

//将模型中的字段与input, textarea的value值关联在一起
var modelBinding = bindingHandlers.model = function(data, scopes) {
    var element = data.element;
    var tagName = element.tagName;
    //是否有对应元素的标签名的处理方法
    if (typeof modelBinding[tagName] === "function") {
        var array = getValueFunction(data.value.trim(), scopes);
        if (array) {
            modelBinding[tagName](element, array[0], array[1]);
        }
    }
};

//如果一个input标签添加了model绑定。那么它对应的字段将与元素的value连结在一起
//字段变，value就变；value变，字段也跟着变。默认是绑定input事件，
modelBinding.INPUT = function(element, fn, scope) {
    if (element.name === void 0) {
        element.name = generateID();
    }
    var type = element.type,
        god = avalon(element);

    //当value变化时改变model的值
    var updateModel = function() {
        //data-observe="false" 跳过处理
        if (god.data("observe") !== false) {
            fn(scope, element.value);
        }
    };

    //当model变化时,它就会改变value的值
    var updateView = function() { //先执行updateView
        var neo = fn(scope);
        if (neo !== element.value) {
            //更新节点元素值
            element.value = neo;
        }
    };

    if (/^(password|textarea|text)$/.test(type)) {

        var event = element.attributes[prefix + "event"] || {};
        event = event.value;
        if (event === "change") {
            avalon.bind(element, event, updateModel);
        } else {
            if (window.addEventListener) { //先执行W3C
                //当元素获得用户输入时运行脚本
                element.addEventListener("input", updateModel, false);
            } else {
                element.attachEvent("onpropertychange", updateModel);
            }
            if (DOC.documentMode >= 9) { //IE9 10
                element.attachEvent("onkeydown", function(e) {
                    var key = e.keyCode;
                    if (key === 8 || key === 46) {
                        updateModel(); //处理回退与删除
                    }
                });
                element.attachEvent("oncut", updateModel); //处理粘贴
            }
        }
    } else if (type === "radio") {
        updateView = function() {
            element.checked = !!fn(scope);
        };
        updateModel = function() {
            if (god.data("observe") !== false) {
                var val = !element.beforeChecked;
                fn(scope, val);
                element.beforeChecked = element.checked = val;
            }
        };
        function beforeChecked() {
            element.beforeChecked = element.checked;
        }
        if (element.onbeforeactivate === null) {
            god.bind("beforeactivate", beforeChecked);
        } else {
            god.bind("mouseover", beforeChecked);
        }
        god.bind("click", updateModel);
    } else if (type === "checkbox") {
        updateModel = function() {
            if (god.data("observe") !== false) {
                var method = element.checked ? "ensure" : "remove";
                avalon.Array[method](fn(scope), element.value);
            }
        };
        updateView = function() {
            var array = [].concat(fn(scope)); //强制转换为数组
            element.checked = array.indexOf(element.value) >= 0;
        };
        god.bind("click", updateModel); //IE6-8
    }


    Publish[expose] = updateView;
    updateView.element = element;
    updateView();
    delete Publish[expose];
};

modelBinding.SELECT = function(element, fn, scope, oldValue) {
    var god = avalon(element);
    function updateModel() {
        if (god.data("observe") !== false) {
            var neo = god.val();
            if (neo + "" !== oldValue) {
                fn(scope, neo);
                oldValue = neo + "";
            }
        }
    }

    function updateView() {
        var neo = fn(scope);
        if (neo + "" !== oldValue) {
            god.val(neo);
            oldValue = neo + "";
        }
    }
    god.bind("change", updateModel);
    Publish[expose] = updateView;
    updateView.element = element;
    updateView();
    delete Publish[expose];
};

modelBinding.TEXTAREA = modelBinding.INPUT;


//////////////////////////// 常用事件 binding  ////////////////////////
"dblclick,mouseout,click,mouseover,mouseenter,mouseleave,mousemove,mousedown,mouseup,keypress,keydown,keyup,blur,focus,change".
    replace(rword, function(name) {
        bindingHandlers[name] = function(data) {
            data.args = [name];
            bindingHandlers.on.apply(0, arguments);
        };
    });


if (!("onmouseenter" in root)) {
    var oldBind = avalon.bind;
    var events = {
        mouseenter: "mouseover",
        mouseleave: "mouseout"
    };
    avalon.bind = function(elem, type, fn) {
        if (events[type]) {
            return oldBind(elem, events[type], function(e) {
                var t = e.relatedTarget;
                if (!t || (t !== elem && !(elem.compareDocumentPosition(t) & 16))) {
                    delete e.type;
                    e.type = type;
                    return fn.call(elem, e);
                }
            });
        } else {
            return oldBind(elem, type, fn);
        }
    };
}
/*********************************************************************
 *                 与each绑定息息相关的监控数组              *
 **********************************************************************/

function convert(val) {
    if (Array.isArray(val)) {
        return val.$id ? val : Collection(val);
    } else if (avalon.type(val) === "Object") {
        return val.$id ? val : modelFactory(val);
    } else {
        return val;
    }
}

function Collection(list, model, prop) {
    var collection = list.map(convert);
    collection.$id = generateID();
    collection[subscribers] = [];
    list = collection.map(function(el){
        return el && el.$id ? el.$json : el;
    })
    collection.$json = list;
    var dynamic = modelFactory({
        length: list.length
    });
    dynamic.$watch("length", function() {
        model && model.$fire(prop + ".length");
    });
    "push,pop,shift,unshift,splice".replace(rword, function(method) {
        collection[method] = function() {
            var len = this.length;
            list[method].apply(list, arguments);
            var args = [].slice.call(arguments);
            if (/push|unshift|splice/.test(method)) {
                args = args.map(convert);
            }
            var ret = list[method].apply(this, args);
            notifySubscribers(this, method, args, len);
            dynamic.length = this.length;
            return ret;
        };
    });
    "sort,reverse".replace(rword, function(method) {
        collection[method] = function() {
            var ret = list[method].apply(list, arguments);
            for(var i = 0; i < ret.length; i++){
                var el = ret[i];
            }
            return this;
        };
    });
    collection.isCollection = true;
    collection.clear = function() {
        this.length = dynamic.length = 0; //清空数组
        notifySubscribers(this, "clear", []);
        return this;
    };
    collection.update = function(val) {
        Array.isArray(val) && updateViewModel(this, val, true);
        return this;
    };
    collection.sortBy = function(fn, scope) { //按某属性排序
        this.update(avalon.Array.sortBy(list, fn, scope));
        return this;
    };
    collection.contains = function(el) { //判定是否包含
        return this.indexOf(el) !== -1;
    };
    collection.ensure = function(el) {
        if (!this.contains(el)) { //只有不存在才push
            this.push(el);
        }
        return this;
    };
    collection.set = function(index, val) {
        if (index >= 0 && index < this.length) {
            if (/Array|Object/.test(avalon.type(val))) {
                model && model.$fire(prop + ".changed");
                if (val.$json) {
                    val = val.$json;
                }
                updateViewModel(this[index], val, Array.isArray(val), list[index]);
            } else if (this[index] !== val) {
                this[index] = val;

                model && model.$fire(prop + ".changed");
                notifySubscribers(this, "set", arguments);
            }
        }
        return this;
    };
    collection.size = function() { //取得数组长度，这个函数可以同步视图，length不能
        return dynamic.length;
    };
    collection.remove = function(item) { //移除第一个等于给定值的元素
        var index = this.indexOf(item);
        return this.removeAt(index);
    };
    collection.removeAt = function(index) { //移除指定索引上的元素
        if (index >= 0 && (index % 1 === 0)) {
            list.splice(index, 1);
            this.splice(index, 1); //DOM操作非常重,因此只有非负整数才删除
            return this;
        }
    };
    collection.removeAll = function(all) { //移除N个元素
        if (Array.isArray(all)) {
            all.forEach(function(el) {
                collection.remove(el);
            });
        } else if (typeof all === "function") {
            for (var i = this.length - 1; i >= 0; i--) {
                var el = this[i];
                if (all(el, i)) {
                    this.splice(i, 1);
                }
            }
        } else {
            this.clear();
        }
    };
    return collection;
}
//////////////////////////// each binding  ////////////////////////
//https://developer.mozilla.org/en-US/docs/DOM/range.deleteContents

function emptyNode(parent) {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}
bindingHandlers["each"] = function(data, scopes) {
    var parent = data.element;
    var value = data.value;
    var array = parseExpr(value, scopes, data);
    var list
    if (typeof array == "object") {
        list = array[0].apply(array[0], array[1]);
    }

    if (typeof list !== "object") {
        return list;
    }
    var view = documentFragment.cloneNode(false);
    var comment = DOC.createComment(list.$id);
    view.appendChild(comment);
    while (parent.firstChild) {
        view.appendChild(parent.firstChild);
    }
    data.view = view;
    data.scopes = scopes;
    function updateListView(method, args, len) {
        var id = list.$id;
        var models = updateListView.$models;
        var firstNode = parent.firstChild;
        switch (method) {
            case "set":
                var model = models[args[0]];
                if (model) {
                    var n = model.$itemName;
                    model[n] = args[1];
                }
                break;
            case "push":
                //在后面添加
                forEach(args, function(index, item) {
                    addItemView(len + index, item, list, data, models);
                });
                break;
            case "unshift":
                //在前面添加
                resetIndex(parent, id, list.length - len);
                list.place = firstNode;
                forEach(args, function(index, item) {
                    addItemView(index, item, list, data, models);
                });
                list.place = null;
                break;
            case "pop":
                //去掉最后一个
                var node = findIndex(parent, len - 1);
                if (node) {
                    removeItemView(node, id + len);
                    models.pop();
                }
                break;
            case "shift":
                //去掉前面一个
                firstNode && removeItemView(firstNode, id + 1);
                resetIndex(parent, id);
                models.shift();
                break;
            case "splice":
                var start = args[0],
                    second = args[1],
                    adds = [].slice.call(args, 2);
                var deleteCount = second >= 0 ? second : len - start;
                if (deleteCount) {
                    var node = findIndex(parent, start);
                    if (node) {
                        models.splice(start, deleteCount);
                        removeItemView(node, id + (start + second));
                        resetIndex(parent, id);
                    }
                }
                if (adds.length) {
                    list.place = findIndex(parent, start);
                    updateListView("push", adds, start);
                    resetIndex(parent, id);
                    list.place = null;
                }
                break;
            case "clear":
                models.length = 0;
                emptyNode(parent);
                break;
        }
    }
    updateListView.$models = [];
    if ((list || {}).isCollection) {
        list[subscribers].push(updateListView);
    }
    updateListView("push", list, 0);
};
function findIndex(elem, index) { //寻找路标
    for (var node = elem.firstChild; node; node = node.nextSibling) {
        if (node.id === node.nodeValue + index) {
            return node;
        }
    }
}

function resetIndex(elem, name, add) { //重置路标
    var index = add || 0;
    for (var node = elem.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 8 && node.nodeValue === name) {
            if (node.id !== name + index) {
                node.id = name + index;
                node.$scope.$index = index;
            }
            index++;
        }
    }
}

function removeItemView(node, id, next) {
    var parent = node.parentNode;
    while (next = node.nextSibling) {
        if (next.nodeType === 8 && next.id === id) {
            break;
        } else {
            parent.removeChild(next);
        }
    }
    parent.removeChild(node);
}

function addItemView(index, item, list, data, models) {
    var scopes = data.scopes;
    var parent = data.element;
    var scope = createItemModel(index, item, list, data.args);
    var textNodes = [];
    var view = data.view.cloneNode(true);
    var nodes = view.childNodes;
    scopes = [scope].concat(scopes);
    models.splice(index, 0, scope);
    if (!parent.inprocess) {
        parent.inprocess = 1; //locked!
        var hidden = parent.hidden; //http://html5accessibility.com/
        parent.hidden = true; //作用类似于display:none
    }
    for (var i = 0, node; node = nodes[i++]; ) {
        if (node.nodeType === 1) {
            scanTag(node, scopes); //扫描文本节点
        } else if (node.nodeType === 3) {
            textNodes.push(node);
        } else if (node.nodeType === 8) {
            node.id = node.nodeValue + index; //设置路标
            node.$scope = scope;
            node.$view = view.cloneNode(false);
        }
    }
    parent.insertBefore(view, list.place || null);
    for (var i = 0; node = textNodes[i++]; ) {
        scanText(node, scopes); //扫描文本节点
    }
    if (parent.inprocess) {
        parent.hidden = hidden;
        parent.inprocess = 0;
    }
}
//为子视图创建一个ViewModel

function createItemModel(index, item, list, args) {
    var itemName = args[0] || "$data";
    var source = {};
    source.$index = index;
    source.$itemName = itemName;
    source[itemName] = {
        get: function() {
            return item;
        },
        set: function(val) {
            item = val;
        }
    };
    source.$first = {
        get: function() {
            return this.$index === 0;
        }
    };
    source.$last = {
        get: function() { //有时用户是传个普通数组
            return this.$index === list.length - 1;
        }
    };
    source.$remove = function() {
        return list.remove(item);
    };
    return modelFactory(source);
}

