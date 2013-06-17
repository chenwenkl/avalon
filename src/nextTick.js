
/*********************************************************************
 *                            UI缓冲处理                     *
 **********************************************************************/
var nextTick;
if (typeof setImmediate === "function") {
    // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
    nextTick = setImmediate.bind(window);
} else {
    (function() { //否则用一个链表来维护所有待执行的回调
        var head = {
            task: void 0,
            next: null
        };
        var tail = head;
        var maxPendingTicks = 2;
        var pendingTicks = 0;
        var queuedTasks = 0;
        var usedTicks = 0;
        var requestTick = void 0;
        function onTick() {
            --pendingTicks;
            if (++usedTicks >= maxPendingTicks) {
                usedTicks = 0;
                maxPendingTicks *= 4;
                var expectedTicks = queuedTasks && Math.min(
                    queuedTasks - 1,
                    maxPendingTicks);
                while (pendingTicks < expectedTicks) {
                    ++pendingTicks;
                    requestTick();
                }
            }

            while (queuedTasks) {
                --queuedTasks;
                head = head.next;
                var task = head.task;
                head.task = void 0;
                task();
            }

            usedTicks = 0;
        }
        nextTick = function(task) {
            tail = tail.next = {
                task: task,
                next: null
            };
            if (
                pendingTicks < ++queuedTasks && pendingTicks < maxPendingTicks) {
                ++pendingTicks;
                requestTick();
            }
        };
        //然后找一个最快响应的异步API来执行这个链表的函数
        //你可以用postMessage, image.onerror, xhr.onreadychange, MutationObserver
        //最差还有个setTimeout 0殿后 http://jsperf.com/postmessage
        if (typeof MessageChannel !== "undefined") { //管道通信API
            var channel = new MessageChannel();
            channel.port1.onmessage = onTick;
            requestTick = function() {
                channel.port2.postMessage(0);
            };
        } else {
            requestTick = function() { //IE6-8
                setTimeout(onTick, 0);
            };
        }
    })();
}
avalon.nextTick = nextTick;
 