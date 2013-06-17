/*********************************************************************
 *                           Scan                                     *
 **********************************************************************/

/**
 * 开始扫描DOM树，抽取绑定
 */
avalon.scan = function(elem, scope) {
    elem = elem || root; //默认从文档的根节点开始遍历
    var scopes = scope ? [].concat(scope) : [];
    scanTag(elem, scopes);
};

var regbind = /\{\{[^}]*\}\}|\sms-/;

function scanTag(elem, scopes) {
//    if(elem.nodeName !== "BODY") return;
  //  console.log(elem.nodeName)
    scopes = scopes || [];
    // ms-skip，不对此元素及后代进行扫描绑定，保证原样输出
    // ms-important="ViewModelName"，指定这个区域只能由这个ViewModel来渲染
    // ms-controller="ViewModelName"，指定一个ViewModel的作用范围
    var a = elem.getAttribute(prefix + "skip");
    var b = elem.getAttribute(prefix + "important");
    var c = elem.getAttribute(prefix + "controller");
    //这三个绑定优先处理，其中a > b > c
    if (typeof a === "string") {
        return;
    } else if (b) {
        //因为要指定模型，所以取出已经存在的模型ViewModel
        if (!avalon.models[b]) {
            return;
        } else {
            scopes = [avalon.models[b]];
            elem.removeAttribute(prefix + "important");
        }
    } else if (c) {
        var newScope = avalon.models[c];
        if (!newScope) {
            return;
        }
        scopes = [newScope].concat(scopes);
        elem.removeAttribute(prefix + "controller");
    }


    //扫描特点节点
    scanAttr(elem, scopes);

    //过滤
    // canHaveChildren 针对IE  false 元素不包含其他元素
    if (elem.canHaveChildren === false || !stopScan[elem.tagName] && regbind.test(elem.innerHTML)) {
        var textNodes = [];
        var nodes = elem.childNodes;
        //过滤掉空白符
        for (var i = 0, node; node = nodes[i++]; ) {
            //  for (var node = elem.firstChild; node; node = node.nextSibling) {
            if (node.nodeType === 1) {
                scanTag(node, scopes); //扫描元素节点
            } else if (node.nodeType === 3) {
//                console.log(node)
                //如果是文本节点
                //过滤一次空白符处理，
                textNodes.push(node);
            }
        }

        for (var i = 0; node = textNodes[i++]; ) { //延后执行
            scanText(node, scopes); //扫描文本节点
        }
    }
}

var stopScan = avalon.oneObject("area,base,basefont,br,col,hr,img,input,link,meta,param,embed,wbr,script,style,textarea");

/*
 * 扫描属性节点
 */
function scanAttr(el, scopes) {

    var bindings = [];

    for (var i = 0, attr; attr = el.attributes[i++]; ) {
        //如果在文档中设置了属性值
        if (attr.specified) {
            var isBinding = false;
            if (attr.name.indexOf(prefix) !== -1) {
                //如果是以指定前缀命名的
                var type = attr.name.replace(prefix, "");
                if (type.indexOf("-") > 0) { //如果还指定了参数
                    var args = type.split("-");
                    type = args.shift();
                }
                //如果能找到这种类型的与之对应的模型绑定
                isBinding = typeof bindingHandlers[type] === "function";
                //是否存在插值表达式
            } else if (/\{\{[^}]*\}\}/.test(attr.value)) {
                type = isBinding = "attr";
            }
            if (isBinding) {

                bindings.push({
                    type: type,
                    args: args || [],
                    element: el,
                    remove: true,
                    node: attr,
                    value: attr.nodeValue
                });
            }
        }
    }

    executeBindings(bindings, scopes);
}

/**
 *
 * 执行绑定
 * 把扫描到的节点属性定义,找到相对应的处理函数
 * @param bindings
 * @param scopes
 */
function executeBindings(bindings, scopes) {
    bindings.forEach(function(data) {
        bindingHandlers[data.type](data, scopes); //avalon.mix({},data)
        if (data.remove) { //移除数据绑定，防止被二次解析
            //ms-model
            data.element.removeAttribute(data.node.name);
        }
    });
}

