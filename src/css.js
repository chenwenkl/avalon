//=============================css相关=======================
var cssHooks = avalon.cssHooks = {};
var prefixes = ['', '-webkit-', '-o-', '-moz-', '-ms-'];
var cssMap = {
    "float": 'cssFloat' in root.style ? 'cssFloat' : 'styleFloat',
    background: "backgroundColor"
};
var cssNumber = avalon.oneObject("columnCount,fillOpacity,fontWeight,lineHeight,opacity,orphans,widows,zIndex,zoom");
function cssName(name, host, camelCase) {
    if (cssMap[name]) {
        return cssMap[name];
    }
    host = host || root.style;
    for (var i = 0, n = prefixes.length; i < n; i++) {
        camelCase = camelize(prefixes[i] + name);
        if (camelCase in host) {
            return (cssMap[name] = camelCase);
        }
    }
    return null;
}
cssHooks["@:set"] = function(node, name, value) {
    node.style[name] = value;
};
if (window.getComputedStyle) {
    cssHooks["@:get"] = function(node, name) {
        var ret, styles = window.getComputedStyle(node, null);
        if (styles) {
            ret = name === "filter" ? styles.getPropertyValue(name) : styles[name];
            if (ret === "") {
                ret = node.style[name]; //其他浏览器需要我们手动取内联样式
            }
        }
        return ret;
    };
} else {
    var rnumnonpx = /^-?(?:\d*\.)?\d+(?!px)[^\d\s]+$/i;
    var rposition = /^(top|right|bottom|left)$/;
    var ie8 = !!window.XDomainRequest;
    var salpha = "DXImageTransform.Microsoft.Alpha";
    var border = {
        thin: ie8 ? '1px' : '2px',
        medium: ie8 ? '3px' : '4px',
        thick: ie8 ? '5px' : '6px'
    };
    cssHooks["@:get"] = function(node, name) {
        //取得精确值，不过它有可能是带em,pc,mm,pt,%等单位
        var currentStyle = node.currentStyle;
        var ret = currentStyle[name];
        if ((rnumnonpx.test(ret) && !rposition.test(ret))) {
            //①，保存原有的style.left, runtimeStyle.left,
            var style = node.style,
                left = style.left,
                rsLeft = node.runtimeStyle.left;
            //②由于③处的style.left = xxx会影响到currentStyle.left，
            //因此把它currentStyle.left放到runtimeStyle.left，
            //runtimeStyle.left拥有最高优先级，不会style.left影响
            node.runtimeStyle.left = currentStyle.left;
            //③将精确值赋给到style.left，然后通过IE的另一个私有属性 style.pixelLeft
            //得到单位为px的结果；fontSize的分支见http://bugs.jquery.com/ticket/760
            style.left = name === 'fontSize' ? '1em' : (ret || 0);
            ret = style.pixelLeft + "px";
            //④还原 style.left，runtimeStyle.left
            style.left = left;
            node.runtimeStyle.left = rsLeft;
        }
        if (ret === "medium") {
            name = name.replace("Width", "Style");
            //border width 默认值为medium，即使其为0"
            if (currentStyle[name] === "none") {
                ret = "0px";
            }
        }
        return ret === "" ? "auto" : border[ret] || ret;
    };
    cssHooks["opacity:set"] = function(node, value) {
        node.style.filter = 'alpha(opacity=' + value * 100 + ')';
        node.style.zoom = 1;
    };
    cssHooks["opacity:get"] = function(node) {
        //这是最快的获取IE透明值的方式，不需要动用正则了！
        var alpha = node.filters.alpha || node.filters[salpha],
            op = alpha ? alpha.opacity : 100;
        return (op / 100) + ""; //确保返回的是字符串
    };
}
"Width,Height".replace(rword, function(name) {
    var method = name.toLowerCase(),
        clientProp = "client" + name,
        scrollProp = "scroll" + name,
        offsetProp = "offset" + name;
    avalon.fn[method] = function(value) {
        var node = this[0];
        if (arguments.length === 0) {
            if (node.setTimeout) { //取得窗口尺寸,IE9后可以用node.innerWidth /innerHeight代替
                return node["inner" + name] || node.document.documentElement[clientProp];
            }
            if (node.nodeType === 9) { //取得页面尺寸
                var doc = node.documentElement;
                //FF chrome    html.scrollHeight< body.scrollHeight
                //IE 标准模式 : html.scrollHeight> body.scrollHeight
                //IE 怪异模式 : html.scrollHeight 最大等于可视窗口多一点？
                return Math.max(node.body[scrollProp], doc[scrollProp], node.body[offsetProp], doc[offsetProp], doc[clientProp]);
            }
            return parseFloat(this.css(method)) || 0;
        } else {
            return this.css(method, value);
        }
    };
});
avalon.fn.offset = function() { //取得距离页面左右角的坐标
    var node = this[0],
        doc = node && node.ownerDocument;
    var pos = {
        left: 0,
        top: 0
    };
    if (!doc) {
        return pos;
    }
    //http://hkom.blog1.fc2.com/?mode=m&no=750 body的偏移量是不包含margin的
    //我们可以通过getBoundingClientRect来获得元素相对于client的rect.
    //http://msdn.microsoft.com/en-us/library/ms536433.aspx
    var box = node.getBoundingClientRect(),
    //chrome1+, firefox3+, ie4+, opera(yes) safari4+
        win = doc.defaultView || doc.parentWindow,
        root = (navigator.vendor || doc.compatMode === "BackCompat") ? doc.body : doc.documentElement,
        clientTop = root.clientTop >> 0,
        clientLeft = root.clientLeft >> 0,
        scrollTop = win.pageYOffset || root.scrollTop,
        scrollLeft = win.pageXOffset || root.scrollLeft;
    // 把滚动距离加到left,top中去。
    // IE一些版本中会自动为HTML元素加上2px的border，我们需要去掉它
    // http://msdn.microsoft.com/en-us/library/ms533564(VS.85).aspx
    pos.top = box.top + scrollTop - clientTop, pos.left = box.left + scrollLeft - clientLeft;
    return pos;
};