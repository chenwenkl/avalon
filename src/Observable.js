
var Observable = {
    $watch: function(type, callback) {
        var callbacks = this.$events[type];
        if (callbacks) {
            callbacks.push(callback);
        } else {
            this.$events[type] = [callback];
        }
        return this;
    },
    $unwatch: function(type, callback) {
        var n = arguments.length;
        if (n === 0) {
            this.$events = {};
        } else if (n === 1) {
            this.$events[type] = [];
        } else {
            var callbacks = this.$events[type] || [];
            var i = callbacks.length;
            while (--i > -1) {
                if (callbacks[i] === callback) {
                    return callbacks.splice(i, 1);
                }
            }
        }
        return this;
    },
    $fire: function(type) {
        var callbacks = this.$events[type] || []; //防止影响原数组
        var all = this.$events.$all || [];
        var args = [].slice.call(arguments, 1);
        for (var i = 0, callback; callback = callbacks[i++]; ) {
            callback.apply(this, args);
        }
        for (var i = 0, callback; callback = all[i++]; ) {
            callback.apply(this, args);
        }
    }
};