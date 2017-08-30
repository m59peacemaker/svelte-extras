var arrayNotationPattern = /\[\s*(\d+)\s*\]/g;
function makeArrayMethod(name) {
    return function (keypath) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var parts = keypath.replace(arrayNotationPattern, '.$1').split('.');
        var key = parts.shift();
        var value = this.get(key);
        var array = value;
        while (parts.length)
            array = array[parts.shift()];
        var result = array[name].apply(array, args);
        this.set((_a = {}, _a[key] = value, _a));
        return result;
        var _a;
    };
}
var push = makeArrayMethod('push');
var pop = makeArrayMethod('pop');
var shift = makeArrayMethod('shift');
var unshift = makeArrayMethod('unshift');
var splice = makeArrayMethod('splice');
var sort = makeArrayMethod('sort');
var reverse = makeArrayMethod('reverse');

var scheduler = {
    components: [],
    running: false,
    add: function (component) {
        if (~scheduler.components.indexOf(component))
            return;
        scheduler.components.push(component);
        if (!scheduler.running) {
            scheduler.running = true;
            requestAnimationFrame(scheduler.next);
        }
    },
    next: function () {
        var now = window.performance.now();
        var hasComponents = false;
        var i = scheduler.components.length;
        while (i--) {
            var component = scheduler.components[i];
            var data = {};
            var hasTweens = false;
            for (var key in component._currentTweens) {
                var t = component._currentTweens[key];
                if (now >= t.end) {
                    data[key] = t.to;
                    delete component._currentTweens[key];
                    t.fulfil();
                }
                else {
                    hasTweens = true;
                    hasComponents = true;
                    if (now >= t.start) {
                        var p = (now - t.start) / t.duration;
                        data[key] = t.value(t.ease(p));
                    }
                }
            }
            component._tweening = true;
            component.set(data);
            component._tweening = false;
            if (!hasTweens)
                scheduler.components.splice(i, 1);
        }
        if (hasComponents) {
            requestAnimationFrame(scheduler.next);
        }
        else {
            scheduler.running = false;
        }
    }
};
function snap(to) {
    return function () { return to; };
}
function interpolate(a, b) {
    if (a === b || a !== a)
        return snap(a);
    var type = typeof a;
    if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
        throw new Error('Cannot interpolate values of different type');
    }
    if (Array.isArray(a)) {
        var arr_1 = b.map(function (bi, i) {
            return interpolate(a[i], bi);
        });
        return function (t) {
            return arr_1.map(function (fn) { return fn(t); });
        };
    }
    if (type === 'object') {
        if (!a || !b)
            throw new Error('Object cannot be null');
        if (isDate(a) && isDate(b)) {
            a = a.getTime();
            b = b.getTime();
            var delta_1 = b - a;
            return function (t) {
                return new Date(a + t * delta_1);
            };
        }
        var keys_1 = Object.keys(b);
        var interpolators_1 = {};
        var result_1 = {};
        keys_1.forEach(function (key) {
            interpolators_1[key] = interpolate(a[key], b[key]);
        });
        return function (t) {
            keys_1.forEach(function (key) {
                result_1[key] = interpolators_1[key](t);
            });
            return result_1;
        };
    }
    if (type === 'number') {
        var delta_2 = b - a;
        return function (t) {
            return a + t * delta_2;
        };
    }
    throw new Error("Cannot interpolate " + type + " values");
}
function linear(x) {
    return x;
}
function tween(key, to, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    if (!this._currentTweens) {
        this._currentTweens = Object.create(null);
        this._tweening = false;
        var set_1 = this.set;
        this.set = function (data) {
            if (!_this._tweening) {
                for (var key_1 in data) {
                    if (_this._currentTweens[key_1])
                        _this._currentTweens[key_1].abort();
                }
            }
            set_1.call(_this, data);
        };
    }
    var durationProgressModifier = 1;
    if (this._currentTweens[key]) {
        var progressRatio = this._currentTweens[key].abort().progressRatio;
        if (options.adjustDuration) {
            durationProgressModifier = progressRatio;
        }
    }
    var start = window.performance.now() + (options.delay || 0);
    var duration = (options.duration || 400) * durationProgressModifier;
    var end = start + duration;
    var t = {
        key: key,
        value: (options.interpolate || interpolate)(this.get(key), to),
        to: to,
        start: start,
        end: end,
        duration: duration,
        ease: options.easing || linear,
        running: true,
        abort: function () {
            t.running = false;
            delete _this._currentTweens[key];
            return { progressRatio: (window.performance.now() - start) / duration };
        }
    };
    this._currentTweens[key] = t;
    scheduler.add(this);
    var running;
    var promise = new Promise(function (fulfil) {
        t.fulfil = fulfil;
    });
    promise.abort = t.abort;
    return promise;
}
function isDate(obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
}

function getNestedValue(obj, parts) {
    for (var i = 0; i < parts.length; i += 1) {
        if (!obj)
            return undefined;
        obj = obj[parts[i]];
    }
    return obj;
}
function observeDeep(keypath, callback, opts) {
    var _this = this;
    var parts = keypath.replace(/\[(\d+)\]/g, '.$1').split('.');
    var key = parts.shift();
    var last = opts && opts.init === false
        ? getNestedValue(this.get(key), parts)
        : undefined;
    return this.observe(key, function (value) {
        value = getNestedValue(value, parts);
        if (value !== last ||
            typeof value === 'object' ||
            typeof value === 'function') {
            callback.call(_this, value, last);
        }
        last = value;
    }, opts);
}

function getDeep(keypath) {
    if (keypath === undefined) {
        return this.get();
    }
    var keys = keypath.replace(/\[(\d+)\]/g, '.$1').split('.');
    var value = this.get(keys[0]);
    for (var i = 1; i < keys.length; i++) {
        value = value[keys[i]];
    }
    return value;
}
function setDeep(keypath, value) {
    if (keypath === undefined) {
        return;
    }
    var keys = keypath.replace(/\[(\d+)\]/g, '.$1').split('.');
    var lastKey = keys.pop();
    // If not a nested keypath
    if (keys[0] === undefined) {
        var data_1 = {};
        data_1[lastKey] = value;
        this.set(data_1);
        return;
    }
    var object = this.get(keys[0]);
    for (var i = 1; i < keys.length; i++) {
        object = object[keys[i]];
    }
    object[lastKey] = value;
    var data = {};
    data[keys[0]] = this.get(keys[0]);
    this.set(data);
}

export { push, pop, shift, unshift, splice, sort, reverse, tween, observeDeep, getDeep, setDeep };
