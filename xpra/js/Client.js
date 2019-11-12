"use strict";

function XpraClient(container) {
    if (this.container = document.getElementById(container), !this.container) throw new Error("invalid container element");
    if (window.jQuery) {
        var me = this;
        jQuery(window).resize(jQuery.debounce(250, function (e) {
            me._screen_resized(e, me)
        }))
    }
    this.protocol = null, this.init_settings(), this.init_state()
}

var XPRA_CLIENT_FORCE_NO_WORKER = !1, CLIPBOARD_IMAGES = !0;
XpraClient.prototype.init_settings = function (container) {
    this.host = null, this.port = null, this.ssl = null, this.path = "", this.username = "", this.password = null, this.insecure = !1, this.uri = "", this.sharing = !1, this.open_url = !0, this.steal = !0, this.remote_logging = !0, this.enabled_encodings = [], this.supported_encodings = ["jpeg", "png", "rgb", "rgb32"], Utilities.canUseWebP() && this.supported_encodings.push("webp"), this.debug_categories = [], this.start_new_session = null, this.clipboard_enabled = !1, this.file_transfer = !1, this.keyboard_layout = null, this.printing = !1, this.bandwidth_limit = 0, this.reconnect = !0, this.reconnect_count = 5, this.reconnect_in_progress = !1, this.reconnect_delay = 1e3, this.reconnect_attempt = 0, this.swap_keys = Utilities.isMacOS(), this.HELLO_TIMEOUT = 3e4, this.PING_TIMEOUT = 15e3, this.PING_GRACE = 2e3, this.PING_FREQUENCY = 5e3, this.INFO_FREQUENCY = 1e3, this.uuid = Utilities.getHexUUID()
}, XpraClient.prototype.init_state = function (container) {
    function on_mousescroll(e) {
        me.on_mousescroll(e)
    }

    this.connected = !1, this.desktop_width = 0, this.desktop_height = 0, this.server_remote_logging = !1, this.server_start_time = -1, this.client_start_time = new Date, this.capabilities = {}, this.RGB_FORMATS = ["RGBX", "RGBA"], this.disconnect_reason = null, this.audio = null, this.audio_enabled = !1, this.audio_mediasource_enabled = null != MediaSourceUtil.getMediaSourceClass(), this.audio_aurora_enabled = "undefined" != typeof AV && null != AV && null != AV.Decoder && null != AV.Player.fromXpraSource, this.audio_httpstream_enabled = !0, this.audio_codecs = {}, this.audio_framework = null, this.audio_aurora_ctx = null, this.audio_codec = null, this.audio_context = Utilities.getAudioContext(), this.audio_state = null, this.aurora_codecs = {}, this.mediasource_codecs = {}, this.encryption = !1, this.encryption_key = null, this.cipher_in_caps = null, this.cipher_out_caps = null, this.browser_language = Utilities.getFirstBrowserLanguage(), this.browser_language_change_embargo_time = 0, this.key_layout = null, this.mousedown_event = null, this.last_mouse_x = null, this.last_mouse_y = null, this.wheel_delta_x = 0, this.wheel_delta_y = 0, this.mouse_grabbed = !1, this.clipboard_datatype = null, this.clipboard_buffer = "", this.clipboard_server_buffers = {}, this.clipboard_pending = !1, this.clipboard_targets = ["UTF8_STRING", "TEXT", "STRING", "text/plain"], CLIPBOARD_IMAGES && navigator.clipboard && navigator.clipboard.write && this.clipboard_targets.push("image/png"), this.remote_printing = !1, this.remote_file_transfer = !1, this.remote_open_files = !1, this.hello_timer = null, this.info_timer = null, this.info_request_pending = !1, this.server_last_info = {}, this.ping_timeout_timer = null, this.ping_grace_timer = null, this.ping_timer = null, this.last_ping_server_time = 0, this.last_ping_local_time = 0, this.last_ping_echoed_time = 0, this.server_ping_latency = 0, this.client_ping_latency = 0, this.server_load = null, this.server_ok = !1, this.queue_draw_packets = !1, this.dQ = [], this.dQ_interval_id = null, this.process_interval = 4, this.server_display = "", this.server_platform = "", this.server_resize_exact = !1, this.server_screen_sizes = [], this.server_is_desktop = !1, this.server_is_shadow = !1, this.server_readonly = !1, this.server_connection_data = !1, this.xdg_menu = null, this.id_to_window = {}, this.ui_events = 0, this.pending_redraw = [], this.draw_pending = 0, this.topwindow = null, this.topindex = 0, this.focus = -1,
        jQuery("#screen").mousedown(function (e) {
            me.on_mousedown(e)
        }),
        jQuery("#screen").mouseup(function (e) {
            me.on_mouseup(e)
        }),
        jQuery("#screen").mousemove(function (e) {
            me.on_mousemove(e)
        });

    var me = this, div = document.getElementById("screen");
    Utilities.isEventSupported("wheel") ? div.addEventListener("wheel", on_mousescroll, !1) : Utilities.isEventSupported("mousewheel") ? div.addEventListener("mousewheel", on_mousescroll, !1) : Utilities.isEventSupported("DOMMouseScroll") && div.addEventListener("DOMMouseScroll", on_mousescroll, !1)
}, XpraClient.prototype.send = function () {
    this.protocol && this.protocol.send.apply(this.protocol, arguments)
}, XpraClient.prototype.send_log = function (level, args) {
    if (this.remote_logging && this.server_remote_logging && this.connected) try {
        for (var sargs = [], i = 0; i < args.length; i++) sargs.push(unescape(encodeURIComponent(String(args[i]))));
        this.send(["logging", level, sargs])
    } catch (e) {
        this.cerror("remote logging failed");
        for (var i = 0; i < args.length; i++) this.clog(" argument", i, typeof args[i], ":", "'" + args[i] + "'")
    }
}, XpraClient.prototype.exc = function () {
    var exception = arguments[0], args = Array.from(arguments);
    if (args = args.splice(1), args.length > 0 && this.cerror(args), exception.stack) try {
        this.send_log(40, [exception.stack])
    } catch (e) {
    }
}, XpraClient.prototype.error = function () {
    this.send_log(40, arguments), this.cerror.apply(this, arguments)
}, XpraClient.prototype.cerror = function () {
    Utilities.cerror.apply(Utilities, arguments)
}, XpraClient.prototype.warn = function () {
    this.send_log(30, arguments), this.cwarn.apply(this, arguments)
}, XpraClient.prototype.cwarn = function () {
    Utilities.cwarn.apply(Utilities, arguments)
}, XpraClient.prototype.log = function () {
    this.send_log(20, arguments), this.clog.apply(this, arguments)
}, XpraClient.prototype.clog = function () {
    Utilities.clog.apply(Utilities, arguments)
}, XpraClient.prototype.debug = function () {
    var category = arguments[0], args = Array.from(arguments);
    args = args.splice(1), this.debug_categories.includes(category) && ("network" != category && this.send_log(10, arguments), this.cdebug.apply(this, arguments))
}, XpraClient.prototype.cdebug = function () {
    Utilities.cdebug.apply(Utilities, arguments)
}, XpraClient.prototype.init = function (ignore_blacklist) {
    this.on_connection_progress("Initializing", "", 20), this.init_audio(ignore_blacklist), this.init_packet_handlers(), this.init_keyboard()
}, XpraClient.prototype.init_packet_handlers = function () {
    this.packet_handlers = {
        open: this._process_open,
        close: this._process_close,
        error: this._process_error,
        disconnect: this._process_disconnect,
        challenge: this._process_challenge,
        "startup-complete": this._process_startup_complete,
        hello: this._process_hello,
        ping: this._process_ping,
        ping_echo: this._process_ping_echo,
        "info-response": this._process_info_response,
        "new-tray": this._process_new_tray,
        "new-window": this._process_new_window,
        "new-override-redirect": this._process_new_override_redirect,
        "window-metadata": this._process_window_metadata,
        "lost-window": this._process_lost_window,
        "raise-window": this._process_raise_window,
        "window-icon": this._process_window_icon,
        "window-resized": this._process_window_resized,
        "window-move-resize": this._process_window_move_resize,
        "initiate-moveresize": this._process_initiate_moveresize,
        "configure-override-redirect": this._process_configure_override_redirect,
        desktop_size: this._process_desktop_size,
        eos: this._process_eos,
        draw: this._process_draw,
        cursor: this._process_cursor,
        bell: this._process_bell,
        notify_show: this._process_notify_show,
        notify_close: this._process_notify_close,
        "sound-data": this._process_sound_data,
        "clipboard-token": this._process_clipboard_token,
        "set-clipboard-enabled": this._process_set_clipboard_enabled,
        "clipboard-request": this._process_clipboard_request,
        "send-file": this._process_send_file,
        "open-url": this._process_open_url,
        "setting-change": this._process_setting_change
    }
}, XpraClient.prototype.on_connection_progress = function (state, details, progress) {
    this.clog(state, details)
}, XpraClient.prototype.callback_close = function (reason) {
    void 0 === reason && (reason = "unknown reason"), this.clog("connection closed: " + reason)
}, XpraClient.prototype.connect = function () {
    var details = this.host + ":" + this.port + this.path;
    if (this.ssl && (details += " with ssl"), this.on_connection_progress("Connecting to server", details, 40), this.encryption && (!this.encryption_key || "" == this.encryption_key)) return void this.callback_close("no key specified for encryption");
    if (window.Worker) {
        this.clog("we have webworker support");
        var me = this, worker = new Worker("xpra/js/lib/wsworker_check.js");
        worker.addEventListener("message", function (e) {
            switch (e.data.result) {
                case!0:
                    me.clog("we can use websocket in webworker"), me._do_connect(!0);
                    break;
                case!1:
                    me.clog("we can't use websocket in webworker, won't use webworkers"), me._do_connect(!1);
                    break;
                default:
                    me.clog("client got unknown message from worker"), me._do_connect(!1)
            }
        }, !1), worker.postMessage({cmd: "check"})
    } else this.clog("no webworker support at all."), me._do_connect(!1)
}, XpraClient.prototype._do_connect = function (with_worker) {
    this.protocol = with_worker && !XPRA_CLIENT_FORCE_NO_WORKER ? new XpraProtocolWorkerHost : new XpraProtocol, this.open_protocol()
}, XpraClient.prototype.open_protocol = function () {
    this.protocol.set_packet_handler(this._route_packet, this);
    var uri = "ws://";
    this.ssl && (uri = "wss://"), uri += this.host, uri += ":" + this.port, uri += this.path, this.uri = uri, this.on_connection_progress("Opening WebSocket connection", uri, 60), this.protocol.open(uri)
}, XpraClient.prototype.close = function () {
    this.clog("client closed"), this.close_windows(), this.clear_timers(), this.close_audio(), this.close_protocol()
}, XpraClient.prototype.request_refresh = function (wid) {
    this.send(["buffer-refresh", wid, 0, 100, {"refresh-now": !0, batch: {reset: !0}}, {}])
}, XpraClient.prototype.redraw_windows = function () {
    for (var i in this.id_to_window) {
        var iwin = this.id_to_window[i];
        this.request_redraw(iwin)
    }
}, XpraClient.prototype.close_windows = function () {
    for (var i in this.id_to_window) {
        var iwin = this.id_to_window[i];
        window.removeWindowListItem(i), iwin.destroy()
    }
}, XpraClient.prototype.close_protocol = function () {
    this.connected = !1, this.protocol && (this.protocol.close(), this.protocol = null)
}, XpraClient.prototype.clear_timers = function () {
    this.stop_info_timer(), this.hello_timer && (clearTimeout(this.hello_timer), this.hello_timer = null), this.ping_timer && (clearTimeout(this.ping_timer), this.ping_timer = null), this.ping_timeout_timer && (clearTimeout(this.ping_timeout_timer), this.ping_timeout_timer = null), this.ping_grace_timer && (clearTimeout(this.ping_grace_timer), this.ping_grace_timer = null)
}, XpraClient.prototype.enable_encoding = function (encoding) {
    this.clog("enable", encoding), this.enabled_encodings.push(encoding)
}, XpraClient.prototype.disable_encoding = function (encoding) {
    this.clog("disable", encoding);
    var index = this.supported_encodings.indexOf(encoding);
    index > -1 && this.supported_encodings.splice(index, 1)
}, XpraClient.prototype._route_packet = function (packet, ctx) {
    var packet_type = "", fn = "";
    packet_type = packet[0], ctx.debug("network", "received a", packet_type, "packet"), fn = ctx.packet_handlers[packet_type], void 0 == fn ? (this.cerror("no packet handler for ", packet_type), this.clog(packet)) : fn(packet, ctx)
}, XpraClient.prototype._screen_resized = function (event, ctx) {
    if (this.container.clientWidth != this.desktop_width || this.container.clientHeight != this.desktop_height) {
        this.desktop_width = this.container.clientWidth, this.desktop_height = this.container.clientHeight;
        var newsize = [this.desktop_width, this.desktop_height],
            packet = ["desktop_size", newsize[0], newsize[1], this._get_screen_sizes()];
        ctx.send(packet);
        for (var i in ctx.id_to_window) {
            ctx.id_to_window[i].screen_resized()
        }
    }
}, XpraClient.prototype.init_keyboard = function () {
    var me = this;
    this.num_lock_modifier = null, this.alt_modifier = null, this.control_modifier = "control", this.meta_modifier = null, this.altgr_modifier = null, this.altgr_state = !1, this.capture_keyboard = !0, document.addEventListener("keydown", function (e) {
        me._keyb_onkeydown(e, me) || e.preventDefault()
    }), document.addEventListener("keyup", function (e) {
        me._keyb_onkeyup(e, me) || e.preventDefault()
    })
}, XpraClient.prototype._keyb_get_modifiers = function (event) {
    var modifiers = get_event_modifiers(event);
    return this.translate_modifiers(modifiers)
}, XpraClient.prototype.translate_modifiers = function (modifiers) {
    var alt = this.alt_modifier, control = this.control_modifier, meta = this.meta_modifier,
        altgr = this.altgr_modifier;
    this.swap_keys && (meta = this.control_modifier, control = this.meta_modifier);
    var new_modifiers = modifiers.slice(), index = modifiers.indexOf("meta");
    return index >= 0 && meta && (new_modifiers[index] = meta), index = modifiers.indexOf("control"), index >= 0 && control && (new_modifiers[index] = control), index = modifiers.indexOf("alt"), index >= 0 && alt && (new_modifiers[index] = alt), index = modifiers.indexOf("numlock"), index >= 0 && (this.num_lock_modifier ? new_modifiers[index] = this.num_lock_modifier : new_modifiers.splice(index, 1)), index = modifiers.indexOf("capslock"), index >= 0 && (new_modifiers[index] = "lock"), this.altgr_state && altgr && !new_modifiers.includes(altgr) && (new_modifiers.push(altgr), index = new_modifiers.indexOf(alt), index >= 0 && new_modifiers.splice(index, 1), (index = new_modifiers.indexOf(control)) >= 0 && new_modifiers.splice(index, 1)), new_modifiers
}, XpraClient.prototype._check_browser_language = function (key_layout) {
    var now = Utilities.monotonicTime();
    if (!(now < this.browser_language_change_embargo_time)) {
        var new_layout = null;
        if (key_layout) new_layout = key_layout; else {
            var l = Utilities.getFirstBrowserLanguage();
            l && this.browser_language != l ? (this.clog("browser language changed from", this.browser_language, "to", l), this.browser_language = l, new_layout = Utilities.getKeyboardLayout()) : new_layout = this._get_keyboard_layout() || "us"
        }
        null != new_layout && this.key_layout != new_layout ? (this.key_layout = new_layout, this.clog("keyboard layout changed from", this.key_layout, "to", key_layout), this.send(["layout-changed", new_layout, ""]), this.browser_language_change_embargo_time = now + 1e3) : this.browser_language_change_embargo_time = now + 100
    }
}, XpraClient.prototype._keyb_process = function (pressed, event) {
    if (!this.server_readonly) {
        if (!this.capture_keyboard) return !0;
        window.event && (event = window.event);
        var keyname = event.code || "", keycode = event.which || event.keyCode;
        if (229 != keycode) {
            var str = event.key || String.fromCharCode(keycode);
            this.debug("keyboard", "processKeyEvent(", pressed, ", ", event, ") key=", keyname, "keycode=", keycode), 144 == keycode && pressed && (this.num_lock = !this.num_lock);
            var key_language = null;
            if (keyname != str && str in NUMPAD_TO_NAME) keyname = NUMPAD_TO_NAME[str], this.num_lock = "0123456789.".includes(keyname); else if (keyname in KEY_TO_NAME) keyname = KEY_TO_NAME[keyname]; else if (str in CHAR_TO_NAME) {
                if (keyname = CHAR_TO_NAME[str], keyname.includes("_")) {
                    var lang = keyname.split("_")[0];
                    key_language = KEYSYM_TO_LAYOUT[lang]
                }
            } else keycode in CHARCODE_TO_NAME && (keyname = CHARCODE_TO_NAME[keycode]);
            this._check_browser_language(key_language);
            keyname.match("_L$") && 2 == event.location && (keyname = keyname.replace("_L", "_R")), ("AltGraph" == str || "Alt_R" == keyname && Utilities.isWindows()) && (this.altgr_state = pressed, keyname = "ISO_Level3_Shift", str = "AltGraph");
            var raw_modifiers = get_event_modifiers(event), modifiers = this._keyb_get_modifiers(event),
                keyval = keycode, shift = modifiers.includes("shift"), capslock = modifiers.includes("capslock");
            (capslock && shift || !capslock && !shift) && (str = str.toLowerCase());
            var ostr = str;
            if (this.swap_keys && ("Control_L" == keyname ? (keyname = "Meta_L", str = "meta") : "Meta_L" == keyname ? (keyname = "Control_L", str = "control") : "Control_R" == keyname ? (keyname = "Meta_R", str = "meta") : "Meta_R" == keyname && (keyname = "Control_R", str = "control")), null != this.topwindow) {
                var packet = ["key-action", this.topwindow, keyname, pressed, modifiers, keyval, str, keycode, 0],
                    me = this;
                setTimeout(function () {
                    me.send(packet), pressed && Utilities.isMacOS() && raw_modifiers.includes("meta") && "meta" != ostr && (packet = ["key-action", me.topwindow, keyname, !1, modifiers, keyval, str, keycode, 0], me.debug("keyboard", packet), me.send(packet))
                }, 0)
            }
            if (this.clipboard_enabled) {
                var clipboard_modifier_keys = ["Control_L", "Control_R", "Shift_L", "Shift_R"],
                    clipboard_modifier = "control";
                if (Utilities.isMacOS() && (clipboard_modifier_keys = ["Meta_L", "Meta_R", "Shift_L", "Shift_R"], clipboard_modifier = "meta"), clipboard_modifier_keys.indexOf(keyname) >= 0) return this.debug("keyboard", "passing clipboard modifier key event to browser:", keyname), !0;
                if (shift && "Insert" == keyname) return this.debug("keyboard", "passing clipboard combination Shift+Insert to browser"), !0;
                if (raw_modifiers.includes(clipboard_modifier)) {
                    var l = keyname.toLowerCase();
                    if ("c" == l || "x" == l || "v" == l) return this.debug("keyboard", "passing clipboard combination to browser:", clipboard_modifier, "+", keyname), !0
                }
            }
            return !1
        }
    }
}, XpraClient.prototype._keyb_onkeydown = function (event, ctx) {
    return ctx._keyb_process(!0, event)
}, XpraClient.prototype._keyb_onkeyup = function (event, ctx) {
    return ctx._keyb_process(!1, event)
}, XpraClient.prototype._get_keyboard_layout = function () {
    return this.debug("keyboard", "_get_keyboard_layout() keyboard_layout=", this.keyboard_layout), this.keyboard_layout ? this.keyboard_layout : Utilities.getKeyboardLayout()
}, XpraClient.prototype._get_keycodes = function () {
    var kc, keycodes = [];
    for (var keycode in CHARCODE_TO_NAME) kc = parseInt(keycode), keycodes.push([kc, CHARCODE_TO_NAME[keycode], kc, 0, 0]);
    return keycodes
}, XpraClient.prototype._get_desktop_size = function () {
    return [this.desktop_width, this.desktop_height]
}, XpraClient.prototype._get_DPI = function () {
    var dpi_div = document.getElementById("dpi");
    return void 0 != dpi_div && dpi_div.offsetWidth > 0 && dpi_div.offsetHeight > 0 ? Math.round((dpi_div.offsetWidth + dpi_div.offsetHeight) / 2) : "deviceXDPI" in screen ? (screen.systemXDPI + screen.systemYDPI) / 2 : 96
}, XpraClient.prototype._get_screen_sizes = function () {
    var dpi = this._get_DPI(), screen_size = [this.container.clientWidth, this.container.clientHeight],
        wmm = Math.round(25.4 * screen_size[0] / dpi), hmm = Math.round(25.4 * screen_size[1] / dpi);
    return [["HTML", screen_size[0], screen_size[1], wmm, hmm, [["Canvas", 0, 0, screen_size[0], screen_size[1], wmm, hmm]], 0, 0, screen_size[0], screen_size[1]]]
}, XpraClient.prototype._get_encodings = function () {
    return 0 == this.enabled_encodings.length ? (this.clog("return all encodings: ", this.supported_encodings), this.supported_encodings) : (this.clog("return just enabled encodings: ", this.enabled_encodings), this.enabled_encodings)
}, XpraClient.prototype._update_capabilities = function (appendobj) {
    for (var attr in appendobj) this.capabilities[attr] = appendobj[attr]
}, XpraClient.prototype._check_server_echo = function (ping_sent_time) {
    var last = this.server_ok;
    if (this.server_ok = this.last_ping_echoed_time >= ping_sent_time, last != this.server_ok) {
        this.server_ok ? this.clog("server connection is OK") : this.clog("server connection is not responding, drawing spinners...");
        for (var i in this.id_to_window) {
            this.id_to_window[i].set_spinner(this.server_ok)
        }
    }
}, XpraClient.prototype._check_echo_timeout = function (ping_time) {
    this.reconnect_in_progress || this.last_ping_echoed_time < ping_time && (this.reconnect && this.reconnect_attempt < this.reconnect_count ? (this.warn("ping timeout - reconnecting"), this.reconnect_attempt++, this.do_reconnect()) : this.callback_close("server ping timeout, waited " + this.PING_TIMEOUT + "ms without a response"))
}, XpraClient.prototype._emit_event = function (event_type) {
    var event = document.createEvent("Event");
    event.initEvent(event_type, !0, !0), document.dispatchEvent(event)
}, XpraClient.prototype.emit_connection_lost = function (event_type) {
    this._emit_event("connection-lost")
}, XpraClient.prototype.emit_connection_established = function (event_type) {
    this._emit_event("connection-established")
}, XpraClient.prototype._send_hello = function (challenge_response, client_salt) {
    this._make_hello_base(), this.password && !challenge_response ? (this.capabilities.challenge = !0, this.clog("sending partial hello")) : (this.clog("sending hello"), this._make_hello()), challenge_response && (this._update_capabilities({challenge_response: challenge_response}), client_salt && this._update_capabilities({challenge_client_salt: client_salt})), this.clog("hello capabilities", this.capabilities);
    for (var key in this.capabilities) {
        var value = this.capabilities[key];
        if (null == key) throw new Error("invalid null key in hello packet data");
        if (null == value) throw new Error("invalid null value for key " + key + " in hello packet data")
    }
    this.send(["hello", this.capabilities])
}, XpraClient.prototype._make_hello_base = function () {
    this.capabilities = {};
    var digests = ["hmac", "hmac+md5", "xor"];
    if ("undefined" != typeof forge) try {
        this.debug("network", "forge.md.algorithms=", forge.md.algorithms);
        for (var hash in forge.md.algorithms) digests.push("hmac+" + hash);
        this.debug("network", "digests:", digests)
    } catch (e) {
        this.cerror("Error probing forge crypto digests")
    } else this.clog("cryptography library 'forge' not found");
    this._update_capabilities({
        version: Utilities.VERSION,
        platform: Utilities.getPlatformName(),
        "platform.name": Utilities.getPlatformName(),
        "platform.processor": Utilities.getPlatformProcessor(),
        "platform.platform": navigator.appVersion,
        "session-type": Utilities.getSimpleUserAgentString(),
        "session-type.full": navigator.userAgent,
        namespace: !0,
        "clipboard.contents-slice-fix": !0,
        share: this.sharing,
        steal: this.steal,
        client_type: "HTML5",
        "encoding.generic": !0,
        "websocket.multi-packet": !0,
        "xdg-menu-update": !0,
        "setting-change": !0,
        username: this.username,
        uuid: this.uuid,
        argv: [window.location.href],
        digest: digests,
        "salt-digest": digests,
        zlib: !0,
        lzo: !1,
        compression_level: 1,
        rencode: !1,
        bencode: !0,
        yaml: !1,
        "open-url": this.open_url,
        "ping-echo-sourceid": !0
    }), this.bandwidth_limit > 0 && this._update_capabilities({"bandwidth-limit": this.bandwidth_limit});
    var ci = Utilities.getConnectionInfo();
    ci && this._update_capabilities({"connection-data": ci});
    var LZ4 = require("lz4");
    LZ4 && this._update_capabilities({
        lz4: !0,
        "lz4.js.version": LZ4.version,
        "encoding.rgb_lz4": !0
    }), "undefined" == typeof BrotliDecode || Utilities.isIE() || this._update_capabilities({brotli: !0}), this._update_capabilities({"clipboard.preferred-targets": this.clipboard_targets}), this.encryption && (this.cipher_in_caps = {
        cipher: this.encryption,
        "cipher.iv": Utilities.getHexUUID().slice(0, 16),
        "cipher.key_salt": Utilities.getHexUUID() + Utilities.getHexUUID(),
        "cipher.key_stretch_iterations": 1e3,
        "cipher.padding.options": ["PKCS#7"]
    }, this._update_capabilities(this.cipher_in_caps), this.protocol.set_cipher_in(this.cipher_in_caps, this.encryption_key)), this.start_new_session && this._update_capabilities({"start-new-session": this.start_new_session})
}, XpraClient.prototype._make_hello = function () {
    var selections = null;
    navigator.clipboard && navigator.clipboard.readText && navigator.clipboard.writeText ? (selections = ["CLIPBOARD"], this.log("using new navigator.clipboard")) : (selections = ["CLIPBOARD", "PRIMARY"], this.log("legacy clipboard")), this.desktop_width = 1024, this.desktop_height = 800, this.key_layout = this._get_keyboard_layout(), this._update_capabilities({
        auto_refresh_delay: 500,
        randr_notify: !0,
        "sound.server_driven": !0,
        "server-window-resize": !0,
        "notify-startup-complete": !0,
        "generic-rgb-encodings": !0,
        "window.raise": !0,
        "window.initiate-moveresize": !0,
        "screen-resize-bigger": !1,
        "metadata.supported": ["fullscreen", "maximized", "above", "below", "title", "size-hints", "class-instance", "transient-for", "window-type", "has-alpha", "decorations", "override-redirect", "tray", "modal", "opacity"],
        encodings: this._get_encodings(),
        raw_window_icons: !0,
        "encoding.icons.max_size": [30, 30],
        "encodings.core": this._get_encodings(),
        "encodings.rgb_formats": this.RGB_FORMATS,
        "encodings.window-icon": ["png"],
        "encodings.cursor": ["png"],
        "encoding.generic": !0,
        "encoding.flush": !0,
        "encoding.transparency": !0,
        "encoding.client_options": !0,
        "encoding.csc_atoms": !0,
        "encoding.scrolling": !0,
        "encoding.color-gamut": Utilities.getColorGamut(),
        "encoding.video_scaling": !0,
        "encoding.video_max_size": [1024, 768],
        "encoding.eos": !0,
        "encoding.full_csc_modes": {
            mpeg1: ["YUV420P"],
            h264: ["YUV420P"],
            "mpeg4+mp4": ["YUV420P"],
            "h264+mp4": ["YUV420P"],
            "vp8+webm": ["YUV420P"],
            webp: ["BGRX", "BGRA"]
        },
        "encoding.x264.YUV420P.profile": "baseline",
        "encoding.h264.YUV420P.profile": "baseline",
        "encoding.h264.YUV420P.level": "2.1",
        "encoding.h264.cabac": !1,
        "encoding.h264.deblocking-filter": !1,
        "encoding.h264.fast-decode": !0,
        "encoding.h264+mp4.YUV420P.profile": "main",
        "encoding.h264+mp4.YUV420P.level": "3.0",
        "encoding.h264.score-delta": -20,
        "encoding.h264+mp4.score-delta": 50,
        "encoding.mpeg4+mp4.score-delta": 50,
        "encoding.vp8+webm.score-delta": 50,
        "sound.receive": !0,
        "sound.send": !1,
        "sound.decoders": Object.keys(this.audio_codecs),
        "sound.bundle-metadata": !0,
        "encoding.rgb24zlib": !0,
        "encoding.rgb_zlib": !0,
        windows: !0,
        keyboard: !0,
        xkbmap_layout: this.key_layout,
        xkbmap_keycodes: this._get_keycodes(),
        xkbmap_print: "",
        xkbmap_query: "",
        desktop_size: [this.desktop_width, this.desktop_height],
        desktop_mode_size: [this.desktop_width, this.desktop_height],
        screen_sizes: this._get_screen_sizes(),
        dpi: this._get_DPI(),
        clipboard: this.clipboard_enabled,
        "clipboard.want_targets": !0,
        "clipboard.greedy": !0,
        "clipboard.selections": selections,
        notifications: !0,
        "notifications.close": !0,
        "notifications.actions": !0,
        cursors: !0,
        bell: !0,
        system_tray: !0,
        named_cursors: !1,
        "file-transfer": this.file_transfer,
        printing: this.printing,
        "file-size-limit": 10
    })
}, XpraClient.prototype.on_first_ui_event = function () {
}, XpraClient.prototype._new_ui_event = function () {
    0 == this.ui_events && this.on_first_ui_event(), this.ui_events++
}, XpraClient.prototype.getMouse = function (e, window) {
    var mx = e.clientX + jQuery(document).scrollLeft(), my = e.clientY + jQuery(document).scrollTop();
    isNaN(mx) || isNaN(my) ? isNaN(this.last_mouse_x) || isNaN(this.last_mouse_y) ? (mx = 0, my = 0) : (mx = this.last_mouse_x, my = this.last_mouse_y) : (this.last_mouse_x = mx, this.last_mouse_y = my);
    var mbutton = 0;

    //changed
    let screenOffset = jQuery("#screen").offset();

    return "which" in e ? mbutton = Math.max(0, e.which) : "button" in e && (mbutton = Math.max(0, e.button) + 1), {
        x: mx - screenOffset.left,
        y: my - screenOffset.top,
        button: mbutton
    }
}, XpraClient.prototype.on_mousemove = function (e) {
    this.do_window_mouse_move(e, null)
}, XpraClient.prototype.on_mousedown = function (e) {
    this.do_window_mouse_click(e, null, !0)
}, XpraClient.prototype.on_mouseup = function (e) {
    this.do_window_mouse_click(e, null, !1)
}, XpraClient.prototype.on_mousescroll = function (e) {
    this.do_window_mouse_scroll(e, null)
}, XpraClient.prototype._window_mouse_move = function (ctx, e, window) {
    ctx.do_window_mouse_move(e, window)
}, XpraClient.prototype.do_window_mouse_move = function (e, window) {
    if (!this.server_readonly && !this.mouse_grabbed && this.connected) {
        var mouse = this.getMouse(e, this.topwindow),
            modifiers = this._keyb_get_modifiers(e), buttons = [], wid = 0;
        // let screenOffset = jQuery("#screen").offset();
        var x = mouse.x; //- screenOffset.left;
        var y = mouse.y; //- screenOffset.top;
        // console.log("jQuery #emulator-container x", x);
        // console.log("jQuery #emulator-container y", y);

        x = Math.round(x);
        y = Math.round(y);
        // y = Math.round(mouse.y)
        window && (wid = window.wid), this.send(["pointer-position", wid, [x, y], modifiers, buttons])
    }
}, XpraClient.prototype._window_mouse_down = function (ctx, e, window) {
    ctx.mousedown_event = e, ctx.do_window_mouse_click(e, window, !0)
}, XpraClient.prototype._window_mouse_up = function (ctx, e, window) {
    ctx.do_window_mouse_click(e, window, !1)
}, XpraClient.prototype.do_window_mouse_click = function (e, window, pressed) {
    if (!this.server_readonly && !this.mouse_grabbed && this.connected) {
        this._poll_clipboard(e);
        var mouse = this.getMouse(e, window), x = Math.round(mouse.x), y = Math.round(mouse.y),
            modifiers = this._keyb_get_modifiers(e), buttons = [], wid = 0;
        window && (wid = window.wid), wid > 0 && this.focus != wid && this._window_set_focus(window);
        var button = mouse.button;
        this.debug("mouse", "click:", button, pressed, x, y), 4 == button ? button = 8 : 5 == button && (button = 9);
        var me = this;
        setTimeout(function () {
            me.send(["button-action", wid, button, pressed, [x, y], modifiers, buttons])
        }, 0)
    }
}, XpraClient.prototype._window_mouse_scroll = function (ctx, e, window) {
    ctx.do_window_mouse_scroll(e, window)
}, XpraClient.prototype.do_window_mouse_scroll = function (e, window) {
    if (!this.server_readonly && !this.mouse_grabbed && this.connected) {
        var mouse = this.getMouse(e, window), x = Math.round(mouse.x), y = Math.round(mouse.y),
            modifiers = this._keyb_get_modifiers(e), buttons = [], wid = 0;
        window && (wid = window.wid);
        var wheel = Utilities.normalizeWheel(e);
        this.debug("mouse", "normalized wheel event:", wheel);
        var px = Math.min(1200, wheel.pixelX), py = Math.min(1200, wheel.pixelY), apx = Math.abs(px),
            apy = Math.abs(py);
        if (this.server_precise_wheel) {
            if (apx > 0) {
                var btn_x = px >= 0 ? 6 : 7, xdist = Math.round(1e3 * px / 120);
                this.send(["wheel-motion", wid, btn_x, -xdist, [x, y], modifiers, buttons])
            }
            if (apy > 0) {
                var btn_y = py >= 0 ? 5 : 4, ydist = Math.round(1e3 * py / 120);
                this.send(["wheel-motion", wid, btn_y, -ydist, [x, y], modifiers, buttons])
            }
        } else {
            apx >= 40 && apx <= 160 ? this.wheel_delta_x = px > 0 ? 120 : -120 : this.wheel_delta_x += px, apy >= 40 && apy <= 160 ? this.wheel_delta_y = py > 0 ? 120 : -120 : this.wheel_delta_y += py;
            for (var wx = Math.abs(this.wheel_delta_x), wy = Math.abs(this.wheel_delta_y), btn_x = this.wheel_delta_x >= 0 ? 6 : 7, btn_y = this.wheel_delta_y >= 0 ? 5 : 4; wx >= 120;) wx -= 120, this.send(["button-action", wid, btn_x, !0, [x, y], modifiers, buttons]), this.send(["button-action", wid, btn_x, !1, [x, y], modifiers, buttons]);
            for (; wy >= 120;) wy -= 120, this.send(["button-action", wid, btn_y, !0, [x, y], modifiers, buttons]), this.send(["button-action", wid, btn_y, !1, [x, y], modifiers, buttons]);
            this.wheel_delta_x = this.wheel_delta_x >= 0 ? wx : -wx, this.wheel_delta_y = this.wheel_delta_y >= 0 ? wy : -wy
        }
    }
}, XpraClient.prototype._poll_clipboard = function (e) {
    if (this.debug("clipboard", "poll clipboard, navigator.clipboard=", navigator.clipboard), navigator.clipboard && navigator.clipboard.readText) {
        var client = this;
        navigator.clipboard.readText().then(function (text) {
            client.debug("clipboard", "paste event, text=", text);
            var clipboard_buffer = unescape(encodeURIComponent(text));
            clipboard_buffer != client.clipboard_buffer && (client.debug("clipboard", "clipboard contents have changed"), client.clipboard_buffer = clipboard_buffer, client.send_clipboard_token())
        }, function (err) {
            client.debug("clipboard", "paste event failed:", err)
        })
    } else {
        var datatype = "text/plain", clipboardData = (e.originalEvent || e).clipboardData;
        if (!clipboardData && !(clipboardData = window.clipboardData)) return;
        Utilities.isIE() && (datatype = "Text");
        var clipboard_buffer = unescape(encodeURIComponent(clipboardData.getData(datatype)));
        this.debug("clipboard", "paste event, data=", clipboard_buffer), clipboard_buffer != this.clipboard_buffer && (this.debug("clipboard", "clipboard contents have changed"), this.clipboard_buffer = clipboard_buffer, this.send_clipboard_token())
    }
}, XpraClient.prototype._window_set_focus = function (win) {
    if (null != win && !win.client.server_readonly && this.connected && !win.override_redirect && !win.tray) {
        var client = win.client, wid = win.wid;
        if (client.focus != wid) {
            var top_stacking_layer = Object.keys(client.id_to_window).length, old_stacking_layer = win.stacking_layer;
            client.focus = wid, client.topwindow = wid, client.send(["focus", wid, []]);
            var iwin = null;
            for (var i in client.id_to_window) iwin = client.id_to_window[i], iwin.focused = i == wid, iwin.focused ? iwin.stacking_layer = top_stacking_layer : iwin.stacking_layer > old_stacking_layer && iwin.stacking_layer--, iwin.updateFocus(), iwin.update_zindex()
        }
    }
}, XpraClient.prototype.on_open = function () {
}, XpraClient.prototype._process_open = function (packet, ctx) {
    ctx.on_connection_progress("WebSocket connection established", "", 80), ctx.hello_timer = setTimeout(function () {
        ctx.disconnect_reason = "Did not receive hello before timeout reached, not an Xpra server?", ctx.close()
    }, ctx.HELLO_TIMEOUT), ctx._send_hello(), ctx.on_open()
}, XpraClient.prototype._process_error = function (packet, ctx) {
    ctx.cerror("websocket error: ", packet[1], "reason: ", ctx.disconnect_reason), ctx.reconnect_in_progress || (!ctx.disconnect_reason && packet[1] && (ctx.disconnect_reason = packet[1]), ctx.close_audio(), (!ctx.reconnect || ctx.reconnect_attempt >= ctx.reconnect_count) && ctx.callback_close(ctx.disconnect_reason))
}, XpraClient.prototype.do_reconnect = function () {
    this.reconnect_in_progress = !0;
    var me = this, protocol = this.protocol;
    setTimeout(function () {
        try {
            me.close_windows(), me.close_audio(), me.clear_timers(), me.init_state(), protocol && (this.protocol = null, protocol.terminate()), me.emit_connection_lost(), me.connect()
        } finally {
            me.reconnect_in_progress = !1
        }
    }, this.reconnect_delay)
}, XpraClient.prototype._process_close = function (packet, ctx) {
    ctx.clog("websocket closed: ", packet[1], "reason: ", ctx.disconnect_reason, ", reconnect: ", ctx.reconnect, ", reconnect attempt: ", ctx.reconnect_attempt), ctx.reconnect_in_progress || (!ctx.disconnect_reason && packet[1] && (ctx.disconnect_reason = packet[1]), ctx.reconnect && ctx.reconnect_attempt < ctx.reconnect_count ? (ctx.emit_connection_lost(), ctx.reconnect_attempt++, ctx.do_reconnect()) : ctx.close())
}, XpraClient.prototype.close = function () {
    this.emit_connection_lost(), this.close_windows(), this.close_audio(), this.clear_timers(), this.close_protocol(), this.callback_close(this.disconnect_reason)
}, XpraClient.prototype._process_disconnect = function (packet, ctx) {
    var reason = packet[1];
    ctx.debug("main", "disconnect reason:", reason), ctx.reconnect_in_progress || (ctx.disconnect_reason = reason, ctx.close(), ctx.callback_close(reason))
}, XpraClient.prototype._process_startup_complete = function (packet, ctx) {
    ctx.log("startup complete"), ctx.emit_connection_established()
},
    XpraClient.prototype._connection_change = function (e) {
        var ci = Utilities.getConnectionInfo();
        this.clog("connection status - change event=", e, ", connection info=", ci, "tell server:", this.server_connection_data), ci && this.server_connection_data && this.send(["connection-data", ci])
    }, XpraClient.prototype._process_hello = function (packet, ctx) {
    ctx.hello_timer && (clearTimeout(ctx.hello_timer), ctx.hello_timer = null);
    var hello = packet[1];
    ctx.server_display = hello.display || "", ctx.server_platform = hello.platform || "", ctx.server_remote_logging = hello["remote-logging.multi-line"], ctx.server_remote_logging && ctx.remote_logging && (Utilities.log = function () {
        ctx.log.apply(ctx, arguments)
    }, Utilities.warn = function () {
        ctx.warn.apply(ctx, arguments)
    }, Utilities.error = function () {
        ctx.error.apply(ctx, arguments)
    }, Utilities.exc = function () {
        ctx.exc.apply(ctx, arguments)
    }), ctx.encryption && (ctx.cipher_out_caps = {
        cipher: hello.cipher,
        "cipher.iv": hello["cipher.iv"],
        "cipher.key_salt": hello["cipher.key_salt"],
        "cipher.key_stretch_iterations": hello["cipher.key_stretch_iterations"]
    }, ctx.protocol.set_cipher_out(ctx.cipher_out_caps, ctx.encryption_key));
    var modifier_keycodes = hello.modifier_keycodes;
    if (modifier_keycodes) for (var modifier in modifier_keycodes) if (modifier_keycodes.hasOwnProperty(modifier)) {
        var mappings = modifier_keycodes[modifier];
        for (var keycode in mappings) {
            var keys = mappings[keycode];
            for (var index in keys) {
                var key = keys[index];
                "Num_Lock" == key && (ctx.num_lock_modifier = modifier)
            }
        }
    }
    var version = hello.version;
    try {
        for (var vparts = version.split("."), vno = [], i = 0; i < vparts.length; i++) vno[i] = parseInt(vparts[i]);
        if (vno[0] <= 0 && vno[1] < 10) return ctx.callback_close("unsupported version: " + version), void ctx.close()
    } catch (e) {
        return ctx.callback_close("error parsing version number '" + version + "'"), void ctx.close()
    }
    if (ctx.log("got hello: server version", version, "accepted our connection"), "modifier_keycodes" in hello) {
        var modifier_keycodes = hello.modifier_keycodes;
        for (var mod in modifier_keycodes) for (var keys = modifier_keycodes[mod], i = 0; i < keys.length; i++) for (var key = keys[i], j = 0; j < key.length; j++) "Alt_L" == key[j] ? ctx.alt_modifier = mod : "Meta_L" == key[j] ? ctx.meta_modifier = mod : "ISO_Level3_Shift" == key[j] || "Mode_switch" == key[j] ? ctx.altgr_modifier = mod : "Control_L" == key[j] && (ctx.control_modifier = mod)
    }
    if (ctx.audio_enabled) if (hello["sound.send"]) {
        if (ctx.server_audio_codecs = hello["sound.encoders"], ctx.server_audio_codecs) {
            if (ctx.log("audio codecs supported by the server:", ctx.server_audio_codecs), !ctx.server_audio_codecs.includes(ctx.audio_codec)) {
                ctx.warn("audio codec " + ctx.audio_codec + " is not supported by the server"), ctx.audio_codec = null;
                for (var i = 0; i < MediaSourceConstants.PREFERRED_CODEC_ORDER.length; i++) {
                    var codec = MediaSourceConstants.PREFERRED_CODEC_ORDER[i];
                    if (codec in ctx.audio_codecs && ctx.server_audio_codecs.indexOf(codec) >= 0) {
                        ctx.mediasource_codecs[codec] ? ctx.audio_framework = "mediasource" : ctx.audio_framework = "aurora", ctx.audio_codec = codec, ctx.log("using", ctx.audio_framework, "audio codec", codec);
                        break
                    }
                }
                ctx.audio_codec || (ctx.warn("audio codec: no matches found"), ctx.audio_enabled = !1)
            }
        } else ctx.error("audio codecs missing on the server"), ctx.audio_enabled = !1;
        ctx.audio_enabled && !Utilities.isFirefox() && ctx._sound_start_receiving()
    } else ctx.error("server does not support speaker forwarding"), ctx.audio_enabled = !1;
    if (ctx.xdg_menu = hello["xdg-menu"], ctx.xdg_menu && ctx.process_xdg_menu(), ctx.server_is_desktop = Boolean(hello.desktop), ctx.server_is_shadow = Boolean(hello.shadow), ctx.server_readonly = Boolean(hello.readonly), (ctx.server_is_desktop || ctx.server_is_shadow) && jQuery("body").addClass("desktop"), ctx.server_resize_exact = hello.resize_exact || !1, ctx.server_screen_sizes = hello["screen-sizes"] || [], ctx.clog("server screen sizes:", ctx.server_screen_sizes), ctx.server_precise_wheel = hello["wheel.precise"] || !1, ctx.remote_open_files = Boolean(hello["open-files"]), ctx.remote_file_transfer = Boolean(hello["file-transfer"]), ctx.remote_printing = Boolean(hello.printing), ctx.remote_printing && ctx.printing) {
        var printers = {
            "HTML5 client": {
                "printer-info": "Print to PDF in client browser",
                "printer-make-and-model": "HTML5 client version",
                mimetypes: ["application/pdf"]
            }
        };
        ctx.send(["printers", printers])
    }
    ctx.server_connection_data = hello["connection-data"], navigator.connection && (navigator.connection.onchange = function () {
        ctx._connection_change()
    }, ctx._connection_change()), ctx._send_ping(), ctx.ping_timer = setInterval(function () {
        return ctx._send_ping(), !0
    }, ctx.PING_FREQUENCY), ctx.reconnect_attempt = 0, ctx.on_connection_progress("Session started", "", 100), ctx.on_connect(), ctx.connected = !0
}, XpraClient.prototype.process_xdg_menu = function () {
    this.log("received xdg start menu data");
    var key;
    $("#startmenu li").remove();
    var startmenu = document.getElementById("startmenu");
    for (key in this.xdg_menu) {
        var category = this.xdg_menu[key], li = document.createElement("li");
        li.className = "-hasSubmenu";
        var catDivLeft = document.createElement("div");
        catDivLeft.className = "menu-divleft", catDivLeft.appendChild(this.xdg_image(category.IconData, category.IconType));
        var a = document.createElement("a");
        a.appendChild(catDivLeft), a.appendChild(document.createTextNode(this.xdg_menu[key].Name)), a.href = "#", li.appendChild(a);
        var ul = document.createElement("ul");
        a.onmouseenter = function () {
            this.parentElement.childNodes[1].className = "-visible"
        }, a.onmouseleave = function () {
            this.parentElement.childNodes[1].className = ""
        };
        var xdg_menu_cats = category.Entries;
        for (key in xdg_menu_cats) {
            var entry = xdg_menu_cats[key], li2 = document.createElement("li"), a2 = document.createElement("a"),
                name = entry.Name;
            name = Utilities.trimString(name, 15);
            var command = entry.Exec.replace(/%[uUfF]/g, ""), divLeft = document.createElement("div");
            divLeft.className = "menu-divleft", divLeft.appendChild(this.xdg_image(entry.IconData, entry.IconType));
            var titleDiv = document.createElement("div");
            titleDiv.appendChild(document.createTextNode(name)), titleDiv.className = "menu-content-left", divLeft.appendChild(titleDiv), a2.appendChild(divLeft), a2.title = command;
            var me = this;
            a2.onclick = function () {
                me.start_command(this.innerText, this.title, "False"), document.getElementById("menu_list").className = "-hide"
            }, a2.onmouseenter = function () {
                this.parentElement.parentElement.className = "-visible"
            }, a2.onmouseleave = function () {
                this.parentElement.parentElement.className = ""
            }, li2.appendChild(a2), ul.appendChild(li2)
        }
        li.appendChild(ul), startmenu.appendChild(li)
    }
}, XpraClient.prototype._process_setting_change = function (packet, ctx) {
    var setting = packet[1], value = packet[2];
    "xdg-menu" == setting && (ctx.xdg_menu = value, ctx.xdg_menu && ctx.process_xdg_menu())
}, XpraClient.prototype.xdg_image = function (icon_data, icon_type) {
    var img = new Image;
    return void 0 !== icon_data && ("string" == typeof icon_data && (icon_data = Utilities.StringToUint8(icon_data)), "svg" == icon_type ? img.src = "data:image/svg+xml;base64," + Utilities.ArrayBufferToBase64(icon_data) : "png" != icon_type && "jpeg" != icon_type || (img.src = "data:image/" + icon_type + ";base64," + Utilities.ArrayBufferToBase64(icon_data))), img.className = "menu-content-left", img.height = 24, img.width = 24, img
}, XpraClient.prototype.on_connect = function () {
}, XpraClient.prototype._process_challenge = function (packet, ctx) {
    if (ctx.clog("process challenge"), !ctx.password || "" == ctx.password) return void ctx.callback_close("No password specified for authentication challenge");
    if (ctx.encryption) {
        if (!(packet.length >= 3)) return void ctx.callback_close("challenge does not contain encryption details to use for the response");
        ctx.cipher_out_caps = packet[2], ctx.protocol.set_cipher_out(ctx.cipher_out_caps, ctx.encryption_key)
    }
    var digest = packet[3], server_salt = packet[1], client_salt = null, salt_digest = packet[4] || "xor",
        l = server_salt.length;
    if ("xor" == salt_digest) {
        if ("xor" == digest && !ctx.ssl && !ctx.encryption && !ctx.insecure && "localhost" != ctx.host && "127.0.0.1" != ctx.host) return void ctx.callback_close("server requested digest xor, cowardly refusing to use it without encryption with " + ctx.host);
        if (l < 16 || l > 256) return void ctx.callback_close("invalid server salt length for xor digest:" + l)
    } else l = 32;
    client_salt = Utilities.getSalt(l), ctx.clog("challenge using salt digest", salt_digest);
    var salt = ctx._gendigest(salt_digest, client_salt, server_salt);
    if (!salt) return void this.callback_close("server requested an unsupported salt digest " + salt_digest);
    ctx.clog("challenge using digest", digest);
    var challenge_response = ctx._gendigest(digest, ctx.password, salt);
    challenge_response ? ctx._send_hello(challenge_response, client_salt) : this.callback_close("server requested an unsupported digest " + digest)
}, XpraClient.prototype._gendigest = function (digest, password, salt) {
    if (digest.startsWith("hmac")) {
        var hash = "md5";
        digest.indexOf("+") > 0 && (hash = digest.split("+")[1]), this.clog("hmac using hash", hash);
        var hmac = forge.hmac.create();
        return hmac.start(hash, password), hmac.update(salt), hmac.digest().toHex()
    }
    if ("xor" == digest) {
        var trimmed_salt = salt.slice(0, password.length);
        return Utilities.xorString(trimmed_salt, password)
    }
    return null
}, XpraClient.prototype._send_ping = function () {
    if (!this.reconnect_in_progress) {
        var me = this, now_ms = Math.ceil(Utilities.monotonicTime());
        this.send(["ping", now_ms]), this.ping_timeout_timer = setTimeout(function () {
            me._check_echo_timeout(now_ms)
        }, this.PING_TIMEOUT);
        this.ping_grace_timer = setTimeout(function () {
            me._check_server_echo(now_ms)
        }, 2e3)
    }
}, XpraClient.prototype._process_ping = function (packet, ctx) {
    var echotime = packet[1];
    ctx.last_ping_server_time = echotime, packet.length > 2 && (ctx.last_ping_server_time = packet[2]);
    var sid = "";
    packet.length >= 4 && (sid = packet[3]), ctx.last_ping_local_time = (new Date).getTime();
    ctx.send(["ping_echo", echotime, 0, 0, 0, 0, sid])
}, XpraClient.prototype._process_ping_echo = function (packet, ctx) {
    ctx.last_ping_echoed_time = packet[1];
    var l1 = packet[2], l2 = packet[3], l3 = packet[4];
    ctx.client_ping_latency = packet[5], ctx.server_ping_latency = Math.ceil(Utilities.monotonicTime()) - ctx.last_ping_echoed_time, ctx.server_load = [l1 / 1e3, l2 / 1e3, l3 / 1e3], ctx._check_server_echo(0)
}, XpraClient.prototype.start_info_timer = function () {
    if (null == this.info_timer) {
        var me = this;
        this.info_timer = setInterval(function () {
            return null != me.info_timer && me.send_info_request(), !0
        }, this.INFO_FREQUENCY)
    }
}, XpraClient.prototype.send_info_request = function () {
    this.info_request_pending || (this.send(["info-request", [this.uuid], [], []]), this.info_request_pending = !0)
}, XpraClient.prototype._process_info_response = function (packet, ctx) {
    ctx.info_request_pending = !1, ctx.server_last_info = packet[1], ctx.debug("network", "info-response:", ctx.server_last_info);
    var event = document.createEvent("Event");
    event.initEvent("info-response", !0, !0), event.data = ctx.server_last_info, document.dispatchEvent(event)
}, XpraClient.prototype.stop_info_timer = function () {
    this.info_timer && (clearTimeout(this.info_timer), this.info_timer = null, this.info_request_pending = !1)
}, XpraClient.prototype._process_new_tray = function (packet, ctx) {
    var wid = packet[1], w = packet[2], h = packet[3], metadata = packet[4], mydiv = document.createElement("div");
    mydiv.id = String(wid);
    var mycanvas = document.createElement("canvas");
    mydiv.appendChild(mycanvas);
    var float_tray = document.getElementById("float_tray"), float_menu = document.getElementById("float_menu");
    $("#float_menu").children().show();
    var new_width = float_menu_width + float_menu_item_size - float_menu_padding + 5;
    float_menu.style.width = new_width + "px", float_menu_width = $("#float_menu").width() + 10, mydiv.style.backgroundColor = "white", float_tray.appendChild(mydiv);
    w = float_menu_item_size, h = float_menu_item_size, mycanvas.width = w, mycanvas.height = h;
    var win = new XpraWindow(ctx, mycanvas, wid, 0, 0, w, h, metadata, !1, !0, {}, ctx._tray_geometry_changed, ctx._window_mouse_move, ctx._window_mouse_down, ctx._window_mouse_up, ctx._window_mouse_scroll, ctx._tray_set_focus, ctx._tray_closed);
    ctx.id_to_window[wid] = win, ctx.send_tray_configure(wid)
}, XpraClient.prototype.send_tray_configure = function (wid) {
    var div = jQuery("#" + String(wid)), x = Math.round(div.offset().left), y = Math.round(div.offset().top),
        w = float_menu_item_size, h = float_menu_item_size;
    this.clog("tray", wid, "position:", x, y), this.send(["configure-window", Number(wid), x, y, w, h, {}])
}, XpraClient.prototype._tray_geometry_changed = function (win) {
    ctx.debug("tray", "tray geometry changed (ignored)")
}, XpraClient.prototype._tray_set_focus = function (win) {
    ctx.debug("tray", "tray set focus (ignored)")
}, XpraClient.prototype._tray_closed = function (win) {
    ctx.debug("tray", "tray closed (ignored)")
}, XpraClient.prototype.reconfigure_all_trays = function () {
    var float_menu = document.getElementById("float_menu");
    float_menu_width = 4 * float_menu_item_size + float_menu_padding;
    for (var twid in this.id_to_window) {
        var twin = this.id_to_window[twid];
        twin && twin.tray && (float_menu_width += float_menu_item_size, this.send_tray_configure(twid))
    }
    $("#float_menu").width() > 0 && (float_menu.style.width = float_menu_width)
}, XpraClient.prototype._new_window = function (wid, x, y, w, h, metadata, override_redirect, client_properties) {
    var mydiv = document.createElement("div");
    mydiv.id = String(wid);
    var mycanvas = document.createElement("canvas");
    mydiv.appendChild(mycanvas), document.getElementById("screen").appendChild(mydiv), mycanvas.width = w, mycanvas.height = h;
    var win = new XpraWindow(this, mycanvas, wid, x, y, w, h, metadata, override_redirect, !1, client_properties, this._window_geometry_changed, this._window_mouse_move, this._window_mouse_down, this._window_mouse_up, this._window_mouse_scroll, this._window_set_focus, this._window_closed);
    if (win && !override_redirect && "NORMAL" == win.metadata["window-type"]) {
        var decodedTitle = decodeURIComponent(escape(win.title)), trimmedTitle = Utilities.trimString(decodedTitle, 30);
        window.addWindowListItem(wid, trimmedTitle)
    }
    if (this.id_to_window[wid] = win, !override_redirect) {
        var geom = win.get_internal_geometry();
        this.send(["map-window", wid, geom.x, geom.y, geom.w, geom.h, this._get_client_properties(win)]), this._window_set_focus(win)
    }
    // win = client.id_to_window[client.topwindow];
    // win._set_decorated(false);
    // win.handle_resized();
    // win.move(0, 0);
}, XpraClient.prototype._new_window_common = function (packet, override_redirect) {
    var wid = packet[1], x = packet[2], y = packet[3], w = packet[4], h = packet[5], metadata = packet[6];
    if (wid in this.id_to_window) throw new Error("we already have a window " + wid);
    (w <= 0 || h <= 0) && (this.error("window dimensions are wrong:", w, h), h = 1);
    var client_properties = {};
    if (packet.length >= 8 && (client_properties = packet[7]), 0 == x && 0 == y && !metadata["set-initial-position"]) {
        var l = Object.keys(this.id_to_window).length;
        0 == l ? (w <= this.desktop_width && (x = Math.round((this.desktop_width - w) / 2)), h <= this.desktop_height && (y = Math.round((this.desktop_height - h) / 2))) : (x = Math.min(10 * l, Math.max(0, this.desktop_width - 100)), y = 96)
    }
    this._new_window(wid, x, y, w, h, metadata, override_redirect, client_properties), this._new_ui_event()
}, XpraClient.prototype._window_closed = function (win) {
    win.client.send(["close-window", win.wid])
}, XpraClient.prototype._get_client_properties = function (win) {
    var cp = win.client_properties;
    return cp["encodings.rgb_formats"] = this.RGB_FORMATS, cp
},XpraClient.prototype._window_geometry_changed = function (win) {
    var geom = win.get_internal_geometry(), wid = win.wid;
    win.client.send(["configure-window", wid, geom.x, geom.y, geom.w, geom.h, win.client._get_client_properties(win)])
},XpraClient.prototype._process_new_window = function (packet, ctx) {
    ctx._new_window_common(packet, !1)
},XpraClient.prototype._process_new_override_redirect = function (packet, ctx) {
    ctx._new_window_common(packet, !0)
},XpraClient.prototype._process_window_metadata = function (packet, ctx) {
    var wid = packet[1], metadata = packet[2], win = ctx.id_to_window[wid];
    null != win && win.update_metadata(metadata)
},XpraClient.prototype._process_initiate_moveresize = function (packet, ctx) {
    var wid = packet[1], win = ctx.id_to_window[wid];
    if (null != win) {
        var x_root = packet[2], y_root = packet[3], direction = packet[4], button = packet[5],
            source_indication = packet[6];
        win.initiate_moveresize(ctx.mousedown_event, x_root, y_root, direction, button, source_indication)
    }
},XpraClient.prototype.on_last_window = function () {
},XpraClient.prototype._process_lost_window = function (packet, ctx) {
    var wid = packet[1], win = ctx.id_to_window[wid];
    win && !win.override_redirect && "NORMAL" == win.metadata["window-type"] && window.removeWindowListItem(wid);
    try {
        delete ctx.id_to_window[wid]
    } catch (e) {
    }
    null != win && (win.destroy(), ctx.clog("lost window, was tray=", win.tray), win.tray && ctx.reconfigure_all_trays()), ctx.clog("lost window", wid, ", remaining: ", Object.keys(ctx.id_to_window)), 0 == Object.keys(ctx.id_to_window).length && ctx.on_last_window()
},XpraClient.prototype._process_raise_window = function (packet, ctx) {
    var wid = packet[1], win = ctx.id_to_window[wid];
    null != win && ctx._window_set_focus(win)
},XpraClient.prototype._process_window_resized = function (packet, ctx) {
    var wid = packet[1], width = packet[2], height = packet[3], win = ctx.id_to_window[wid];
    null != win && win.resize(width, height)
},XpraClient.prototype._process_window_move_resize = function (packet, ctx) {
    var wid = packet[1], x = packet[2], y = packet[3], width = packet[4], height = packet[5],
        win = ctx.id_to_window[wid];
    null != win && win.move_resize(x, y, width, height)
},XpraClient.prototype._process_configure_override_redirect = function (packet, ctx) {
    var wid = packet[1], x = packet[2], y = packet[3], width = packet[4], height = packet[5],
        win = ctx.id_to_window[wid];
    null != win && win.move_resize(x, y, width, height)
},XpraClient.prototype._process_desktop_size = function (packet, ctx) {
},XpraClient.prototype._process_bell = function (packet, ctx) {
    var percent = packet[3], pitch = packet[4], duration = packet[5];
    if (null != ctx.audio_context) {
        var oscillator = ctx.audio_context.createOscillator(), gainNode = ctx.audio_context.createGain();
        oscillator.connect(gainNode), gainNode.connect(ctx.audio_context.destination), gainNode.gain.setValueAtTime(percent, ctx.audio_context.currentTime), oscillator.frequency.setValueAtTime(pitch, ctx.audio_context.currentTime), oscillator.start(), setTimeout(function () {
            oscillator.stop()
        }, duration)
    } else {
        new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=").play()
    }
},XpraClient.prototype._process_notify_show = function (packet, ctx) {
    function notify() {
        var icon_url = "";
        icon && (icon_url = "data:image/png;base64," + Utilities.ArrayBufferToBase64(icon));
        var notification = new Notification(summary, {body: body, icon: icon_url});
        notification.onclose = function () {
            ctx.send(["notification-close", nid, 2, ""])
        }, notification.onclick = function () {
            ctx.log("user clicked on notification", nid)
        }
    }

    var nid = packet[2], replaces_nid = packet[4], summary = packet[6], body = packet[7], expire_timeout = packet[8],
        icon = packet[9], actions = packet[10], hints = packet[11];
    if (window.closeNotification && (replaces_nid > 0 && window.closeNotification(replaces_nid), window.closeNotification(nid)), "Notification" in window && 0 == actions.length) {
        if ("granted" === Notification.permission) return void notify();
        if ("denied" !== Notification.permission) return void Notification.requestPermission(function (permission) {
            "granted" === permission && notify()
        })
    }
    window.doNotification && window.doNotification("info", nid, summary, body, expire_timeout, icon, actions, hints, function (nid, action_id) {
        ctx.send(["notification-action", nid, action_id])
    }, function (nid, reason, text) {
        ctx.send(["notification-close", nid, reason, text || ""])
    }), ctx._new_ui_event()
},XpraClient.prototype._process_notify_close = function (packet, ctx) {
    nid = packet[1], window.closeNotification && window.closeNotification(nid)
},XpraClient.prototype.reset_cursor = function (packet, ctx) {
    for (var wid in ctx.id_to_window) {
        ctx.id_to_window[wid].reset_cursor()
    }
},XpraClient.prototype._process_cursor = function (packet, ctx) {
    if (2 == packet.length) return void ctx.reset_cursor(packet, ctx);
    if (packet.length < 9) return void ctx.reset_cursor();
    var encoding = packet[1];
    if ("png" != encoding) return void ctx.warn("invalid cursor encoding: " + encoding);
    var w = packet[4], h = packet[5], xhot = packet[6], yhot = packet[7], img_data = packet[9];
    for (var wid in ctx.id_to_window) {
        ctx.id_to_window[wid].set_cursor(encoding, w, h, xhot, yhot, img_data)
    }
},XpraClient.prototype._process_window_icon = function (packet, ctx) {
    var wid = packet[1], w = packet[2], h = packet[3], encoding = packet[4], img_data = packet[5];
    ctx.debug("main", "window-icon: ", encoding, " size ", w, "x", h);
    var win = ctx.id_to_window[wid];
    if (win) {
        var src = win.update_icon(w, h, encoding, img_data);
        (wid == ctx.focus || ctx.server_is_desktop || ctx.server_is_shadow) && jQuery("#favicon").attr("href", src)
    }
},XpraClient.prototype._process_draw = function (packet, ctx) {
    ctx.queue_draw_packets ? (null === ctx.dQ_interval_id && (ctx.dQ_interval_id = setInterval(function () {
        ctx._process_draw_queue(null, ctx)
    }, ctx.process_interval)), ctx.dQ[ctx.dQ.length] = packet) : ctx._process_draw_queue(packet, ctx)
},XpraClient.prototype._process_eos = function (packet, ctx) {
    ctx._process_draw(packet, ctx)
},XpraClient.prototype.request_redraw = function (win) {
    if (document.hidden) return void this.debug("draw", "not redrawing, document.hidden=", document.hidden);
    if (this.debug("draw", "request_redraw for", win), win.swap_buffers(), window.requestAnimationFrame) {
        if (this.pending_redraw.includes(win) || this.pending_redraw.push(win), 0 == this.draw_pending) {
            var now = Utilities.monotonicTime();
            this.draw_pending = now;
            var me = this;
            window.requestAnimationFrame(function () {
                for (me.debug("draw", "animation frame:", me.pending_redraw.length, "windows to paint, processing delay", Utilities.monotonicTime() - me.draw_pending, "ms"), me.draw_pending = 0; me.pending_redraw.length > 0;) {
                    me.pending_redraw.shift().draw()
                }
            })
        }
    } else win.draw()
},XpraClient.prototype._process_draw_queue = function (packet, ctx) {
    function send_damage_sequence(decode_time, message) {
        protocol.send(["damage-sequence", packet_sequence, wid, width, height, decode_time, message])
    }

    if (!packet && ctx.queue_draw_packets && (packet = ctx.dQ.shift()), packet) {
        var ptype = packet[0], wid = packet[1], win = ctx.id_to_window[wid];
        if ("eos" == ptype) return ctx.debug("draw", "eos for window", wid), void (win && win.eos());
        var start = Utilities.monotonicTime(), x = packet[2], y = packet[3], width = packet[4], height = packet[5],
            coding = packet[6], data = packet[7], packet_sequence = packet[8], rowstride = packet[9], options = {};
        packet.length > 10 && (options = packet[10]);
        var protocol = ctx.protocol;
        if (protocol) {
            if (!win) return ctx.debug("draw", "cannot paint, window not found:", wid), void send_damage_sequence(-1, "window " + wid + " not found");
            try {
                win.paint(x, y, width, height, coding, data, packet_sequence, rowstride, options, function (error) {
                    var flush = options.flush || 0, decode_time = -1;
                    0 == flush && ctx.request_redraw(win), error ? ctx.request_redraw(win) : decode_time = Math.round(1e3 * (Utilities.monotonicTime() - start)), ctx.debug("draw", "decode time for ", coding, " sequence ", packet_sequence, ": ", decode_time, ", flush=", flush), send_damage_sequence(decode_time, error || "")
                })
            } catch (e) {
                ctx.exc(e, "error painting", coding, "sequence no", packet_sequence), send_damage_sequence(-1, String(e)), win.paint_pending = 0, win.may_paint_now(), ctx.request_redraw(win)
            }
        }
    }
},XpraClient.prototype.init_audio = function (ignore_audio_blacklist) {
    if (this.debug("audio", "init_audio() enabled=", this.audio_enabled, ", mediasource enabled=", this.audio_mediasource_enabled, ", aurora enabled=", this.audio_aurora_enabled, ", http-stream enabled=", this.audio_httpstream_enabled), this.audio_mediasource_enabled) {
        this.mediasource_codecs = MediaSourceUtil.getMediaSourceAudioCodecs(ignore_audio_blacklist);
        for (var codec_option in this.mediasource_codecs) this.audio_codecs[codec_option] = this.mediasource_codecs[codec_option]
    }
    if (this.audio_aurora_enabled) {
        this.aurora_codecs = MediaSourceUtil.getAuroraAudioCodecs();
        for (var codec_option in this.aurora_codecs) codec_option in this.audio_codecs || (this.audio_codecs[codec_option] = this.aurora_codecs[codec_option])
    }
    if (this.audio_httpstream_enabled) {
        var stream_codecs = ["mp3"];
        for (var i in stream_codecs) {
            var codec_option = stream_codecs[i];
            codec_option in this.audio_codecs || (this.audio_codecs[codec_option] = codec_option)
        }
    }
    if (this.debug("audio", "codecs:", this.audio_codecs), !this.audio_codecs) return this.audio_codec = null, this.audio_enabled = !1, void this.warn("no valid audio codecs found");
    this.audio_codec in this.audio_codecs ? this.log("using " + this.audio_framework + " audio codec: " + this.audio_codec) : (this.audio_codec && (this.warn("invalid audio codec: " + this.audio_codec), this.warn("codecs found: " + this.audio_codecs)), this.audio_codec = MediaSourceUtil.getDefaultAudioCodec(this.audio_codecs), this.audio_codec ? (this.audio_mediasource_enabled && this.audio_codec in this.mediasource_codecs ? this.audio_framework = "mediasource" : this.audio_aurora_enabled && !Utilities.isIE() ? this.audio_framework = "aurora" : this.audio_httpstream_enabled && (this.audio_framework = "http-stream"), this.audio_framework ? this.log("using " + this.audio_framework + " audio codec: " + this.audio_codec) : (this.warn("no valid audio framework - cannot enable audio"), this.audio_enabled = !1)) : (this.warn("no valid audio codec found"), this.audio_enabled = !1)), this.log("audio codecs: ", Object.keys(this.audio_codecs))
},XpraClient.prototype._sound_start_receiving = function () {
    if (!this.audio_framework || !this.audio_codec) {
        var codecs_supported = MediaSourceUtil.get_supported_codecs(this.audio_mediasource_enabled, this.audio_aurora_enabled, this.audio_httpstream_enabled, !1),
            audio_codec = MediaSourceUtil.get_best_codec(codecs_supported);
        if (!audio_codec) return void this.log("no codec found");
        var acparts = audio_codec.split(":");
        this.audio_framework = acparts[0], this.audio_codec = acparts[1]
    }
    try {
        this.audio_buffers = [], this.audio_buffers_count = 0, "http-stream" == this.audio_framework ? this._sound_start_httpstream() : "mediasource" == this.audio_framework ? this._sound_start_mediasource() : this._sound_start_aurora()
    } catch (e) {
        this.exc(e, "error starting audio player")
    }
},XpraClient.prototype._send_sound_start = function () {
    this.log("audio: requesting " + this.audio_codec + " stream from the server"), this.send(["sound-control", "start", this.audio_codec])
},XpraClient.prototype._sound_start_httpstream = function () {
    this.audio = document.createElement("audio"), this.audio.setAttribute("autoplay", !0), this.audio.setAttribute("controls", !1), this.audio.setAttribute("loop", !0);
    var url = "http";
    this.ssl && (url = "https"), url += "://" + this.host + ":" + this.port + this.path, url.endsWith("index.html") && (url = url.substring(0, url.lastIndexOf("index.html"))), url.endsWith("/") || (url += "/"), url += "audio.mp3?uuid=" + this.uuid;
    var source = document.createElement("source");
    source.type = "audio/mpeg", source.src = url, this.audio.appendChild(source), this.log("starting http stream from", url), document.body.appendChild(this.audio)
},XpraClient.prototype._sound_start_aurora = function () {
    this.audio_aurora_ctx = AV.Player.fromXpraSource(), this._send_sound_start()
},XpraClient.prototype._sound_start_mediasource = function () {
    function audio_error(event) {
        me.audio ? (me.error(event + " error: " + me.audio.error), me.audio.error && me.error(MediaSourceConstants.ERROR_CODE[me.audio.error.code])) : me.error(event + " error"), me.close_audio()
    }

    var me = this;
    this.media_source = MediaSourceUtil.getMediaSource(), this.debug && MediaSourceUtil.addMediaSourceEventDebugListeners(this.media_source, "audio"), this.media_source.addEventListener("error", function (e) {
        audio_error("audio source")
    }), this.audio = document.createElement("audio"), this.audio.setAttribute("autoplay", !0), this.debug && MediaSourceUtil.addMediaElementEventDebugListeners(this.audio, "audio"), this.audio.addEventListener("play", function () {
        me.clog("audio play!")
    }), this.audio.addEventListener("error", function () {
        audio_error("audio")
    }), document.body.appendChild(this.audio), this.audio.src = window.URL.createObjectURL(this.media_source), this.audio_buffers = [], this.audio_buffers_count = 0, this.audio_source_ready = !1, this.clog("audio waiting for source open event on", this.media_source), this.media_source.addEventListener("sourceopen", function () {
        if (me.log("audio media source open"), me.audio_source_ready) return void me.warn("ignoring: source already open");
        var codec_string = MediaSourceConstants.CODEC_STRING[me.audio_codec];
        if (null == codec_string) return me.error("invalid codec '" + me.audio_codec + "'"), void me.close_audio();
        me.log("using audio codec string for " + me.audio_codec + ": " + codec_string);
        var asb = null;
        try {
            asb = me.media_source.addSourceBuffer(codec_string)
        } catch (e) {
            return me.exc(e, "audio setup error for", codec_string), void me.close_audio()
        }
        me.audio_source_buffer = asb, asb.mode = "sequence", this.debug && MediaSourceUtil.addSourceBufferEventDebugListeners(asb, "audio"), asb.addEventListener("error", function (e) {
            audio_error("audio buffer")
        }), me.audio_source_ready = !0, me._send_sound_start()
    })
},XpraClient.prototype.close_audio = function () {
    this.protocol && this.send(["sound-control", "stop"]),
        "http-stream" == this.audio_framework ? this._close_audio_httpstream() : "mediasource" == this.audio_framework ? this._close_audio_mediasource() : this._close_audio_aurora(), this.on_audio_state_change("stopped", "closed")
},XpraClient.prototype._close_audio_httpstream = function () {
    this._remove_audio_element()
},XpraClient.prototype._close_audio_aurora = function () {
    if (this.audio_aurora_ctx) {
        if (this.audio_aurora_ctx.context) try {
            this.audio_aurora_ctx.context.close()
        } catch (e) {
            this.debug("audio", "error closing context", e)
        }
        this.audio_aurora_ctx = null
    }
},XpraClient.prototype._close_audio_mediasource = function () {
    if (this.log("close_audio_mediasource: audio_source_buffer=" + this.audio_source_buffer + ", media_source=" + this.media_source + ", audio=" + this.audio), this.audio_source_ready = !1, this.audio) {
        if (this.send(["sound-control", "stop"]), this.media_source) {
            try {
                this.audio_source_buffer && (this.media_source.removeSourceBuffer(this.audio_source_buffer), this.audio_source_buffer = null), "open" == this.media_source.readyState && this.media_source.endOfStream()
            } catch (e) {
                this.exc(e, "audio media source EOS error")
            }
            this.media_source = null
        }
        this._remove_audio_element()
    }
},XpraClient.prototype._remove_audio_element = function () {
    if (null != this.audio) {
        this.audio.src = "", this.audio.load();
        try {
            document.body.removeChild(this.audio)
        } catch (e) {
            this.debug("audio", "failed to remove audio from page:", e)
        }
        this.audio = null
    }
},XpraClient.prototype._process_sound_data = function (packet, ctx) {
    if (packet[1] != ctx.audio_codec) return ctx.error("invalid audio codec '" + packet[1] + "' (expected " + ctx.audio_codec + "), stopping audio stream"), void ctx.close_audio();
    try {
        var codec = packet[1], buf = packet[2], options = packet[3], metadata = packet[4];
        1 == options["start-of-stream"] && ctx._audio_start_stream(), buf && buf.length > 0 && ctx.add_sound_data(codec, buf, metadata), 1 == options["end-of-stream"] && (ctx.log("received end-of-stream from server"), ctx.close_audio())
    } catch (e) {
        ctx.on_audio_state_change("error", "" + e), ctx.exc(e, "sound data error"), ctx.close_audio()
    }
},XpraClient.prototype.on_audio_state_change = function (newstate, details) {
    this.debug("on_audio_state_change:", newstate, details), this.audio_state = newstate
},XpraClient.prototype.add_sound_data = function (codec, buf, metadata) {
    var MIN_START_BUFFERS = 4;
    if (this.debug("audio", "sound-data: ", codec, ", ", buf.length, "bytes"), this.audio_buffers.length >= 250) return this.warn("audio queue overflowing: " + this.audio_buffers.length + ", stopping"), this.on_audio_state_change("error", "queue overflow"), void this.close_audio();
    if (metadata) {
        this.debug("audio", "audio metadata=", metadata);
        for (var i = 0; i < metadata.length; i++) this.debug("audio", "metadata[", i, "]=", metadata[i], ", length=", metadata[i].length, ", type=", Object.prototype.toString.call(metadata[i])), this.audio_buffers.push(Utilities.StringToUint8(metadata[i]));
        MIN_START_BUFFERS = 1
    }
    null != buf && this.audio_buffers.push(buf);
    var ab = this.audio_buffers;
    if (this._audio_ready() && (this.audio_buffers_count > 0 || ab.length >= MIN_START_BUFFERS)) {
        var i, j;
        if (1 == ab.length) buf = ab[0]; else {
            for (var size = 0, i = 0, j = ab.length; i < j; ++i) size += ab[i].length;
            buf = new Uint8Array(size), size = 0;
            for (var i = 0, j = ab.length; i < j; ++i) {
                var v = ab[i];
                v.length > 0 && (buf.set(v, size), size += v.length)
            }
        }
        this.audio_buffers_count += 1, this.push_audio_buffer(buf), this.audio_buffers = []
    }
},XpraClient.prototype._audio_start_stream = function () {
    if (this.debug("audio", "audio start of " + this.audio_framework + " " + this.audio_codec + " stream"), "playing" != this.audio_state && "waiting" != this.audio_state) {
        if ("mediasource" == this.audio_framework) {
            var me = this;
            this.audio.play().then(function (result) {
                me.debug("audio", "stream playing", result)
            }, function (err) {
                me.debug("audio", "stream failed:", err)
            })
        } else "http-stream" == this.audio_framework ? me.log("invalid start-of-stream data for http-stream framework") : "aurora" == this.audio_framework ? this.audio_aurora_ctx.play() : me.log("invalid start-of-stream data for unknown framework:", this.audio_framework);
        this.on_audio_state_change("waiting", this.audio_framework + " playing " + this.audio_codec + " stream")
    }
},XpraClient.prototype._audio_ready = function () {
    if ("mediasource" == this.audio_framework) {
        this.audio && (this.debug("audio", "mediasource state=", MediaSourceConstants.READY_STATE[this.audio.readyState], ", network state=", MediaSourceConstants.NETWORK_STATE[this.audio.networkState]), this.debug("audio", "audio paused=", this.audio.paused, ", queue size=", this.audio_buffers.length, ", source ready=", this.audio_source_ready, ", source buffer updating=", this.audio_source_buffer.updating));
        var asb = this.audio_source_buffer;
        return null != asb && !asb.updating
    }
    return null != this.audio_aurora_ctx
},XpraClient.prototype.push_audio_buffer = function (buf) {
    if ("mediasource" == this.audio_framework) {
        this.audio_source_buffer.appendBuffer(buf);
        var b = this.audio_source_buffer.buffered;
        if (b && b.length >= 1) {
            var e = (this.audio.played, b.end(0)), buf_size = Math.round(1e3 * (e - this.audio.currentTime));
            this.debug("audio", "buffer size=", buf_size, "ms, currentTime=", this.audio.currentTime)
        }
    } else this.audio_aurora_ctx.asset.source._on_data(buf), this.debug("audio", "playing=", this.audio_aurora_ctx.playing, "buffered=", this.audio_aurora_ctx.buffered, "currentTime=", this.audio_aurora_ctx.currentTime, "duration=", this.audio_aurora_ctx.duration), this.audio_aurora_ctx.format && this.debug("audio", "formatID=", this.audio_aurora_ctx.format.formatID, "sampleRate=", this.audio_aurora_ctx.format.sampleRate), this.debug("audio", "active=", this.audio_aurora_ctx.asset.active, "decoder=", this.audio_aurora_ctx.asset.decoder, "demuxer=", this.audio_aurora_ctx.demuxer);
    this.on_audio_state_change("playing", "")
},XpraClient.prototype.get_clipboard_buffer = function () {
    return this.clipboard_buffer
},XpraClient.prototype.get_clipboard_datatype = function () {
    return this.clipboard_datatype
},XpraClient.prototype.send_clipboard_token = function (data) {
    if (this.clipboard_enabled) {
        this.debug("clipboard", "sending clipboard token with data:", data);
        var packet;
        packet = data ? ["clipboard-token", "CLIPBOARD", ["UTF8_STRING", "text/plain"], "UTF8_STRING", "UTF8_STRING", 8, "bytes", data, !0, !0, !0] : ["clipboard-token", "CLIPBOARD", [], "", "", 8, "bytes", "", !0, !0, !0], this.send(packet)
    }
},XpraClient.prototype._process_clipboard_token = function (packet, ctx) {
    if (ctx.clipboard_enabled) {
        var selection = packet[1], targets = [], target = null, dtype = null, dformat = null, wire_encoding = null,
            wire_data = null;
        packet.length >= 3 && (targets = packet[2]), packet.length >= 8 && (target = packet[3], dtype = packet[4], dformat = packet[5], wire_encoding = packet[6], wire_data = packet[7], ctx.clipboard_server_buffers[selection] = [target, dtype, dformat, wire_encoding, wire_data]);
        var is_valid_target = target && ctx.clipboard_targets.includes(target);
        if (ctx.debug("clipboard", "clipboard token received"), ctx.debug("clipboard", "targets=", targets), ctx.debug("clipboard", "target=", target, "is valid:", is_valid_target), ctx.debug("clipboard", "dtype=", dtype, "dformat=", dformat, "wire-encoding=", wire_encoding), is_valid_target) {
            var is_text = dtype.toLowerCase().indexOf("text") >= 0 || dtype.toLowerCase().indexOf("string") >= 0;
            if (is_text) {
                try {
                    wire_data = Utilities.Uint8ToString(wire_data)
                } catch (e) {
                }
                ctx.clipboard_buffer != wire_data && (ctx.clipboard_datatype = dtype, ctx.clipboard_buffer = wire_data, ctx.clipboard_pending = !0, navigator.clipboard && navigator.clipboard.writeText && is_text && navigator.clipboard.writeText(wire_data).then(function () {
                    ctx.debug("clipboard", "writeText succeeded"), ctx.clipboard_pending = !1
                }, function () {
                    ctx.debug("clipboard", "writeText failed")
                }))
            } else if (CLIPBOARD_IMAGES && "image/png" == dtype && 8 == dformat && "bytes" == wire_encoding && navigator.clipboard && navigator.clipboard.write) {
                ctx.debug("clipboard", "png image received");
                var blob = new Blob([wire_data], {type: dtype});
                ctx.debug("clipboard", "created blob", blob);
                var item = new ClipboardItem({"image/png": blob});
                ctx.debug("clipboard", "created ClipboardItem", item);
                var items = [item];
                ctx.debug("clipboard", "created ClipboardItem list", items), navigator.clipboard.write(items).then(function () {
                    ctx.debug("clipboard", "copied png image to clipboard")
                }).catch(function (err) {
                    ctx.debug("clipboard", "failed to set png image", err)
                })
            }
        }
    }
},XpraClient.prototype._process_set_clipboard_enabled = function (packet, ctx) {
    ctx.clipboard_enabled && (ctx.clipboard_enabled = packet[1], ctx.log("server set clipboard state to " + packet[1] + " reason was: " + packet[2]))
},XpraClient.prototype._process_clipboard_request = function (packet, ctx) {
    var request_id = packet[1], selection = packet[2];
    if (ctx.debug("clipboard", selection + " request"), "CLIPBOARD" != selection) return void ctx.send_clipboard_string(request_id, selection, "");
    if (navigator.clipboard) {
        if (navigator.clipboard.read) return ctx.debug("clipboard", "request using read()"), void navigator.clipboard.read().then(function (data) {
            var item = null, itemtype = null;
            ctx.debug("clipboard", "request via read() data=", data);
            for (var i = 0; i < data.length; i++) {
                item = data[i], ctx.debug("clipboard", "item", i, "types:", item.types);
                for (var j = 0; j < item.types.length; j++) {
                    if ("text/plain" == (itemtype = item.types[j])) return void item.getType(itemtype).then(function (blob) {
                        var fileReader = new FileReader;
                        fileReader.onload = function (event) {
                            ctx.send_clipboard_string(request_id, selection, event.target.result)
                        }, fileReader.readAsText(blob)
                    }, function (err) {
                        ctx.debug("clipboard", "getType('" + itemtype + "') failed", err), ctx.resend_clipboard_server_buffer()
                    });
                    if ("image/png" == itemtype) return void item.getType(itemtype).then(function (blob) {
                        var fileReader = new FileReader;
                        fileReader.onload = function (event) {
                            ctx.send_clipboard_contents(request_id, selection, itemtype, 8, "bytes", event.target.result)
                        }, fileReader.readAsText(blob)
                    }, function (err) {
                        ctx.debug("clipboard", "getType('" + itemtype + "') failed", err), ctx.resend_clipboard_server_buffer(request_id, selection)
                    })
                }
            }
        }, function (err) {
            ctx.debug("clipboard", "read() failed:", err), ctx.resend_clipboard_server_buffer(request_id, selection)
        });
        if (navigator.clipboard.readText) return ctx.debug("clipboard", "clipboard request using readText()"), void navigator.clipboard.readText().then(function (text) {
            ctx.debug("clipboard", "clipboard request via readText() text=", text);
            var primary_server_buffer = ctx.clipboard_server_buffers.PRIMARY;
            if (primary_server_buffer && 8 == primary_server_buffer[2] && "bytes" == primary_server_buffer[3] && text == primary_server_buffer[4]) return ctx.debug("clipboard request: using backup value"), void ctx.resend_clipboard_server_buffer(request_id, selection);
            ctx.send_clipboard_string(request_id, selection, text)
        }, function (err) {
            ctx.debug("clipboard", "readText() failed:", err), ctx.resend_clipboard_server_buffer(request_id, selection)
        })
    }
    var clipboard_buffer = ctx.get_clipboard_buffer() || "";
    ctx.send_clipboard_string(request_id, selection, clipboard_buffer, "UTF8_STRING")
},XpraClient.prototype.resend_clipboard_server_buffer = function (request_id, selection) {
    var server_buffer = this.clipboard_server_buffers.CLIPBOARD;
    if (this.debug("clipboard", "resend_clipboard_server_buffer:", server_buffer), !server_buffer) return void this.send_clipboard_string(request_id, selection, "", "UTF8_STRING");
    var dtype = (server_buffer[0], server_buffer[1]), dformat = server_buffer[2], wire_encoding = server_buffer[3],
        wire_data = server_buffer[4];
    this.send_clipboard_contents(request_id, selection, dtype, dformat, wire_encoding, wire_data)
},XpraClient.prototype.send_clipboard_string = function (request_id, selection, clipboard_buffer, datatype) {
    var packet;
    packet = "" == clipboard_buffer ? ["clipboard-contents-none", request_id, selection] : ["clipboard-contents", request_id, selection, datatype || "UTF8_STRING", 8, "bytes", clipboard_buffer], this.debug("clipboard", "send_clipboard_string: packet=", packet), this.send(packet)
},XpraClient.prototype.send_clipboard_contents = function (request_id, selection, datatype, dformat, encoding, clipboard_buffer) {
    var packet;
    packet = "" == clipboard_buffer ? ["clipboard-contents-none", request_id, selection] : ["clipboard-contents", request_id, selection, datatype, dformat || 8, encoding || "bytes", clipboard_buffer], this.send(packet)
},XpraClient.prototype._process_send_file = function (packet, ctx) {
    var basefilename = packet[1], mimetype = packet[2], printit = packet[3], datasize = packet[5], data = packet[6];
    if (data.length != datasize) return void ctx.warn("send-file: invalid data size, received", data.length, "bytes, expected", datasize);
    printit ? ctx.print_document(basefilename, data, mimetype) : ctx.save_file(basefilename, data, mimetype)
},XpraClient.prototype.save_file = function (filename, data, mimetype) {
    if (!this.file_transfer || !this.remote_file_transfer) return void this.warn("Received file-transfer data but this is not enabled!");
    "" == mimetype && (mimetype = "application/octet-binary"), this.log("saving " + data.length + " bytes of " + mimetype + " data to filename " + filename), Utilities.saveFile(filename, data, {type: mimetype})
},XpraClient.prototype.print_document = function (filename, data, mimetype) {
    if (!this.printing || !this.remote_printing) return void this.warn("Received data to print but printing is not enabled!");
    if ("application/pdf" != mimetype) return void this.warn("Received unsupported print data mimetype: " + mimetype);
    this.log("got " + data.length + " bytes of PDF to print");
    var b64data = btoa(uintToString(data)), win = window.open("data:application/pdf;base64," + b64data, "_blank");
    win && !win.closed && void 0 !== win.closed || (this.warn("popup blocked, saving to file instead"), Utilities.saveFile(filename, data, {type: mimetype}))
},XpraClient.prototype.send_file = function (filename, mimetype, size, buffer) {
    if (!this.file_transfer || !this.remote_file_transfer) return void this.warn("cannot send file: file transfers are disabled!");
    var packet = ["send-file", filename, mimetype, !1, this.remote_open_files, size, buffer, {}];
    this.send(packet)
},XpraClient.prototype.start_command = function (name, command, ignore) {
    var packet = ["start-command", name, command, ignore];
    this.send(packet)
},XpraClient.prototype._process_open_url = function (packet, ctx) {
    var url = packet[1];
    if (!ctx.open_url) return ctx.cwarn("Warning: received a request to open URL '%s'", url), void ctx.clog(" but opening of URLs is disabled");
    ctx.clog("opening url:", url);
    var new_window = window.open(url, "_blank");
    if (!new_window || new_window.closed || void 0 === new_window.closed) {
        var body = '<a href="' + url + '" target="_blank">' + url + "</a>";
        window.doNotification("", 0, "Open URL", body, 10, null, null, null, null, null)
    }
};
