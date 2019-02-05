var loadXpra = function (xpraUrl, xpraPath, xpraConf) {
// disable right click menu:
    window.oncontextmenu = function(e) {
        //showCustomMenu();
        return false;
    }

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
        this.server_resize_exact = false;
        this.server_screen_sizes = [];
        this.server_is_desktop = false;
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
        if (isNaN(mx) || isNaN(my)) {
            if (!isNaN(this.last_mouse_x) && !isNaN(this.last_mouse_y)) {
                mx = this.last_mouse_x;
                my = this.last_mouse_y
            } else {
                mx = 0;
                my = 0
            }
        } else {
            this.last_mouse_x = mx;
            this.last_mouse_y = my
        }
        var mbutton = 0;
        if ("which" in e) mbutton = Math.max(0, e.which); else if ("button" in e) mbutton = Math.max(0, e.button) + 1;
        if (window && this.server_is_desktop) {
            var pos = jQuery(window.div).position();
            mx -= pos.left;
            my -= pos.top
        }


        var offset = $("#emulator-container").offset();
        mx = mx - offset.left;
        my = my - offset.top;

        return {x: mx, y: my, button: mbutton}
    };

    function init_client() {

        if (typeof jQuery == 'undefined') {
            window.alert("Incomplete Xpra HTML5 client installation: jQuery is missing, cannot continue.");
            return;
        }
        var getparam = Utilities.getparam;
        var getboolparam = Utilities.getboolparam;
        // look at url parameters
        var username = getparam("username") || null;
        var password = getparam("password") || null;
        var sound = true;
        if (Utilities.isChrome()) {
            // var audio_codec = getparam("audio_codec") || "http-stream:mp3";
            var audio_codec = getparam("audio_codec") || "mediasource:opus+mka";
        } else if (Utilities.isSafari()) {
            var audio_codec = getparam("audio_codec") || "legacy:wav";
        } else if (Utilities.isFirefox())
            var audio_codec = getparam("audio_codec") || "legacy:wav"; //temporary
        else
            var audio_codec = null;
        var encoding = "png";
        var bandwidth_limit = getparam("bandwidth_limit") || 0;
        var action = getparam("action") || "connect";
        var submit = getboolparam("submit", true);
        var server = xpraUrl.substring(7, xpraUrl.length);
        var port = "";
        var path = "";
        var encryption = getboolparam("encryption", false);
        var key = getparam("key") || null;
        var keyboard_layout = getparam("keyboard_layout") || null;
        var start = getparam("start");
        var exit_with_children = getboolparam("exit_with_children", true);
        var exit_with_client = getboolparam("exit_with_client", true);
        var sharing = getboolparam("sharing", false);
        var video = getboolparam("video", false);
        var mediasource_video = getboolparam("mediasource_video", false);
        var remote_logging = getboolparam("remote_logging", true);
        var debug = getboolparam("debug", false);
        var insecure = getboolparam("insecure", false);
        var ignore_audio_blacklist = getboolparam("ignore_audio_blacklist", false);
        var clipboard = getboolparam("clipboard", true);
        var printing = getboolparam("printing", false);
        var file_transfer = getboolparam("file_transfer", false);
        var steal = getboolparam("steal", true);
        var reconnect = getboolparam("reconnect", false);
        var swap_keys = getboolparam("swap_keys", Utilities.isMacOS());
        //delete sensitive session params:
        try {
            sessionStorage.removeItem("password");
        }
        catch (e) {
            //ignore
        }


        var progress_timer = null;
        var progress_value = 0;
        var progress_offset = 0;
        // show connection progress:
        // function connection_progress(state, details, progress) {
        //     clog("connection_progress(", state, ", ", details, ", ", progress, ")");
        //     if (progress>=100) {
        //         $('#progress').hide();
        //     }
        //     else {
        //         $('#progress').show();
        //     }
        //     $('#progress-label').text(state || " ");
        //     $('#progress-details').text(details || " ");
        //     $('#progress-bar').val(progress);
        //     progress_value = progress;
        //     if (progress_timer) {
        //         window.clearTimeout(progress_timer);
        //         progress_timer = null;
        //     }
        //     if (progress<100) {
        //         progress_move_offset();
        //     }
        // }
        // the offset is just to make the user feel better
        // nothing changes, but we just show a slow progress
        function progress_move_offset() {
            // progress_timer = null;
            // progress_offset++;
            // $('#progress-bar').val(progress_value + progress_offset);
            // if (progress_offset<9) {
            //     progress_timer = window.setTimeout(progress_move_offset, (5+progress_offset)*progress_offset);
            // }
        }

        // create the client
        var client = new XpraClient('emulator-container');
        client.div = 'emulator-container';
        client.steal = false;
        client.debug = function () {

        };
        client.remote_logging = remote_logging;
        client.sharing = sharing;
        client.insecure = insecure;
        client.clipboard_enabled = clipboard;
        client.printing = printing;
        client.file_transfer = file_transfer;
        client.bandwidth_limit = bandwidth_limit;
        client.steal = steal;
        client.reconnect = reconnect;
        client.swap_keys = swap_keys;
        // client.on_connection_progress = connection_progress;
        //example overrides:
        //client.HELLO_TIMEOUT = 3600000;
        //client.PING_TIMEOUT = 60000;
        //client.PING_GRACE = 30000;
        //client.PING_FREQUENCY = 15000;

        if (debug) {
            //example of client event hooks:
            client.on_open = function() {
                cdebug("connection open");
            };
            client.on_connect = function() {
                cdebug("connection established");
            };
            client.on_first_ui_event = function() {
                cdebug("first ui event");
            };
            client.on_last_window = function() {
                cdebug("last window disappeared");
            };
        }

        // mediasource video
        if(video) {
            client.supported_encodings.push("h264");
            if(mediasource_video) {
                client.supported_encodings.push("vp8+webm", "h264+mp4", "mpeg4+mp4");
            }
        }
        else if(encoding && (encoding !== "auto")) {
            // the primary encoding can be set
            client.enable_encoding(encoding);
        }
        // encodings can be disabled like so
        // client.disable_encoding("h264");
        if(action && (action!="connect")) {
            sns = {
                "mode" 	: action,
            };
            if(start) {
                sns["start"] = [start];
            }
            if (exit_with_children) {
                sns["exit-with-children"] = true;
            }
            if (exit_with_client) {
                sns["exit-with-client"] = true;
            }
            client.start_new_session = sns
        }

        // sound support
        if(sound) {
            client.audio_enabled = true;
            clog("sound enabled, audio codec string: "+audio_codec);
            if(audio_codec && audio_codec.indexOf(":")>0) {
                var acparts = audio_codec.split(":");
                client.audio_framework = acparts[0];
                client.audio_codec = acparts[1];
            }
            client.audio_mediasource_enabled = getboolparam("mediasource", true);
            client.audio_aurora_enabled = getboolparam("aurora", true);
            client.audio_httpstream_enabled =  true;
        }

        if(keyboard_layout) {
            client.keyboard_layout = keyboard_layout;
        }

        // check for username and password
        if(username) {
            client.username = username;
        }
        if(password) {
            client.password = password;
        }

        // check for encryption parameters
        if(encryption) {
            client.encryption = encryption;
            if(key) {
                client.encryption_key = key;
            }
        }

        // attach a callback for when client closes
        if(!debug) {
            client.callback_close = function(reason) {
                if(submit) {
                    var message = "Connection closed (socket closed)";
                    if(reason) {
                        message = reason;
                    }
                    function add_prop(prop, value) {
                        if (typeof(Storage) !== "undefined") {
                            if (value===null || value==="undefined") {
                                sessionStorage.removeItem(prop);
                            }
                            else {
                                sessionStorage.setItem(prop, value);
                            }
                        }
                    }
                    add_prop("disconnect", message);
                    var props = {
                        "username"			: username,
                        "insecure"			: insecure,
                        "server"			: server,
                        "port"				: port,
                        "encoding"			: encoding,
                        "bandwidth_limit"	: bandwidth_limit,
                        "keyboard_layout"	: keyboard_layout,
                        "action"			: action,
                        "sound"				: sound,
                        "audio_codec"		: audio_codec,
                        "clipboard"			: clipboard,
                        "exit_with_children": exit_with_children,
                        "exit_with_client"	: exit_with_client,
                        "sharing"			: sharing,
                        "steal"				: steal,
                        "video"				: video,
                        "mediasource_video"	: mediasource_video,
                        "debug"				: debug,
                        "remote_logging"	: remote_logging,
                        "insecure"			: insecure,
                        "ignore_audio_blacklist" : ignore_audio_blacklist,
                    }
                    if (insecure || sessionStorage) {
                        props["password"] = password;
                    }
                    else {
                        props["password"] = "";
                    }
                    for (var name in props) {
                        var value = props[name];
                        add_prop(name, value);
                    }
                }
            }
        }
        client.init(ignore_audio_blacklist);

        var ssl = document.location.protocol=="https:";
        client.host = server;
        client.port = port;
        client.ssl = ssl;
        client.path = path;
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
                client.send(["suspend", true, window_ids]);
            }
            else {
                client.send(["resume", true, window_ids]);
                client.redraw_windows();
                client.request_refresh(-1);
            }
        });



        /**
         * Client PATCH
         */

        client.connect = function() {
            var details = this.host + ":" + this.port;
            if (this.path) {
                details += "/"+this.path;
            }
            if (this.ssl) {
                details += " with ssl";
            }
            this.on_connection_progress("Connecting to server", details, 40);
            // open the web socket, started it in a worker if available
            // check we have enough information for encryption
            if(this.encryption) {
                if((!this.encryption_key) || (this.encryption_key == "")) {
                    this.callback_close("no key specified for encryption");
                    return;
                }
            }
            // detect websocket in webworker support and degrade gracefully
            if(window.Worker) {
                console.log("we have webworker support");
                // spawn worker that checks for a websocket
                var me = this;
                var worker = new Worker(xpraPath + 'js/lib/wsworker_check.js');

                worker.addEventListener('message', function(e) {
                    var data = e.data;
                    switch (data['result']) {
                        case true:
                            // yey, we can use websocket in worker!
                            console.log("we can use websocket in webworker");
                            me._do_connect(true);
                            break;
                        case false:
                            console.log("we can't use websocket in webworker, won't use webworkers");
                            me._do_connect(false);
                            break;
                        default:
                            console.log("client got unknown message from worker");
                            me._do_connect(false);
                    };
                }, false);
                // ask the worker to check for websocket support, when we receive a reply
                // through the eventlistener above, _do_connect() will finish the job
                worker.postMessage({'cmd': 'check'});
            } else {
                // no webworker support
                console.log("no webworker support at all.")
                me._do_connect(false);
            }
        };

        client._sound_start_httpstream = function() {
            this.audio = document.createElement("audio");
            this.audio.setAttribute('autoplay', true);
            this.audio.setAttribute('controls', false);
            this.audio.setAttribute('loop', true);
            var url = "http";
            if (this.ssl) {
                url = "https";
            }
            url += "://"+this.host
            // +":"+this.port
            ;
            if (this.path) {
                url += "/"+this.path;
            }
            url += "/audio.mp3?uuid="+this.uuid;
            this.log("starting http stream from", url);
            this.audio.src = url;
        }

        client._new_window = function(wid, x, y, w, h, metadata, override_redirect, client_properties) {
            // each window needs their own DIV that contains a canvas
            var mydiv = document.createElement("div");
            mydiv.id = String(wid);
            var mycanvas = document.createElement("canvas");
            mydiv.appendChild(mycanvas);
            var screen = document.getElementById("emulator-container");
            screen.appendChild(mydiv);
            // set initial sizes
            mycanvas.width = xpraConf.xpraWidth;
            mycanvas.height = xpraConf.xpraHeight;
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

        client.open_protocol = function() {
            // set protocol to deliver packets to our packet router
            this.protocol.set_packet_handler(this._route_packet, this);
            // make uri
            var uri = "ws://";
            if (this.ssl)
                uri = "wss://";
            uri += this.host;
            // uri += ":" + this.port;
            // if (this.path) {
            //     uri += "/"+this.path;
            // }
            // do open
            this.on_connection_progress("Opening WebSocket connection", uri, 60);
            this.protocol.open(uri);
        };




        client.connect(xpraPath);

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

        XpraProtocolWorkerHost.prototype.open = function(uri) {
            var me = this;
            if (this.worker) {
                //re-use the existing worker:
                this.worker.postMessage({'c': 'o', 'u': uri});
                return;
            }
            this.worker = new Worker(xpraPath + 'eaas-xpra-worker.js');
            this.worker.addEventListener('message', function(e) {
                var data = e.data;
                switch (data.c) {
                    case 'r':
                        me.worker.postMessage({'c': 'o', 'u': uri});
                        break;
                    case 'p':
                        if(me.packet_handler) {
                            me.packet_handler(data.p, me.packet_ctx);
                        }
                        break;
                    case 'l':
                        console.log(data.t);
                        break;
                    default:
                        console.error("got unknown command from worker");
                        console.error(e.data);
                };
            }, false);
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




    MediaSourceUtil.getMediaSourceAudioCodecs = function(ignore_blacklist) {
        var media_source_class = MediaSourceUtil.getMediaSourceClass();
        if(!media_source_class) {
            Utilities.log("audio forwarding: no media source API support");
            return [];
        }
        //IE is totally useless:
        if(Utilities.isIE()) {
            return [];
        }
        var codecs_supported = [];
        for (var codec_option in MediaSourceConstants.CODEC_STRING) {
            var codec_string = MediaSourceConstants.CODEC_STRING[codec_option];
            try {
                // if(!media_source_class.isTypeSupported(codec_string)) {
                //     Utilities.log("audio codec MediaSource NOK: '"+codec_option+"' / '"+codec_string+"'");
                //     //add whitelisting here?
                //     continue;
                // }
                var blacklist = ["wav", "wave"];
                if (Utilities.isFirefox()) {
                    blacklist += [
                        // "opus+mka",
                        // "vorbis+mka",//,
                        // "aac+mpeg4"
                        // "mp3+mpeg4"
                    ];
                }
                else if (Utilities.isSafari()) {
                    //this crashes Safari!
                    blacklist += [
                        "aac+mpeg4"
                        // "opus+mka",
                        // "vorbis+mka",
                        // "mp3+mpeg4"
                    ];
                }

                else
                if (Utilities.isChrome()) {
                    blacklist += ["aac+mpeg4"];
                }
                if(blacklist.indexOf(codec_option)>=0) {
                    Utilities.log("audio codec MediaSource '"+codec_option+"' / '"+codec_string+"' is blacklisted for "+navigator.userAgent);
                    if(ignore_blacklist) {
                        Utilities.log("blacklist overruled!");
                    }
                    else {
                        continue;
                    }
                }
                codecs_supported[codec_option] = codec_string;
                Utilities.log("audio codec MediaSource OK  '"+codec_option+"' / '"+codec_string+"'");
            }
            catch (e) {
                Utilities.error("audio error probing codec '"+codec_string+"' / '"+codec_string+"': "+e);
            }
        }
        Utilities.log("getMediaSourceAudioCodecs(", ignore_blacklist, ")=", codecs_supported);
        return codecs_supported;
    }
};
