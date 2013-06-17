//==================================================
// avalon 0.7 独立版  by 司徒正美 2013.5.24
// 疑问:
//    是否成熟? 成熟
//    什么协议? MIT, (五种开源协议的比较(BSD,Apache,GPL,LGPL,MIThttp://www.awflasher.com/blog/archives/939)
//    依赖情况? 没有任何依赖，可自由搭配jQuery, mass等使用,并不会引发冲突问题
//==================================================



    /*********************************************************************
     *                            Filters                              *
     **********************************************************************/
    var filters = avalon.filters = {
        uppercase: function(str) {
            return str.toUpperCase();
        },
        html: function(str) {
            return str;
        },
        lowercase: function(str) {
            return str.toLowerCase();
        },
        truncate: function(target, length, truncation) {
            //length，新字符串长度，truncation，新字符串的结尾的字段,返回新字符串
            length = length || 30;
            truncation = truncation === void(0) ? "..." : truncation;
            return target.length > length ? target.slice(0, length - truncation.length) + truncation : String(target);
        },
        camelize: camelize,
        escape: function(target) {
            //将字符串经过 html 转义得到适合在页面中显示的内容, 例如替换 < 为 &lt;
            return target.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        },
        currency: function(number, symbol) {
            symbol = symbol || "￥";
            return symbol + avalon.filters.number(number);
        },
        number: function(number, decimals, dec_point, thousands_sep) {
            //与PHP的number_format完全兼容
            //number	必需，要格式化的数字
            //decimals	可选，规定多少个小数位。
            //dec_point	可选，规定用作小数点的字符串（默认为 . ）。
            //thousands_sep	可选，规定用作千位分隔符的字符串（默认为 , ），如果设置了该参数，那么所有其他参数都是必需的。
            // http://kevin.vanzonneveld.net
            number = (number + "").replace(/[^0-9+\-Ee.]/g, '');
            var n = !isFinite(+number) ? 0 : +number,
                    prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
                    sep = thousands_sep || ",",
                    dec = dec_point || ".",
                    s = '',
                    toFixedFix = function(n, prec) {
                var k = Math.pow(10, prec);
                return '' + Math.round(n * k) / k;
            };
            // Fix for IE parseFloat(0.55).toFixed(0) = 0;
            s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
            if (s[0].length > 3) {
                s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
            }
            if ((s[1] || '').length < prec) {
                s[1] = s[1] || '';
                s[1] += new Array(prec - s[1].length + 1).join('0');
            }
            return s.join(dec);
        }
    }
    /*
     'yyyy': 4 digit representation of year (e.g. AD 1 => 0001, AD 2010 => 2010)
     'yy': 2 digit representation of year, padded (00-99). (e.g. AD 2001 => 01, AD 2010 => 10)
     'y': 1 digit representation of year, e.g. (AD 1 => 1, AD 199 => 199)
     'MMMM': Month in year (January-December)
     'MMM': Month in year (Jan-Dec)
     'MM': Month in year, padded (01-12)
     'M': Month in year (1-12)
     'dd': Day in month, padded (01-31)
     'd': Day in month (1-31)
     'EEEE': Day in Week,(Sunday-Saturday)
     'EEE': Day in Week, (Sun-Sat)
     'HH': Hour in day, padded (00-23)
     'H': Hour in day (0-23)
     'hh': Hour in am/pm, padded (01-12)
     'h': Hour in am/pm, (1-12)
     'mm': Minute in hour, padded (00-59)
     'm': Minute in hour (0-59)
     'ss': Second in minute, padded (00-59)
     's': Second in minute (0-59)
     'a': am/pm marker
     'Z': 4 digit (+sign) representation of the timezone offset (-1200-+1200)
     format string can also be one of the following predefined localizable formats:
     
     'medium': equivalent to 'MMM d, y h:mm:ss a' for en_US locale (e.g. Sep 3, 2010 12:05:08 pm)
     'short': equivalent to 'M/d/yy h:mm a' for en_US locale (e.g. 9/3/10 12:05 pm)
     'fullDate': equivalent to 'EEEE, MMMM d,y' for en_US locale (e.g. Friday, September 3, 2010)
     'longDate': equivalent to 'MMMM d, y' for en_US locale (e.g. September 3, 2010
     'mediumDate': equivalent to 'MMM d, y' for en_US locale (e.g. Sep 3, 2010)
     'shortDate': equivalent to 'M/d/yy' for en_US locale (e.g. 9/3/10)
     'mediumTime': equivalent to 'h:mm:ss a' for en_US locale (e.g. 12:05:08 pm)
     'shortTime': equivalent to 'h:mm a' for en_US locale (e.g. 12:05 pm)
     */
    new function() {
        function toInt(str) {
            return parseInt(str, 10);
        }

        function padNumber(num, digits, trim) {
            var neg = '';
            if (num < 0) {
                neg = '-';
                num = -num;
            }
            num = '' + num;
            while (num.length < digits)
                num = '0' + num;
            if (trim)
                num = num.substr(num.length - digits);
            return neg + num;
        }

        function dateGetter(name, size, offset, trim) {
            return function(date) {
                var value = date['get' + name]();
                if (offset > 0 || value > -offset)
                    value += offset;
                if (value === 0 && offset === -12) {
                    value = 12;
                }
                return padNumber(value, size, trim);
            };
        }

        function dateStrGetter(name, shortForm) {
            return function(date, formats) {
                var value = date['get' + name]();
                var get = (shortForm ? ('SHORT' + name) : name).toUpperCase();
                return formats[get][value];
            };
        }

        function timeZoneGetter(date) {
            var zone = -1 * date.getTimezoneOffset();
            var paddedZone = (zone >= 0) ? "+" : "";
            paddedZone += padNumber(Math[zone > 0 ? 'floor' : 'ceil'](zone / 60), 2) + padNumber(Math.abs(zone % 60), 2);
            return paddedZone;
        }
        //取得上午下午

        function ampmGetter(date, formats) {
            return date.getHours() < 12 ? formats.AMPMS[0] : formats.AMPMS[1];
        }
        var DATE_FORMATS = {
            yyyy: dateGetter('FullYear', 4),
            yy: dateGetter('FullYear', 2, 0, true),
            y: dateGetter('FullYear', 1),
            MMMM: dateStrGetter('Month'),
            MMM: dateStrGetter('Month', true),
            MM: dateGetter('Month', 2, 1),
            M: dateGetter('Month', 1, 1),
            dd: dateGetter('Date', 2),
            d: dateGetter('Date', 1),
            HH: dateGetter('Hours', 2),
            H: dateGetter('Hours', 1),
            hh: dateGetter('Hours', 2, -12),
            h: dateGetter('Hours', 1, -12),
            mm: dateGetter('Minutes', 2),
            m: dateGetter('Minutes', 1),
            ss: dateGetter('Seconds', 2),
            s: dateGetter('Seconds', 1),
            sss: dateGetter('Milliseconds', 3),
            EEEE: dateStrGetter('Day'),
            EEE: dateStrGetter('Day', true),
            a: ampmGetter,
            Z: timeZoneGetter
        };
        var DATE_FORMATS_SPLIT = /((?:[^yMdHhmsaZE']+)|(?:'(?:[^']|'')*')|(?:E+|y+|M+|d+|H+|h+|m+|s+|a|Z))(.*)/,
                NUMBER_STRING = /^\d+$/;
        var R_ISO8601_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/;
        // 1        2       3         4          5          6          7          8  9     10      11

        function jsonStringToDate(string) {
            var match;
            if (match = string.match(R_ISO8601_STR)) {
                var date = new Date(0),
                        tzHour = 0,
                        tzMin = 0,
                        dateSetter = match[8] ? date.setUTCFullYear : date.setFullYear,
                        timeSetter = match[8] ? date.setUTCHours : date.setHours;
                if (match[9]) {
                    tzHour = toInt(match[9] + match[10]);
                    tzMin = toInt(match[9] + match[11]);
                }
                dateSetter.call(date, toInt(match[1]), toInt(match[2]) - 1, toInt(match[3]));
                timeSetter.call(date, toInt(match[4] || 0) - tzHour, toInt(match[5] || 0) - tzMin, toInt(match[6] || 0), toInt(match[7] || 0));
                return date;
            }
            return string;
        }
        filters.date = function(date, format) {
            var locate = filters.date.locate,
                    text = "",
                    parts = [],
                    fn, match;
            format = format || "mediumDate";
            format = locate[format] || format;
            if (typeof date === "string") {
                if (NUMBER_STRING.test(date)) {
                    date = toInt(date);
                } else {
                    date = jsonStringToDate(date);
                }
            }

            if (avalon.type(date) === "Number") {
                date = new Date(date);
            }
            if (avalon.type(date) !== "Date") {
                return;
            }
            while (format) {
                match = DATE_FORMATS_SPLIT.exec(format);
                if (match) {
                    parts = parts.concat(match.slice(1));
                    format = parts.pop();
                } else {
                    parts.push(format);
                    format = null;
                }
            }
            parts.forEach(function(value) {
                fn = DATE_FORMATS[value];
                text += fn ? fn(date, locate) : value.replace(/(^'|'$)/g, '').replace(/''/g, "'");
            });
            return text;
        };
        var locate = {
            AMPMS: {
                0: "上午",
                1: "下午"
            },
            DAY: {
                0: "星期日",
                1: "星期一",
                2: "星期二",
                3: "星期三",
                4: "星期四",
                5: "星期五",
                6: "星期六"
            },
            MONTH: {
                0: "1月",
                1: "2月",
                2: "3月",
                3: "4月",
                4: "5月",
                5: "6月",
                6: "7月",
                7: "8月",
                8: "9月",
                9: "10月",
                10: "11月",
                11: "12月"
            },
            SHORTDAY: {
                "0": "周日",
                "1": "周一",
                "2": "周二",
                "3": "周三",
                "4": "周四",
                "5": "周五",
                "6": "周六"
            },
            fullDate: "y年M月d日EEEE",
            longDate: "y年M月d日",
            medium: "yyyy-M-d ah:mm:ss",
            mediumDate: "yyyy-M-d",
            mediumTime: "ah:mm:ss",
            "short": "yy-M-d ah:mm",
            shortDate: "yy-M-d",
            shortTime: "ah:mm"
        };
        locate.SHORTMONTH = locate.MONTH;
        filters.date.locate = locate;
    };
 
//    avalon.ready(function() {
//        avalon.scan(document.body);
//    });



//2012.8.31 完成 v1
//https://github.com/RubyLouvre/mass-Framework/commit/708e203a0e274b69729d08de8fe1cde2722520d2
//2012.9.22 完成 v2 90%代码重写，使用新的思路收集依赖完成双向绑定链
//2012.12.11 完成 v3 50% 代码重写 数据绑定部分焕然一新，属性名得到绑定器，
//2012.12.13 把所有公开API放到MVVM二级命名空间上
//2012.12.15 添加toJS方法，为collection补上sort erase reverse方法
//2013.4,23 v4 https://github.com/RubyLouvre/mass-Framework/blob/1.3/avalon.js
//2013.4.29 合并options与selecting绑定，为each绑定产生的子ViewModel添加$first, $last属性，
//写死它的$index, $remove属性，重构generateID
//2013.4.30 重构scanTag, generateID，更改fixEvent的条件
//2013.5.1 v5 发布 https://github.com/RubyLouvre/mass-Framework/blob/1.4/avalon.js 添加一个jquery like对象
//2013.5.3 v5.1 性能大幅提升 新的路标系统 hidden的运用 重构model绑定的select 重构addItemView
//2013.5.9 v6 添加ms-hover绑定, 重构mouseenter, mouseleave事件，对data方法进行增强
//2013.5.15 v6.1 添加ms-active
//2013.5.21 v6.2 添加$json与多级监听
//2013.5.22 0.6.3 fix getValueFunction bug; fix  avalon.bind return false bug;fix ms-css bug
//2013.5.25 0.7 添加template绑定, 优化渲染速度,插入与移除节点的操作
//2013 6 2 3群月王 ms-visible bug
//黄轩http://www.cnblogs.com/lcllao/archive/2012/09/30/2709187.html