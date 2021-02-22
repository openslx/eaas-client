var loadXpra = function (xpraUrl, xpraPath, xpraConf, eaasClientObj) {

{
    // HACK: eaas-client might pass wrong URL
    const xpraUrl2 = new URL(xpraUrl, location);
    xpraUrl2.protocol = xpraUrl2.protocol.replace(/^http/, "ws");
    if (location.protocol == "https:") xpraUrl2.protocol = "wss";
    xpraUrl = String(xpraUrl2);
}

// disable right click menu:
    window.oncontextmenu = function(e) {
        //showCustomMenu();
        return false;
    }
    this.xpraConf = xpraConf;
    var cdebug = console.debug;
    var clog = console.log;

    XpraClient.prototype.init_state = function (container) {
        this.desktop_width = 0;
        this.desktop_height = 0;
        this.server_remote_logging = false;
        this.capabilities = {};
        this.RGB_FORMATS = ["RGBX", "RGBA"];
        this.disconnect_reason = null;
        this.audio_enabled = false;
        this.audio_mediasource_enabled = MediaSourceUtil.getMediaSourceClass() != null;
        this.audio_aurora_enabled = typeof AV !== "undefined" && AV != null && AV.Decoder != null && AV.Player.fromXpraSource != null;
        this.audio_httpstream_enabled = true;
        this.audio_codecs = {};
        this.audio_framework = null;
        this.audio_aurora_ctx = null;
        this.audio_codec = null;
        this.audio_context = Utilities.getAudioContext();
        this.aurora_codecs = {};
        this.mediasource_codecs = {};
        this.encryption = false;
        this.encryption_key = null;
        this.cipher_in_caps = null;
        this.cipher_out_caps = null;
        this.browser_language = Utilities.getFirstBrowserLanguage();
        this.browser_language_change_embargo_time = 0;
        this.key_layout = null;
        this.mousedown_event = null;
        this.last_mouse_x = null;
        this.last_mouse_y = null;
        this.wheel_delta_x = 0;
        this.wheel_delta_y = 0;
        this.clipboard_buffer = "";
        this.clipboard_pending = false;
        this.clipboard_targets = ["UTF8_STRING", "TEXT", "STRING", "text/plain"];
        this.remote_printing = false;
        this.remote_file_transfer = false;
        this.remote_open_files = false;
        this.hello_timer = null;
        this.ping_timeout_timer = null;
        this.ping_grace_timer = null;
        this.ping_timer = null;
        this.last_ping_server_time = 0;
        this.last_ping_local_time = 0;
        this.last_ping_echoed_time = 0;
        this.server_ok = false;
        this.queue_draw_packets = false;
        this.dQ = [];
        this.dQ_interval_id = null;
        this.process_interval = 0;
        this.server_resize_exact = true;
        this.server_screen_sizes = [];
        this.server_is_desktop = true;
        this.server_connection_data = false;
        this.id_to_window = {};
        this.ui_events = 0;
        this.pending_redraw = [];
        this.draw_pending = 0;
        this.topwindow = null;
        this.topindex = 0;
        this.focus = -1;
        jQuery("#emulator-container").mousedown(function (e) {
            me.on_mousedown(e)
        });
        jQuery("#emulator-container").mouseup(function (e) {
            me.on_mouseup(e)
        });
        jQuery("#emulator-container").mousemove(function (e) {
            me.on_mousemove(e)
        });
        var me = this;
        var div = document.getElementById("emulator-container");

        function on_mousescroll(e) {
            me.on_mousescroll(e)
        }

        if (Utilities.isEventSupported("wheel")) {
            div.addEventListener("wheel", on_mousescroll, false)
        } else if (Utilities.isEventSupported("mousewheel")) {
            div.addEventListener("mousewheel", on_mousescroll, false)
        } else if (Utilities.isEventSupported("DOMMouseScroll")) {
            div.addEventListener("DOMMouseScroll", on_mousescroll, false)
        }
    };

    XpraClient.prototype.getMouse = function (e, window) {
        var mx = e.clientX + jQuery(document).scrollLeft();
        var my = e.clientY + jQuery(document).scrollTop();
        // if (isNaN(mx) || isNaN(my)) {
        //     if (!isNaN(this.last_mouse_x) && !isNaN(this.last_mouse_y)) {
        //         mx = this.last_mouse_x;
        //         my = this.last_mouse_y
        //     } else {
        //         mx = 0;
        //         my = 0
        //     }
        // } else {
        //     this.last_mouse_x = mx;
        //     this.last_mouse_y = my
        // }
        var mbutton = 0;
        if ("which" in e) mbutton = Math.max(0, e.which); else if ("button" in e) mbutton = Math.max(0, e.button) + 1;
        // if (window && this.server_is_desktop) {
        //     var pos = jQuery(window.div).position();
        //     mx -= pos.left;
        //     my -= pos.top
        // }


        var offset = $("#emulator-container").offset();
        mx = mx - offset.left;
        my = my - offset.top;

        return {x: mx, y: my, button: mbutton}
    };

    function init_client() {
        const { encoding } = this.xpraConf;

        var client = new XpraClient('emulator-container');
        client.div = 'emulator-container';
        client.debug = () => {};
        client.remote_logging = true;
        client.clipboard_enabled = true;
        client.bandwidth_limit = 0;
        client.steal = true;
        client.swap_keys = Utilities.isMacOS();
        client.audio_enabled = false;
        if (encoding) client.enable_encoding(encoding);

        const ignore_audio_blacklist = false;
        client.init(ignore_audio_blacklist);

        const xpraUrl2 = new URL(xpraUrl, location);
        client.ssl = xpraUrl2.protocol === "wss:";
        client.host = xpraUrl2.hostname;
        client.port = xpraUrl2.port;
        client.path = xpraUrl2.pathname;
        return client;
    }

    function init_tablet_input(client) {
        //keyboard input for tablets:
        var pasteboard = $('#pasteboard');
        pasteboard.on("input", function(e) {
            var txt = pasteboard.val();
            pasteboard.val("");
            cdebug("oninput:", txt);
            if (!client.topwindow) {
                return;
            }
            for (var i = 0, len = txt.length; i < len; i++) {
                var str = txt[i];
                var keycode = str.charCodeAt(0);
                try {
                    modifiers = [];
                    keyval = keycode;
                    group = 0;
                    packet = ["key-action", client.topwindow, str, true, modifiers, keyval, str, keycode, group];
                    cdebug(packet);
                    client.send(packet);
                    packet = ["key-action", client.topwindow, str, false, modifiers, keyval, str, keycode, group];
                    cdebug(packet);
                    client.send(packet);
                }
                catch (e) {
                    client.error("input handling error: "+e);
                }
            }
        });
    }

    function init_clipboard(client) {
        var pasteboard = $('#pasteboard');
        //clipboard hooks:
        pasteboard.on('paste', function (e) {
            var paste_data = (e.originalEvent || e).clipboardData.getData('text/plain');
            cdebug("paste event, data=", paste_data);
            client.send_clipboard_token(unescape(encodeURIComponent(paste_data)));
            return false;
        });
        pasteboard.on('copy', function (e) {
            var clipboard_buffer = client.get_clipboard_buffer();
            pasteboard.text(decodeURIComponent(escape(clipboard_buffer)));
            pasteboard.select();
            cdebug("copy event, clipboard buffer=", clipboard_buffer);
            client.clipboard_pending = false;
            return true;
        });
        pasteboard.on('cut', function (e) {
            var clipboard_buffer = client.get_clipboard_buffer();
            pasteboard.text(decodeURIComponent(escape(clipboard_buffer)));
            pasteboard.select();
            cdebug("cut event, clipboard buffer=", clipboard_buffer);
            client.clipboard_pending = false;
            return true;
        });
        $('#emulator-container').on('click', function (e) {
            //clog("click pending=", client.clipboard_pending, "buffer=", client.clipboard_buffer);
            if (client.clipboard_pending) {
                var clipboard_buffer = client.get_clipboard_buffer();
                pasteboard.text(clipboard_buffer);
                pasteboard.select();
                cdebug("click event, with pending clipboard buffer=", clipboard_buffer);
                //for IE:
                var success = true;
                if (window.clipboardData && window.clipboardData.setData) {
                    clipboardData.setData("Text", this.clipboard_buffer);
                }
                else {
                    success = document.execCommand('copy');
                    //clog("copy success=", success);
                }
                if (success) {
                    client.clipboard_pending = false;
                }
            }
        });
    }

    function init_file_transfer(client) {
        function send_file(f) {
            clog("file:", f.name, ", type:", f.type, ", size:", f.size, "last modified:", f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a');
            var fileReader = new FileReader();
            fileReader.onloadend = function (evt) {
                var u8a = new Uint8Array(evt.target.result);
                var buf = Utilities.Uint8ToString(u8a);
                client.send_file(f.name, f.type, f.size, buf);
            };
            fileReader.readAsArrayBuffer(f);
        }
        function handleFileSelect(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            var files = evt.dataTransfer.files;
            for (var i = 0, f; f = files[i]; i++) {
                send_file(f);
            }
        }
        function handleDragOver(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            evt.dataTransfer.dropEffect = 'copy';
        }
        var screen = document.getElementById('emulator-container');
        screen.addEventListener('dragover', handleDragOver, false);
        screen.addEventListener('drop', handleFileSelect, false);
    }

    $(document).ready(function() {
        var client = init_client();
        clog = function() {
            client.log.apply(client, arguments);
        }
        cdebug = function() {
            client.debug.apply(client, arguments);
        }
        client.on_audio_state_change = function(newstate, details) {
            var tooltip = "";
            var image_name = "";
            if (newstate=="playing") {
                image_name = "speaker.png";
                tooltip = details || "playing";
            }
            else if (newstate=="waiting") {
                image_name = "speaker-buffering.png";
                tooltip = details || "buffering";
            }
            else {
                image_name = "speaker-off.png";
                tooltip = details || "off";
            }
            clog("audio-state:", newstate);
            $("#speaker_icon").attr("src", "./icons/"+image_name);
            $("#speaker_icon").attr("title", tooltip);
        };
        document.addEventListener("visibilitychange", function (e) {
            window_ids = Object.keys(client.id_to_window).map(Number);
            clog("visibilitychange hidden=", document.hidden);
            if (document.hidden) {
                // client.send(["suspend", true, window_ids]);
            }
            else {
                client.send(["resume", true, window_ids]);
                client.redraw_windows();
                client.request_refresh(-1);
            }
        }
        );



        /**
         * Client PATCH (methods overrides)
         */
        client._new_window = function(wid, x, y, w, h, metadata, override_redirect, client_properties) {
            // each window needs their own DIV that contains a canvas
            var mydiv = document.createElement("div");
            mydiv.id = String(wid);
            var mycanvas = document.createElement("canvas");
            mydiv.appendChild(mycanvas);
            var screen = document.getElementById("emulator-container");
            screen.appendChild(mydiv);
            // set initial sizes
            mycanvas.width = w;
            mycanvas.height = h;
            // eaas: top left corner of the canvas
            x = 0;
            y = 0;
            // create the XpraWindow object to own the new div

            var win = new XpraWindow(this, mycanvas, wid, x, y, w, h, metadata, override_redirect, false, client_properties, client._window_geometry_changed, client._window_mouse_move, client._window_mouse_down, client._window_mouse_up, client._window_mouse_scroll, client._window_set_focus, client._window_closed);
            client.id_to_window[wid] = win;

            win.debug = this.debug;
            win._set_decorated(false);
            win.updateCSSGeometry();
            this.id_to_window[wid] = win;
            if (!override_redirect) {
                var geom = win.get_internal_geometry();
                client.send(["map-window", wid, geom.x, geom.y, geom.w, geom.h, this._get_client_properties(win)]);
                client._window_set_focus(win);
            }
        };

        client.connect(xpraPath);
        eaasClientObj.xpraClient = client;


        //from now on, send log and debug to client function
        //which may forward it to the server once connected:
        clog = function() {
            client.log.apply(client, arguments);
        };
        cdebug = function() {
            client._debug.apply(client, arguments);
        }
        init_tablet_input(client);
        if (client.clipboard_enabled) {
            init_clipboard(client);
        }
        if (client.file_transfer) {
            init_file_transfer(client);
        }

        XpraWindow.prototype.update_zindex = function() {
            jQuery(this.div).css('z-index', 1000);
        }
    });

    XpraClient.prototype.init_keyboard = function() {
        var me = this;
        // modifier keys:
        this.caps_lock = null;
        this.num_lock = true;
        this.num_lock_mod = null;
        this.alt_modifier = null;
        this.meta_modifier = null;
        // assign the keypress callbacks
        // if we detect jQuery, use that to assign them instead
        // to allow multiple clients on the same page
        document.addEventListener('keydown', function(e) {
            if ($('#emulator-container').is(":visible")) {
                var r = me._keyb_onkeydown(e, me);
                if (!r) {
                    e.preventDefault();
                }
            }
        });
        document.addEventListener('keyup', function (e) {
            if ($('#emulator-container').is(":visible")) {
                var r = me._keyb_onkeyup(e, me);
                if (!r) {
                    e.preventDefault();
                }
            }
        });
        document.addEventListener('keypress', function (e) {
            if ($('#emulator-container').is(":visible")) {
                var r = me._keyb_onkeypress(e, me);
                if (!r) {
                    e.preventDefault();
                }
            }
        });

    };
};