/*
 * 扫描文本节点
 */
function scanText(textNode, scopes) {
    var bindings = extractTextBindings(textNode);
    if (bindings.length) {
        executeBindings(bindings, scopes);
    }
}

/**
 * 判断是否存在插值表达式
 * @param value
 * @returns {boolean}
 */
function hasExpr(value) {
    var index = value.indexOf("{{");
    return index !== -1 && index < value.indexOf("}}");
}


//扫描元素节点中直属的文本节点，并进行抽取
var regOpenTag = /([^{]*)\{\{/;      //匹配0个或多个非{开头的前缀{0,} sdaffd{{test}}dsfasdf  ->  sdaffd{{ -> test}}dsfasdf
var regCloseTag = /([^}]*)\}\}/;

/**
 * 扫描表达式
 * @param value
 * @returns {Array}
 *
 * 根据API分析有3种结构
     1> <p ms-html="content"></p>
     2> <p>{{content}}</p>
     3 > <div><b>不影响其他节点</b>{{content|html}}</div>
    这里匹配的主要是2,3插值表达式
    比如需要匹配的单元
       前缀{{title|html}}后缀
    执行代码后，分解成3个数组对象
    tokens = [
        {
          expr: false
          value: "前缀"
        },
       {
         expr: true
         filters: Array[1]   -》 html
         value: "title"
       },
       {
         expr: false
         value: "后缀"
       }
   ]
 *
 */
function scanExpr(value) {
    var tokens = [];
    //检索是否有{{}}插值表达式
    //<div>{{firstName}}</div>
    if (hasExpr(value)) {
        //抽取{{ }} 里面的语句，并以它们为定界符，拆分原来的文本
        do {
            //value: {{"title" 替换左边界符
            value = value.replace(regOpenTag, function(a, b) {
                //存在{{ 前缀匹配
                //前缀{{title}}后缀
                if (b) {
                    tokens.push({
                        value: b,       //存在前缀值
                        expr: false     //不属于表达式范畴，意思是不需要转化里面的值
                    });
                }
                return "";
            });
            //value: "title"}} 替换右边界符
            //这里匹配出真正的{{变量}}
            value = value.replace(regCloseTag, function(a, b) {
                if (b) {
                    var leach = [];
                    //存在{{content|html}} 这种结构
                    if (b.indexOf("|") > 0) {
                        b = b.replace(/\|\s*(\w+)\s*(\([^)]+\))?/g, function(c, d, e) {
                            leach.push(d + (e || ""));
                            return "";
                        });
                    }
                    tokens.push({
                        value: b,
                        expr: true,
                        filters: leach.length ? leach : void 0
                    });
                }
                return "";
            });
        } while (hasExpr(value));   //循环是否存在表达式

        //后缀
        if (value) {
            tokens.push({
                value: value,
                expr: false
            });
        }
    }
    return tokens;
}

function extractTextBindings(textNode) {
    var bindings = [], //收集带有插值表达式的文本
        tokens = scanExpr(textNode.nodeValue); //分解出插值表达式
    if (tokens.length) {
        while (tokens.length) { //将文本转换为文本节点，并替换原来的文本节点
            var token = tokens.shift();   //取出表达式的分组对象
            var node = DOC.createTextNode(token.value);
            //是表达式才处理
            if (token.expr) {//token.expr在scanExpr函数分解的时候就已经区分了
                var filters = token.filters;
                var binding = {
                    type: "text",
                    node: node,
                    args: [],
                    element: textNode.parentNode,
                    value: token.value,
                    filters: filters
                };
                //如果存在html -> 插值表达式中的{{title|html}}
                if (filters && filters.indexOf("html") !== -1) {
                    avalon.Array.remove(filters, "html");
                    binding.type = "html";   //  bindingHandlers[html] 更变绑定的函数
                    binding.replace = true;
                }
                bindings.push(binding);
            }

            //保存到文档碎片节点,用于只处理一次页面渲染
            documentFragment.appendChild(node);
        }

        //替换内容
        textNode.parentNode.replaceChild(documentFragment, textNode);
    }
    return bindings;
}
