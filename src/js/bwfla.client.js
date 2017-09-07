var EaasClient = EaasClient || {};

/**
 * Determines the resolution
 */

EaasClient.Client = function (api_entrypoint, container) {

    xpraShapes = {
        xpraWidth: 1024,
        xpraHeight: 768,
        xpraDPI: 96
    };

    this.setXpraShapes = function (width, height, dpi) {
        xpraShapes = {
            xpraWidth: width,
            xpraHeight: height,
            xpraDPI: dpi
        };
    };

    var _this = this;
    var API_URL = api_entrypoint.replace(/([^:])(\/\/+)/g, '$1/').replace(/\/+$/, '');

    this.componentId = null;
    this.networkId = null;
    this.driveId = null;
    this.params = null;

    function formatStr(format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    }

    function strParamsToObject(str) {
        var result = {};
        if (!str) return result; // return on empty string

        str.split("&").forEach(function (part) {
            var item = part.split("=");
            result[item[0]] = decodeURIComponent(item[1]);
        });
        return result
    }


    var hasConnected = false;
    this.pollState = function (componentId) {
        $.get(API_URL + formatStr("/components/{0}/state", _this.componentId))

            .then(function (data, status, xhr) {
                if (!_this.guac) {

                    $.get(API_URL + formatStr("/components/{0}/controlurls", _this.componentId))
                        .then(function (data, status, xhr) {

                            /**
                             * XPRA Section
                             */

                            if (typeof data.xpra !== "undefined" > -1) {
                                console.log("my link" + data.xpra);
                                _this.keepaliveIntervalId = setInterval(_this.keepalive, 1000);
                                /**
                                 * Download dependencies and initialize Xpra session
                                 */
                                prepareAndLoadXpra(data.xpra);

                                hasConnected = true;

                                for (var i = 0; i < listeners.length; i++) {
                                    // don't call removed listeners..
                                    if (listeners[i]) {
                                        listeners[i]();
                                    }
                                }


                            } else {
                                /**
                                 * Guacamole Section
                                 */
                                _this.params = strParamsToObject(data.guacamole.substring(data.guacamole.indexOf("#") + 1));
                                _this.establishGuacamoleTunnel(data.guacamole);
                                _this.keepaliveIntervalId = setInterval(_this.keepalive, 1000);

                                // call onConnectListeners
                                hasConnected = true;

                                for (var i = 0; i < listeners.length; i++) {
                                    // don't call removed listeners..
                                    if (listeners[i]) {
                                        listeners[i]();
                                    }
                                }
                            }
                        });
                }
            }, function (xhr) {
                _this._onError($.parseJSON(xhr.responseText))
            })
    };

    var listeners = [];
    this.addOnConnectListener = function (callback) {
        // immediately execute callback when already connected
        console.log("hasConnected, after" + hasConnected);
        if (hasConnected) {
            callback();
            return {
                remove: function () {
                }
            }
        }

        var index = listeners.push(callback) - 1;

        // can be used to remove the listener
        return {
            remove: function () {
                delete listeners[index];
            }
        };
    };

    this._onError = function (msg) {
        if (this.keepaliveIntervalId)
            clearInterval(this.keepaliveIntervalId);
        if (this.guac)
            this.guac.disconnect();
        if (this.onError) {
            this.onError(msg || {"error": "No error message specified"});
        }
    };

    this._onResize = function (width, height) {
        container.style.width = width;
        container.style.height = height;

        if (this.onResize) {
            this.onResize(width, height);
        }
    };

    this.keepalive = function () {
        var url = null;
        if (_this.networkId != null) {
            url = formatStr("/networks/{0}/keepalive", _this.networkId);
        } else if (_this.componentId != null) {
            url = formatStr("/components/{0}/keepalive", _this.componentId);
        }

        $.post(API_URL + url);
    };

    this.establishGuacamoleTunnel = function (controlUrl) {
        window.onbeforeunload = function () {
            this.guac.disconnect();
        }.bind(this);

        $.fn.focusWithoutScrolling = function () {
            var x = window.scrollX, y = window.scrollY;
            this.focus();
            window.scrollTo(x, y);
            return this;
        };

        this.guac = new Guacamole.Client(new Guacamole.HTTPTunnel(controlUrl.split("#")[0]));
        var displayElement = this.guac.getDisplay().getElement();

        BWFLA.hideClientCursor(this.guac);
        container.insertBefore(displayElement, container.firstChild);

        BWFLA.registerEventCallback(this.guac.getDisplay(), 'resize', this._onResize.bind(this));
        this.guac.connect();

        var mouse = new Guacamole.Mouse(displayElement);
        var touch = new Guacamole.Mouse.Touchpad(displayElement);
        var mousefix = new BwflaMouse(this.guac);

        //touch.onmousedown = touch.onmouseup = touch.onmousemove =
        //mouse.onmousedown = mouse.onmouseup = mouse.onmousemove =
        //function(mouseState) { guac.sendMouseState(mouseState); };

        mouse.onmousedown = touch.onmousedown = mousefix.onmousedown;
        mouse.onmouseup = touch.onmouseup = mousefix.onmouseup;
        mouse.onmousemove = touch.onmousemove = mousefix.onmousemove;

        var keyboard = new Guacamole.Keyboard(displayElement);

        keyboard.onkeydown = function (keysym) {
            this.guac.sendKeyEvent(1, keysym);
        }.bind(this);
        keyboard.onkeyup = function (keysym) {
            this.guac.sendKeyEvent(0, keysym);
        }.bind(this);

        $(displayElement).attr('tabindex', '0');
        $(displayElement).css('outline', '0');
        $(displayElement).mouseenter(function () {
            $(this).focusWithoutScrolling();
        });

        if (this.onReady) {
            this.onReady();
        }

        /*
         oskeyboard = new Guacamole.OnScreenKeyboard("/emucomp/resources/layouts/en-us-qwerty.xml");

         $('#keyboard-wrapper').addClass('keyboard-container');
         $('#keyboard-wrapper').html(oskeyboard.getElement());

         function resizeKeyboardTimer()
         {
         oskeyboard.resize($('#display > div').width()*0.95);
         setTimeout(resizeKeyboardTimer, 200);
         }

         resizeKeyboardTimer();

         oskeyboard.onkeydown = function (keysym) { guac.sendKeyEvent(1, keysym); };
         oskeyboard.onkeyup = function (keysym) { guac.sendKeyEvent(0, keysym); };
         */
    };


    this.startEnvironment = function (environmentId, args) {
        var data = {};
        data.type = "machine";
        data.environment = environmentId;

        if (typeof args !== "undefined") {
            data.keyboardLayout = args.keyboardLayout;
            data.keyboardModel = args.keyboardModel;
            data.object = args.object;

            if (args.object == null) {
                data.software = args.software;
            }
        }

        $.ajax({
            type: "POST",
            url: API_URL + "/components",
            data: JSON.stringify(data),
            contentType: "application/json"
        })
            .then(function (data, status, xhr) {
                _this.componentId = data.id;
                _this.driveId = data.driveId;
                _this.pollState();
            }, function (xhr) {
                _this._onError($.parseJSON(xhr.responseText))
            });
    };

    this.getScreenshotUrl = function () {
        return API_URL + formatStr("/components/{0}/screenshot", _this.componentId);
    };

    this.getPrintUrl = function() {
        return API_URL + formatStr("/components/{0}/print", _this.componentId);
    };

    this.stopEnvironment = function () {
        this.guac.disconnect();
        $.ajax({
            type: "GET",
            url: API_URL + formatStr("/components/{0}/stop", _this.componentId),
            async: false,
        });
        $(container).empty();
    };

    this.clearTimer = function () {
        clearInterval(this.keepaliveIntervalId);
    };

    this.release = function () {
        this.stopEnvironment();
        this.clearTimer();
    };

    this.changeMedia = function (postObj, onChangeDone) {
        $.ajax({
            type: "POST",
            url: API_URL + formatStr("/components/{0}/changeMedia", _this.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json"
        })
            .then(function (data, status, xhr) {
                onChangeDone(data, status);
            });
    };

    function prepareAndLoadXpra(xpraUrl) {
        /*
         search for xpra path, in order to include it to filePath
         */
        var scripts = document.getElementsByTagName("script");
        for (var prop in scripts) {
            var searchingAim = "eaas-client.js";
            if (typeof(scripts[prop].src) != "undefined" && scripts[prop].src.indexOf(searchingAim) != -1) {
                var eaasClientPath = scripts[prop].src;
            }
        }
        var xpraPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "xpra/";

        $.when(
            $.getScript(xpraPath + '/js/lib/jquery-ui.js'),
            $.getScript(xpraPath + '/js/lib/jquery.ba-throttle-debounce.js'),

            $.getScript(xpraPath + '/js/lib/bencode.js'),
            $.getScript(xpraPath + '/js/lib/zlib.js'),
            $.getScript(xpraPath + '/js/lib/lz4.js'),
            $.getScript(xpraPath + '/js/lib/forge.js'),

            $.getScript(xpraPath + '/js/lib/broadway/Decoder.js'),
            $.getScript(xpraPath + '/js/lib/aurora/aurora-xpra.js'),

            $.getScript(xpraPath + '/js/Utilities.js'),
            $.getScript(xpraPath + '/js/Keycodes.js'),
            $.getScript(xpraPath + '/js/Notifications.js'),
            $.getScript(xpraPath + '/js/MediaSourceUtil.js'),
            $.getScript(xpraPath + '/js/Window.js'),
            $.getScript(xpraPath + '/js/Protocol.js'),
            $.getScript(xpraPath + '/js/Client.js'),
            // loadScript(xpraUrl + '/js/Protocol.js'),

            $.Deferred(function (deferred) {
                $(deferred.resolve);
            })
        ).done(function () {
            loadXpra(xpraUrl, xpraPath);
        })

    }

    function loadScript(url) {
        // Adding the script tag to the head as suggested before
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        head.appendChild(script);
    }

    var loadXpra = function (xpraUrl, xpraPath) {
        if (!window.location.getParameter) {
            window.location.getParameter = function (key) {
                function parseParams() {
                    var params = {},
                        e,
                        a = /\+/g,	// Regex for replacing addition symbol with a space
                        r = /([^&=]+)=?([^&]*)/g,
                        d = function (s) {
                            return decodeURIComponent(s.replace(a, " "));
                        },
                        q = window.location.search.substring(1);

                    while (e = r.exec(q))
                        params[d(e[1])] = d(e[2]);

                    return params;
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
            var client = new XpraClient('display');

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
            else if (encoding && (encoding !== "auto")) {
                // the primary encoding can be set
                client.enable_encoding(encoding);
            }
            // encodings can be disabled like so
            // client.disable_encoding("h264");
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

            // attach a callback for when client closes
            if (!debug) {
                client.callback_close = function (reason) {
                    if (submit) {
                        var message = "Connection closed (socket closed)";
                        if (reason) {
                            message = reason;
                        }
                        var url = "/connect.html?disconnect=" + encodeData(message);
                        var props = {
                            "username": username,
                            "password": password,
                            "encoding": encoding,
                            "keyboard_layout": keyboard_layout,
                            "action": action,
                            "sound": sound,
                            "audio_codec": audio_codec,
                            "clipboard": clipboard,
                            "exit_with_children": exit_with_children,
                            "exit_with_client": exit_with_client,
                            "sharing": sharing,
                            "normal_fullscreen": normal_fullscreen,
                            "video": video,
                            "mediasource_video": mediasource_video,
                            "debug": debug,
                            "remote_logging": remote_logging,
                            "insecure": insecure,
                            "ignore_audio_blacklist": ignore_audio_blacklist,
                        }
                        for (var name in props) {
                            var value = props[name];
                            if (value) {
                                url += "&" + name + "=" + encodeData(value);
                            }
                        }
                        window.location = url;
                    } else {
                        // if we didn't submit through the form, silently redirect to the connect gui
                        window.location = "connect.html";
                    }
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
                return [xpraShapes.xpraWidth, xpraShapes.xpraHeight];
            }

            XpraClient.prototype._get_DPI = function () {
                return xpraShapes.xpraDPI;
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
                var screen = document.getElementById("display");
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
                $('#display').on('click', function (e) {
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
    };


    this.startEnvironmentWithInternet = function (environmentId, kbLanguage,
                                                  kbLayout) {
        $.ajax({
            type: "POST",
            url: API_URL + "/components",
            data: JSON.stringify({
                environment: environmentId,
                keyboardLayout: kbLanguage,
                keyboardModel: kbLayout
            }),
            contentType: "application/json"
        }).done(
            function (data) {
                this.tmpdata = data;
                $.ajax({
                    type: "POST",
                    url: API_URL + "/networks",
                    data: JSON.stringify({
                        components: [{
                            componentId: data.id
                        }],
                        hasInternet: true
                    }),
                    contentType: "application/json"
                }).done(
                    function (data2) {
                        this.pollState(this.tmpdata.controlUrl.replace(
                            /([^:])(\/\/+)/g, '$1/'), this.tmpdata.id);
                    }.bind(this)).fail(function (xhr, textStatus, error) {
                    this._onError($.parseJSON(xhr.responseText));
                }.bind(this));

            }.bind(this)).fail(function (xhr, textStatus, error) {
            //this._onError($.parseJSON(xhr.responseText).message);
        }.bind(this));
    }


};
