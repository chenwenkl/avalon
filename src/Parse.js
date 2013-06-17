/*********************************************************************
 *                          Parse                                    *
 **********************************************************************/

function getValueFunction(name, scopes) { //得到求值函数,及其作用域
    //ms-model="firstName"   n == firstName  定义的属性节点值
    var n = name.split(".");
    for (var i = 0, scope, ok; scope = scopes[i++]; ) {
        try {
            //在VM中找到是否有name的定义
            if (scope.hasOwnProperty(n[0]) && (n.length < 2 || scope[n[0]].hasOwnProperty(n[1]))) {
                var fn = Function("scope", "value",
                    "if(arguments.length === 1){" +
                        ";return scope." + name + "" +
                     " }else{" +
                         " scope." + name + " = value;" +
                     " }");
                //执行下把内部的 scope.name 一次编译
                //这里会执行 命名访问器 因为有值的访问
                fn(scope);
                ok = scope;
                break;
            }
        } catch (e) {
        }
    }

    if (ok) {
        return [fn, ok];
    }
}

function watchView(text, scopes, data, callback, tokens) {
    var updateView, array, filters = data.filters,
        updateView = avalon.noop;

    //解析3种情况

    //没有过滤元素并且没有分解出插值表达式  filters: undefined && tokens: undefined
    if (!filters && !tokens) {
        // return [
        //      fn:求值函数
        //      object:vm对象
        // ]
        array = getValueFunction(text.trim(), scopes);
        if (array) {
            array = [array[0],
                [array[1]]
            ]; //强制转数组,方便使用apply
        }

    }
    if (!array && !tokens) {
        array = parseExpr(text, scopes, data);
    }

    if (!array && tokens) {
        array = tokens.map(function(token) {
            return token.expr ? parseExpr(token.value, scopes, data) || "" : token.value;
        });
        updateView = (function(a, b) {
            return function() {
                var ret = "",
                    fn;
                for (var i = 0, el; el = a[i++]; ) {
                    if (typeof el === "string") {
                        ret += el;
                    } else {
                        fn = el[0];
                        ret += fn.apply(fn, el[1]);
                    }
                }
                return b(ret, data.element);
            };
        })(array, callback);
    } else if (array) {

        var fn = array[0],
            args = array[1];

        //生成更新视图的回调处理函数
        updateView = function() {
            //return getValueFunction中编译过的fn {
            //    return scope.name
            // }
            //就是在vm模型中用户定义的处理方法
            callback(fn.apply(fn, args), data.element);
        };
    }

    updateView.toString = function() {
        return "eval(" + text + ")";
    };
    //方便调试
    //这里非常重要,我们通过判定视图刷新函数的element是否在DOM树决定
    //将它移出订阅者列表
    updateView.element = data.element;
    Publish[expose] = updateView; //暴光此函数,方便collectSubscribers收集
    openComputedCollect = true;
    updateView(); //更新内容
    openComputedCollect = false;
    delete Publish[expose];
}

function parseExpr(text, scopes, data) {
    var names = [],
        args = [],
        random = new Date - 0,
        val;
    //取得ViewModel的名字
    scopes.forEach(function(scope) {
        var scopeName = scope.$id + "" + random;
        if (names.indexOf(scopeName) === -1) {
            names.push(scopeName);
            args.push(scope);
        }
    });
    //"var ret1371271709452 = title↵"
    text = "var ret" + random + " = " + text + "\r\n";

    //"with(simple1371271709452)
    // {
    //      ↵var ret1371271709452 = title↵
    // }↵"
    for (var i = 0, name; name = names[i++]; ) {
        text = "with(" + name + "){\r\n" + text + "}\r\n";
    }

    if (data.filters) {
        var textBuffer = [],
            fargs;
        textBuffer.push(text, "\r\n");
        for (var i = 0, f; f = data.filters[i++]; ) {
            var start = f.indexOf("(");
            if (start !== -1) {
                fargs = f.slice(start + 1, f.lastIndexOf(")")).trim();
                fargs = "," + fargs;
                f = f.slice(0, start).trim();
            } else {
                fargs = "";
            }
            textBuffer.push(" if(filters", random, ".", f, "){\r\n\ttry{ret", random,
                " = filters", random, ".", f, "(ret", random, fargs, ")}catch(e){};\r\n}\r\n");
        }
        text = textBuffer.join("");
        names.push("filters" + random);
        args.push(avalon.filters);
        delete data.filters; //释放内存
    }

    try {
        text += "\r\nreturn ret" + random;
        var fn = Function.apply(Function, names.concat(text));
        val = fn.apply(fn, args);
        return [fn, args];
    } catch (e) {
        data.remove = false;
    } finally {
        textBuffer = names = null; //释放内存
    }
}