"use strict";
var Utilities = {
    VERSION: "2.3.4", error: function () {
        console.error.apply(console, arguments)
    }, warn: function () {
        console.log.apply(console, arguments)
    }, log: function () {
        console.log.apply(console, arguments)
    }, getHexUUID: function () {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            if (i == 8 || i == 13 || i == 18 || i == 23) {
                s[i] = "-"
            } else {
                s[i] = hexDigits.substr(Math.floor(Math.random() * 16), 1)
            }
        }
        var uuid = s.join("");
        return uuid
    }, getSalt: function (l) {
        if (l < 32 || l > 256) {
            throw"invalid salt length"
        }
        var s = "";
        while (s.length < l) {
            s += Utilities.getHexUUID()
        }
        return s.slice(0, l)
    }, xorString: function (str1, str2) {
        var result = "";
        if (str1.length !== str2.length) {
            throw"strings must be equal length"
        }
        for (var i = 0; i < str1.length; i++) {
            result += String.fromCharCode(str1[i].charCodeAt(0) ^ str2[i].charCodeAt(0))
        }
        return result
    }, getPlatformProcessor: function () {
        if (navigator.oscpu) {
            return navigator.oscpu
        }
        if (navigator.cpuClass) {
            return navigator.cpuClass
        }
        return "unknown"
    }, getPlatformName: function () {
        if (navigator.appVersion.indexOf("Win") !== -1) {
            return "Microsoft Windows"
        }
        if (navigator.appVersion.indexOf("Mac") !== -1) {
            return "Mac OSX"
        }
        if (navigator.appVersion.indexOf("Linux") !== -1) {
            return "Linux"
        }
        if (navigator.appVersion.indexOf("X11") !== -1) {
            return "Posix"
        }
        return "unknown"
    }, getPlatform: function () {
        if (navigator.appVersion.indexOf("Win") !== -1) {
            return "win32"
        }
        if (navigator.appVersion.indexOf("Mac") !== -1) {
            return "darwin"
        }
        if (navigator.appVersion.indexOf("Linux") !== -1) {
            return "linux"
        }
        if (navigator.appVersion.indexOf("X11") !== -1) {
            return "posix"
        }
        return "unknown"
    }, getFirstBrowserLanguage: function () {
        var nav = window.navigator,
            browserLanguagePropertyKeys = ["language", "browserLanguage", "systemLanguage", "userLanguage"], i,
            language;
        if (Array.isArray(nav.languages)) {
            for (i = 0; i < nav.languages.length; i++) {
                language = nav.languages[i];
                if (language && language.length) {
                    return language
                }
            }
        }
        for (i = 0; i < browserLanguagePropertyKeys.length; i++) {
            var prop = browserLanguagePropertyKeys[i];
            language = nav[prop];
            if (language && language.length) {
                return language
            }
        }
        return null
    }, getKeyboardLayout: function () {
        var v = Utilities.getFirstBrowserLanguage();
        console.debug("getFirstBrowserLanguage()=", v);
        if (v == null) {
            return "us"
        }
        v = v.split(",")[0];
        var l = v.split("-", 2);
        if (l.length === 1) {
            l = v.split("_", 2)
        }
        if (l.length === 1) {
            return ""
        }
        var layout = l[1].toLowerCase();
        console.debug("getKeyboardLayout()=", layout);
        return layout
    }, canUseWebP: function () {
        var elem = document.createElement("canvas");
        var ctx = elem.getContext("2d");
        if (!ctx) {
            return false
        }
        return elem.toDataURL("image/webp").indexOf("data:image/webp") == 0
    }, getAudioContextClass: function () {
        return window.AudioContext || window.webkitAudioContext || window.audioContext
    }, getAudioContext: function () {
        if (Utilities.audio_context) {
            return Utilities.audio_context
        }
        var acc = Utilities.getAudioContextClass();
        if (!acc) {
            return null
        }
        Utilities.audio_context = new acc;
        return Utilities.audio_context
    }, isMacOS: function () {
        return navigator.platform.indexOf("Mac") >= 0
    }, isWindows: function () {
        return navigator.platform.indexOf("Win") >= 0
    }, isLinux: function () {
        return navigator.platform.indexOf("Linux") >= 0
    }, isFirefox: function () {
        var ua = navigator.userAgent.toLowerCase();
        return ua.indexOf("firefox") >= 0
    }, isOpera: function () {
        var ua = navigator.userAgent.toLowerCase();
        return ua.indexOf("opera") >= 0
    }, isSafari: function () {
        var ua = navigator.userAgent.toLowerCase();
        return ua.indexOf("safari") >= 0 && ua.indexOf("chrome") < 0
    }, isChrome: function () {
        var isChromium = window.chrome, winNav = window.navigator, vendorName = winNav.vendor,
            isOpera = winNav.userAgent.indexOf("OPR") > -1, isIEedge = winNav.userAgent.indexOf("Edge") > -1,
            isIOSChrome = winNav.userAgent.match("CriOS");
        if (isIOSChrome) {
            return true
        } else if (isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isOpera === false && isIEedge === false) {
            return true
        } else {
            return false
        }
    }, isIE: function () {
        return navigator.userAgent.indexOf("MSIE") != -1
    }, getSimpleUserAgentString: function () {
        if (Utilities.isFirefox()) {
            return "Firefox"
        } else if (Utilities.isOpera()) {
            return "Opera"
        } else if (Utilities.isSafari()) {
            return "Safari"
        } else if (Utilities.isChrome()) {
            return "Chrome"
        } else if (Utilities.isIE()) {
            return "MSIE"
        } else {
            return ""
        }
    }, getColorGamut: function () {
        if (!window.matchMedia) {
            return ""
        } else if (window.matchMedia("(color-gamut: rec2020)").matches) {
            return "rec2020"
        } else if (window.matchMedia("(color-gamut: p3)").matches) {
            return "P3"
        } else if (window.matchMedia("(color-gamut: srgb)").matches) {
            return "srgb"
        } else {
            return ""
        }
    }, isEventSupported: function (event) {
        var testEl = document.createElement("div");
        var isSupported;
        event = "on" + event;
        isSupported = event in testEl;
        if (!isSupported) {
            testEl.setAttribute(event, "return;");
            isSupported = typeof testEl[event] === "function"
        }
        testEl = null;
        return isSupported
    }, normalizeWheel: function (event) {
        var PIXEL_STEP = 10;
        var LINE_HEIGHT = 40;
        var PAGE_HEIGHT = 800;
        var sX = 0, sY = 0, pX = 0, pY = 0;
        if ("detail" in event) {
            sY = event.detail
        }
        if ("wheelDelta" in event) {
            sY = -event.wheelDelta / 120
        }
        if ("wheelDeltaY" in event) {
            sY = -event.wheelDeltaY / 120
        }
        if ("wheelDeltaX" in event) {
            sX = -event.wheelDeltaX / 120
        }
        if ("axis" in event && event.axis === event.HORIZONTAL_AXIS) {
            sX = sY;
            sY = 0
        }
        pX = sX * PIXEL_STEP;
        pY = sY * PIXEL_STEP;
        if ("deltaY" in event) {
            pY = event.deltaY
        }
        if ("deltaX" in event) {
            pX = event.deltaX
        }
        if ((pX || pY) && event.deltaMode) {
            if (event.deltaMode == 1) {
                pX *= LINE_HEIGHT;
                pY *= LINE_HEIGHT
            } else {
                pX *= PAGE_HEIGHT;
                pY *= PAGE_HEIGHT
            }
        }
        if (pX && !sX) {
            sX = pX < 1 ? -1 : 1
        }
        if (pY && !sY) {
            sY = pY < 1 ? -1 : 1
        }
        return {spinX: sX, spinY: sY, pixelX: pX, pixelY: pY, deltaMode: event.deltaMode || 0}
    }, saveFile: function (filename, data, mimetype) {
        var a = document.createElement("a");
        a.style = "display: none";
        document.body.appendChild(a);
        var blob = new Blob([data], mimetype);
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url)
    }, endsWith: function (str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1
    }, monotonicTime: function () {
        if (performance) {
            return Math.round(performance.now())
        }
        return Date.now()
    }, StringToUint8: function (str) {
        var u8a = new Uint8Array(str.length);
        for (var i = 0, j = str.length; i < j; ++i) {
            u8a[i] = str.charCodeAt(i)
        }
        return u8a
    }, Uint8ToString: function (u8a) {
        var CHUNK_SZ = 32768;
        var c = [];
        for (var i = 0; i < u8a.length; i += CHUNK_SZ) {
            c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)))
        }
        return c.join("")
    }, ArrayBufferToBase64: function (uintArray) {
        var s = "";
        var skip = 10400;
        if (uintArray.subarray) {
            for (var i = 0, len = uintArray.length; i < len; i += skip) {
                s += String.fromCharCode.apply(null, uintArray.subarray(i, Math.min(i + skip, len)))
            }
        } else {
            for (var i = 0, len = uintArray.length; i < len; i += skip) {
                s += String.fromCharCode.apply(null, uintArray.slice(i, Math.min(i + skip, len)))
            }
        }
        return window.btoa(s)
    }, ParseResponseHeaders: function (headerStr) {
        var headers = {};
        if (!headerStr) {
            return headers
        }
        var headerPairs = headerStr.split("\r\n");
        for (var i = 0; i < headerPairs.length; i++) {
            var headerPair = headerPairs[i];
            var index = headerPair.indexOf(": ");
            if (index > 0) {
                var key = headerPair.substring(0, index);
                var val = headerPair.substring(index + 2);
                headers[key] = val
            }
        }
        return headers
    }, parseParams: function (q) {
        var params = {}, e, a = /\+/g, r = /([^&=]+)=?([^&]*)/g, d = function (s) {
            return decodeURIComponent(s.replace(a, " "))
        };
        while (e = r.exec(q)) params[d(e[1])] = d(e[2]);
        return params
    }, getparam: function (prop) {
        var getParameter = window.location.getParameter;
        if (!getParameter) {
            getParameter = function (key) {
                if (!window.location.queryStringParams) window.location.queryStringParams = Utilities.parseParams(window.location.search.substring(1));
                return window.location.queryStringParams[key]
            }
        }
        var value = getParameter(prop);
        if (value === undefined && typeof sessionStorage !== undefined) {
            value = sessionStorage.getItem(prop)
        }
        return value
    }, getboolparam: function (prop, default_value) {
        var v = Utilities.getparam(prop);
        if (v === null) {
            return default_value
        }
        return ["true", "on", "1", "yes", "enabled"].indexOf(String(v).toLowerCase()) >= 0
    }, getConnectionInfo: function () {
        var c = navigator.connection;
        if (!c) {
            return {}
        }
        var i = {};
        if (c.type) {
            i["type"] = c.type
        }
        if (c.effectiveType) {
            i["effective-type"] = c.effectiveType
        }
        if (!isNaN(c.downlink) && !isNaN(c.downlink) && c.downlink > 0 && isFinite(c.downlink)) {
            i["downlink"] = Math.round(c.downlink * 1e3 * 1e3)
        }
        if (!isNaN(c.downlinkMax) && !isNaN(c.downlinkMax) && c.downlinkMax > 0 && isFinite(c.downlinkMax)) {
            i["downlink.max"] = Math.round(c.downlinkMax * 1e3 * 1e3)
        }
        if (!isNaN(c.rtt) && c.rtt > 0) {
            i["rtt"] = c.rtt
        }
        return i
    }
};
var MOVERESIZE_SIZE_TOPLEFT = 0;
var MOVERESIZE_SIZE_TOP = 1;
var MOVERESIZE_SIZE_TOPRIGHT = 2;
var MOVERESIZE_SIZE_RIGHT = 3;
var MOVERESIZE_SIZE_BOTTOMRIGHT = 4;
var MOVERESIZE_SIZE_BOTTOM = 5;
var MOVERESIZE_SIZE_BOTTOMLEFT = 6;
var MOVERESIZE_SIZE_LEFT = 7;
var MOVERESIZE_MOVE = 8;
var MOVERESIZE_SIZE_KEYBOARD = 9;
var MOVERESIZE_MOVE_KEYBOARD = 10;
var MOVERESIZE_CANCEL = 11;
var MOVERESIZE_DIRECTION_STRING = {
    0: "SIZE_TOPLEFT",
    1: "SIZE_TOP",
    2: "SIZE_TOPRIGHT",
    3: "SIZE_RIGHT",
    4: "SIZE_BOTTOMRIGHT",
    5: "SIZE_BOTTOM",
    6: "SIZE_BOTTOMLEFT",
    7: "SIZE_LEFT",
    8: "MOVE",
    9: "SIZE_KEYBOARD",
    10: "MOVE_KEYBOARD",
    11: "CANCEL"
};
var MOVERESIZE_DIRECTION_JS_NAME = {0: "nw", 1: "n", 2: "ne", 3: "e", 4: "se", 5: "s", 6: "sw", 7: "w"};