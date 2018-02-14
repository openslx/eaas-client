var loadXpra = function (xpraUrl, xpraPath, xpraConf) {
    if (!window.location.getParameter) {
        window.location.getParameter = function (key) {
            function parseParams() {
                var params1 = {},
                    e,
                    a = /\+/g,	// Regex for replacing addition symbol with a space
                    r = /([^&=]+)=?([^&]*)/g,
                    d = function (s) {
                        return decodeURIComponent(s.replace(a, " "));
                    },
                    q = window.location.search.substring(1);

                while (e = r.exec(q))
                    params1[d(e[1])] = d(e[2]);

                return params1;
            }

            if (!this.queryStringParams)
                this.queryStringParams = parseParams();

            return this.queryStringParams[key];
        };
    }

    // disable right click menu:
    window.oncontextmenu = function (e) {
        //showCustomMenu();
        return false;
    }

    function getparam(name) {
        return window.location.getParameter(name);
    }

    function getboolparam(name, default_value) {
        var v = window.location.getParameter(name);
        if (v == null) {
            return default_value;
        }
        return ["true", "on", "1"].indexOf(String(v).toLowerCase()) >= 0;
    }

    function encodeData(s) {
        return encodeURIComponent(s);
    }
    $(document).ready(function () {
        // look at url parameters
        var username = getparam("username") || null;
        var password = getparam("password") || null;
        var sound = getparam("sound") || "true";
        var audio_codec = getparam("audio_codec") || "opus+mka";
        var encoding = getparam("encoding") || null;
        var action = getparam("action") || "connect";
        var submit = getparam("submit") || null;
        var server = xpraUrl.substring(7, xpraUrl.indexOf("8080") - 1);
        var port = xpraUrl.substring(xpraUrl.indexOf("8080"));
        var encryption = getparam("encryption") || null;
        var key = getparam("key") || null;
        var keyboard_layout = getparam("keyboard_layout") || null;
        var start = getparam("start");
        var exit_with_children = getparam("exit_with_children") || "";
        var exit_with_client = getparam("exit_with_client") || "";
        var sharing = getboolparam("sharing", false);
        var video = getboolparam("video", false);
        var mediasource_video = getboolparam("mediasource_video", false);
        var normal_fullscreen = getboolparam("normal_fullscreen", false);
        var remote_logging = getboolparam("remote_logging", true);
        // var debug = getboolparam("debug", true);
        var debug = getboolparam("debug", false);
        var insecure = getboolparam("insecure", false);
        var ignore_audio_blacklist = getboolparam("ignore_audio_blacklist", false);
        var clipboard = getboolparam("clipboard", true);

        // console.log("ignore_audio_blacklist");
        // console.log(ignore_audio_blacklist);
        // create the client
        var client = new XpraClient('emulator-container');

        client.debug = debug;
        client.remote_logging = remote_logging;
        client.sharing = sharing;
        client.insecure = insecure;
        client.clipboard_enabled = clipboard;
        // mediasource video
        if (video) {
            client.supported_encodings.push("h264");
            if (mediasource_video) {
                client.supported_encodings.push("vp8+webm", "h264+mp4", "mpeg4+mp4");
            }
        }

        // encodings can be disabled like so
        for (i = 0; i < xpraConf.xpraRestrictedEncodings.length; i++) {
            client.disable_encoding(xpraConf.xpraRestrictedEncodings[i]);
        }

        if (action && (action != "connect")) {
            sns = {
                "mode": action,
            };
            if (start) {
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

        // see if we should undecorate and maximise normal windows
        if (normal_fullscreen) {
            client.normal_fullscreen_mode = true;
        }

        // sound support
        if (sound) {
            client.audio_enabled = true;
            console.log("sound enabled, audio codec string: " + audio_codec);
            if (audio_codec && audio_codec.indexOf(":") > 0) {
                var acparts = audio_codec.split(":");

                client.audio_framework = acparts[0];
                client.audio_codec = acparts[1];
            }
            client.audio_mediasource_enabled = getboolparam("mediasource", true);
            client.audio_aurora_enabled = getboolparam("aurora", true);
        }

        if (keyboard_layout) {
            client.keyboard_layout = keyboard_layout;
        }

        // check for username and password
        if (username) {
            client.username = username;
        }
        if (password) {
            client.authentication_key = password;
        }

        // check for encryption parameters
        if (encryption) {
            client.encryption = encryption;
            if (key) {
                client.encryption_key = key;
            }
        }

        client.init(ignore_audio_blacklist);

        // and connect
        var ssl = document.location.protocol == "https:";


        /**
         * Patch
         */
        /**
         * Protocol
         * @param with_worker
         * @private
         */
        XpraClient.prototype._do_connect = function (with_worker) {
            if (with_worker && !(XPRA_CLIENT_FORCE_NO_WORKER)) {
                this.protocol = new XpraProtocolWorkerHost();
            } else {
                this.protocol = new XpraProtocol();
            }
            // set protocol to deliver packets to our packet router
            this.protocol.set_packet_handler(this._route_packet, this);
            // make uri
            var uri = "ws://";
            if (this.ssl)
                uri = "wss://";
            uri += this.host;
            uri += ":" + this.port;
            // do open
            this.protocol.open = function (uri) {
                var me = this;
                this.worker = new Worker(xpraPath + '/js/Protocol.js');
                this.worker.addEventListener('message', function (e) {
                    var data = e.data;
                    switch (data.c) {
                        case 'r':
                            me.worker.postMessage({'c': 'o', 'u': uri});
                            break;
                        case 'p':
                            if (me.packet_handler) {
                                me.packet_handler(data.p, me.packet_ctx);
                            }
                            break;
                        case 'l':
                            console.log(data.t);
                            break;
                        default:
                            console.error("got unknown command from worker");
                            console.error(e.data);
                    }
                    ;
                }, false);
            };
            this.protocol.open(uri);
            // wait timeout seconds for a hello, then bomb
            var me = this;
            this.hello_timer = setTimeout(function () {
                me.disconnect_reason = "Did not receive hello before timeout reached, not an Xpra server?";
                me.close();
            }, this.HELLO_TIMEOUT);
        }

        XpraClient.prototype._get_desktop_size = function () {
            return [xpraConf.xpraWidth, xpraConf.xpraHeight];
        }

        XpraClient.prototype._get_DPI = function () {
            return xpraConf.xpraDPI;
        }
        /**
         * Connect
         * @type {XpraClient.connect}
         */
        client.connect = XpraClient.prototype.connect = function (host, port, ssl) {
            // open the web socket, started it in a worker if available
            console.log("connecting to xpra server " + host + ":" + port + " with ssl: " + ssl);
            this.host = host;
            this.port = port;
            this.ssl = ssl;
            // check we have enough information for encryption
            if (this.encryption) {
                if ((!this.encryption_key) || (this.encryption_key == "")) {
                    this.callback_close("no key specified for encryption");
                    return;
                }
            }
            // detect websocket in webworker support and degrade gracefully
            if (window.Worker) {
                console.log("we have webworker support");
                // spawn worker that checks for a websocket
                var me = this;
                var worker = new Worker(xpraPath + '/js/lib/wsworker_check.js');
                worker.addEventListener('message', function (e) {
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
                    }
                    ;
                }, false);
                // ask the worker to check for websocket support, when we receive a reply
                // through the eventlistener above, _do_connect() will finish the job
                worker.postMessage({'cmd': 'check'});
            } else {
                // no webworker support
                console.log("no webworker support at all.")
            }
        };

        client._new_window = function (wid, x, y, w, h, metadata, override_redirect, client_properties) {
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
            // create the XpraWindow object to own the new div
            var win = new XpraWindow(this, mycanvas, wid, x, y, w, h,
                metadata,
                override_redirect,
                client_properties,
                this._window_geometry_changed,
                this._window_mouse_move,
                this._window_mouse_click,
                this._window_set_focus,
                this._window_closed
            );
            win.debug = this.debug;
            // win.set_maximized(true);
            this.id_to_window[wid] = win;
            if (!override_redirect) {
                if (this.normal_fullscreen_mode) {
                    if (win.windowtype == "NORMAL") {
                        win.undecorate();
                        win.set_maximized(true);
                    }
                }
                var geom = win.get_internal_geometry();
                this.protocol.send(["map-window", wid, geom.x, geom.y, geom.w, geom.h, this._get_client_properties(win)]);
                this._window_set_focus(win);
            }
            win.undecorate();

            win.ensure_visible();

            win.fill_screen();

            win.set_maximized(true);


        }

        XpraWindow.prototype.getMouse = function(e) {
            // get mouse position take into account scroll
            var mx = e.clientX + jQuery(document).scrollLeft();
            var my = e.clientY + jQuery(document).scrollTop();

            // check last mouse position incase the event
            // hasn't provided it - bug #854
            if(isNaN(mx) || isNaN(my)) {
                if(!isNaN(this.last_mouse_x) && !isNaN(this.last_mouse_y)) {
                    mx = this.last_mouse_x;
                    my = this.last_mouse_y;
                } else {
                    // should we avoid sending NaN to the server?
                    mx = 0;
                    my = 0;
                }
            } else {
                this.last_mouse_x = mx;
                this.last_mouse_y = my;
            }

            var mbutton = 0;
            if ("which" in e)  // Gecko (Firefox), WebKit (Safari/Chrome) & Opera
                mbutton = Math.max(0, e.which);
            else if ("button" in e)  // IE, Opera (zero based)
                mbutton = Math.max(0, e.button)+1;
            //show("getmouse: button="+mbutton+", which="+e.which+", button="+e.button);

            // We return a simple javascript object (a hash) with x and y defined
            var offset = $("#emulator-container").offset();
            mx = mx - offset.left;
            my = my - offset.top;
            return {x: mx, y: my, button: mbutton};
        };
        /**
         * end of the patch
         */

        client.connect(server, port, ssl);

        if (clipboard) {
            //clipboard hooks:
            var pasteboard = $('#pasteboard');
            pasteboard.on('paste', function (e) {
                var paste_data = (e.originalEvent || e).clipboardData.getData('text/plain');
                client.send_clipboard_token(unescape(encodeURIComponent(paste_data)));
                return false;
            });
            pasteboard.on('copy', function (e) {
                var clipboard_buffer = client.get_clipboard_buffer();
                $('#pasteboard').text(decodeURIComponent(escape(clipboard_buffer)));
                $('#pasteboard').select();
                client.clipboard_pending = false;
                return true;
            });
            pasteboard.on('cut', function (e) {
                var clipboard_buffer = client.get_clipboard_buffer();
                $('#pasteboard').text(decodeURIComponent(escape(clipboard_buffer)));
                $('#pasteboard').select();
                client.clipboard_pending = false;
                return true;
            });
            $('#emulator-container').on('click', function (e) {
                //console.log("click pending=", client.clipboard_pending, "buffer=", client.clipboard_buffer);
                if (client.clipboard_pending) {
                    var clipboard_buffer = client.get_clipboard_buffer();
                    $('#pasteboard').text(client.clipboard_buffer);
                    $('#pasteboard').select();
                    //for IE:
                    var success = true;
                    if (window.clipboardData && window.clipboardData.setData) {
                        clipboardData.setData("Text", this.clipboard_buffer);
                    }
                    else {
                        success = document.execCommand('copy');
                        //console.log("copy success=", success);
                    }
                    if (success) {
                        client.clipboard_pending = false;
                    }
                }
            });
        }
    });
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
                if(!media_source_class.isTypeSupported(codec_string)) {
                    Utilities.log("audio codec MediaSource NOK: '"+codec_option+"' / '"+codec_string+"'");
                    //add whitelisting here?
                    continue;
                }
                var blacklist = ["wav", "wave", "flac+ogg"];
                if (Utilities.isFirefox()) {
                    blacklist += [//"opus+mka",
                        "vorbis+mka"//,
                        // "aac+mpeg4",
                        // "mp3+mpeg4"
                    ];
                }
                else if (Utilities.isSafari()) {
                    //this crashes Safari!
                    blacklist += ["aac+mpeg4"];
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
