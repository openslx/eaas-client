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

                            if (typeof data.xpra !== "undefined") {
                                _this.params = strParamsToObject(data.xpra.substring(data.xpra.indexOf("#") + 1));
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
        var xpraPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "xpra";

        $.when(
            $.getScript(xpraPath + '/www/js/lib/jquery-ui.js'),
            $.getScript(xpraPath + '/www/js/lib/jquery.ba-throttle-debounce.js'),

            $.getScript(xpraPath + '/www/js/lib/bencode.js'),
            $.getScript(xpraPath + '/www/js/lib/zlib.js'),
            $.getScript(xpraPath + '/www/js/lib/lz4.js'),
            $.getScript(xpraPath + '/www/js/lib/forge.js'),

            $.getScript(xpraPath + '/www/js/lib/broadway/Decoder.js'),
            $.getScript(xpraPath + '/www/js/lib/aurora/aurora-xpra.js'),

            $.getScript(xpraPath + '/www/js/Utilities.js'),
            $.getScript(xpraPath + '/www/js/Keycodes.js'),
            $.getScript(xpraPath + '/www/js/Notifications.js'),
            $.getScript(xpraPath + '/www/js/MediaSourceUtil.js'),
            $.getScript(xpraPath + '/www/js/Window.js'),
            $.getScript(xpraPath + '/www/js/Protocol.js'),
            $.getScript(xpraPath + '/www/js/Client.js'),
            // loadScript(xpraUrl + '/www/js/Protocol.js'),

            $.Deferred(function (deferred) {
                $(deferred.resolve);
            })
       ).done(function () {
            loadXpra(xpraUrl, xpraPath);
        })

    }

    function loadXpra(xpraUrl, xpraPath) {

        console.log("!xpraUrl " + xpraUrl);

        if (!window.location.getParameter) {
            window.location.getParameter = function(key) {
                function parseParams() {
                    var params = {},
                        e,
                        a = /\+/g,	// Regex for replacing addition symbol with a space
                        r = /([^&=]+)=?([^&]*)/g,
                        d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
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
        window.oncontextmenu = function(e) {
            //showCustomMenu();
            return false;
        }

        function getparam(prop) {
            var value = window.location.getParameter(prop);
            if (value === undefined && typeof(Storage) !== undefined) {
                value = sessionStorage.getItem(prop);
            }
            return value;
        }
        function getboolparam(prop, default_value) {
            var v = getparam(prop);
            if(v===null) {
                return default_value;
            }
            return ["true", "on", "1", "yes", "enabled"].indexOf(String(v).toLowerCase())>=0;
        }

        function encodeData(s) {
            return encodeURIComponent(s);
        }

        $(document).ready(function() {
            // look at url parameters
            var username = getparam("username") || null;
            var password = getparam("password") || null;
            var sound = getboolparam("sound") || null;
            var audio_codec = getparam("audio_codec") || null;
            var encoding = getparam("encoding") || null;
            var action = getparam("action") || "connect";
            var submit = getboolparam("submit", true);
            var server = xpraUrl.substring(7, xpraUrl.indexOf("8080") - 1);
            var port = xpraUrl.substring(xpraUrl.indexOf("8080"));
            var encryption = getboolparam("encryption", false);
            var key = getparam("key") || null;
            var keyboard_layout = getparam("keyboard_layout") || null;
            var start = getparam("start");
            var exit_with_children = getboolparam("exit_with_children", false);
            var exit_with_client = getboolparam("exit_with_client", false);
            var sharing = getboolparam("sharing", false);
            var video = getboolparam("video", false);
            var mediasource_video = getboolparam("mediasource_video", false);
            var remote_logging = getboolparam("remote_logging", true);
            var debug = getboolparam("debug", false);
            var insecure = getboolparam("insecure", false);
            var ignore_audio_blacklist = getboolparam("ignore_audio_blacklist", false);
            var clipboard = getboolparam("clipboard", true);
            var printing = getboolparam("printing", true);
            var file_transfer = getboolparam("file_transfer", true);
            var steal = getboolparam("steal", true);
            var reconnect = getboolparam("reconnect", true);
            var swap_keys = getboolparam("swap_keys", Utilities.isMacOS());
            //delete session params:
            console.log("server " + server)
            console.log("port " + port)
            try {
                sessionStorage.clear();
            }
            catch (e) {
                //ignore
            }

            // show connection progress:
            function connection_progress(state, details, progress) {
                console.log("connection_progress(", state, ", ", details, ", ", progress, ")");
                if (progress>=100) {
                    $('#progress').hide();
                }
                else {
                    $('#progress').show();
                }
                $('#progress-bar').val(progress);
                $('#progress-label').text(state || " ");
                $('#progress-details').text(details || " ");
            }

            // create the client
            var client = new XpraClient('emulator-container');
            client.debug = debug;
            client.remote_logging = remote_logging;
            client.sharing = sharing;
            client.insecure = insecure;
            client.clipboard_enabled = clipboard;
            client.printing = printing;
            client.file_transfer = file_transfer;
            client.steal = steal;
            client.reconnect = reconnect;
            client.swap_keys = swap_keys;
            client.on_connection_progress = connection_progress;
            //example overrides:
            //client.HELLO_TIMEOUT = 3600000;
            //client.PING_TIMEOUT = 60000;
            //client.PING_GRACE = 30000;
            //client.PING_FREQUENCY = 15000;

            if (debug) {
                //example of client event hooks:
                client.on_open = function() {
                    console.debug("connection open");
                };
                client.on_connect = function() {
                    console.debug("connection established");
                };
                client.on_first_ui_event = function() {
                    console.debug("first ui event");
                };
                client.on_last_window = function() {
                    console.debug("last window disappeared");
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
                console.log("sound enabled, audio codec string: "+audio_codec);
                if(audio_codec && audio_codec.indexOf(":")>0) {
                    var acparts = audio_codec.split(":");
                    client.audio_framework = acparts[0];
                    client.audio_codec = acparts[1];
                }
                client.audio_mediasource_enabled = getboolparam("mediasource", true);
                client.audio_aurora_enabled = getboolparam("aurora", true);
                client.audio_httpstream_enabled = getboolparam("http-stream", true);
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
                        var url = "/connect.html";
                        function add_prop(prop, value) {
                            if (typeof(Storage) !== "undefined") {
                                if (value===null || value==="undefined") {
                                    sessionStorage.removeItem(prop);
                                }
                                else {
                                    sessionStorage.setItem(prop, value);
                                }
                            } else {
                                if (value===null || value==="undefined") {
                                    value = "";
                                }
                                url = url + "&"+prop+"="+encodeData(""+value);
                            }
                        }
                        add_prop("disconnect", message);
                        var props = {
                            "username"			: username,
                            "insecure"			: insecure,
                            "server"			: server,
                            "port"				: port,
                            "encoding"			: encoding,
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
                        window.location=url;
                    } else {
                        // if we didn't submit through the form, silently redirect to the connect gui
                        window.location="connect.html";
                    }
                }
            }
            client.init(ignore_audio_blacklist);

            var ssl = document.location.protocol=="https:";
            client.host = server;
            client.port = port;
            client.ssl = ssl;



            /**
             * Patch
             */
            /**
             * Protocol
             * @param with_worker
             * @private
             */
            XpraProtocolWorkerHost.prototype.open = function(uri) {
                var me = this;
                if (this.worker) {
                    //re-use the existing worker:
                    this.worker.postMessage({'c': 'o', 'u': uri});
                    return;
                }
                this.worker = new Worker(xpraPath + '/www/js/Protocol.js');
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

            XpraClient.prototype._get_desktop_size = function () {
                return [xpraShapes.xpraWidth, xpraShapes.xpraHeight];
            }

            XpraClient.prototype._get_DPI = function () {
                return xpraShapes.xpraDPI;
            }


            XpraClient.prototype._process_hello = function(packet, ctx) {
                //show("process_hello("+packet+")");
                // clear hello timer
                if(ctx.hello_timer) {
                    clearTimeout(ctx.hello_timer);
                    ctx.hello_timer = null;
                }
                var hello = packet[1];
                ctx.server_remote_logging = hello["remote-logging.multi-line"];
                if(ctx.server_remote_logging && ctx.remote_logging) {
                    //hook remote logging:
                    Utilities.log = function() { ctx.log.apply(ctx, arguments); };
                    Utilities.warn = function() { ctx.warn.apply(ctx, arguments); };
                    Utilities.error = function() { ctx.error.apply(ctx, arguments); };
                }

                // check for server encryption caps update
                if(ctx.encryption) {
                    ctx.cipher_out_caps = {
                        "cipher"					: hello['cipher'],
                        "cipher.iv"					: hello['cipher.iv'],
                        "cipher.key_salt"			: hello['cipher.key_salt'],
                        "cipher.key_stretch_iterations"	: hello['cipher.key_stretch_iterations'],
                    };
                    ctx.protocol.set_cipher_out(ctx.cipher_out_caps, ctx.encryption_key);
                }
                // find the modifier to use for Num_Lock
                var modifier_keycodes = hello['modifier_keycodes']
                if (modifier_keycodes) {
                    for (var modifier in modifier_keycodes) {
                        if (modifier_keycodes.hasOwnProperty(modifier)) {
                            var mappings = modifier_keycodes[modifier];
                            for (var keycode in mappings) {
                                var keys = mappings[keycode];
                                for (var index in keys) {
                                    var key=keys[index];
                                    if (key=="Num_Lock") {
                                        ctx.num_lock_mod = modifier;
                                    }
                                }
                            }
                        }
                    }
                }

                var version = hello["version"];
                if(version != "2.1.1")
                    alert("incompatible xpra version");
                try {
                    var vparts = version.split(".");
                    var vno = [];
                    for (var i=0; i<vparts.length;i++) {
                        vno[i] = parseInt(vparts[i]);
                    }
                    if (vno[0]<=0 && vno[1]<10) {
                        ctx.callback_close("unsupported version: " + version);
                        ctx.close();
                        return;
                    }
                }
                catch (e) {
                    ctx.callback_close("error parsing version number '" + version + "'");
                    ctx.close();
                    return;
                }
                ctx.log("got hello: server version "+version+" accepted our connection");
                //figure out "alt" and "meta" keys:
                if ("modifier_keycodes" in hello) {
                    var modifier_keycodes = hello["modifier_keycodes"];
                    for (var mod in modifier_keycodes) {
                        //show("modifier_keycode["+mod+"]="+modifier_keycodes[mod].toSource());
                        var keys = modifier_keycodes[mod];
                        for (var i=0; i<keys.length; i++) {
                            var key = keys[i];
                            //the first value is usually the integer keycode,
                            //the second one is the actual key name,
                            //doesn't hurt to test both:
                            for (var j=0; j<key.length; j++) {
                                if ("Alt_L"==key[j])
                                    ctx.alt_modifier = mod;
                                if ("Meta_L"==key[j])
                                    ctx.meta_modifier = mod;
                            }
                        }
                    }
                }
                //show("alt="+alt_modifier+", meta="+meta_modifier);
                // stuff that must be done after hello
                if(ctx.audio_enabled) {
                    if(!(hello["sound.send"])) {
                        ctx.error("server does not support speaker forwarding");
                        ctx.audio_enabled = false;
                    }
                    else {
                        ctx.server_audio_codecs = hello["sound.encoders"];
                        if(!ctx.server_audio_codecs) {
                            ctx.error("audio codecs missing on the server");
                            ctx.audio_enabled = false;
                        }
                        else {
                            ctx.log("audio codecs supported by the server:", ctx.server_audio_codecs);
                            if(ctx.server_audio_codecs.indexOf(ctx.audio_codec)<0) {
                                ctx.warn("audio codec "+ctx.audio_codec+" is not supported by the server");
                                ctx.audio_codec = null;
                                //find the best one we can use:
                                for(var i = 0; i < MediaSourceConstants.PREFERRED_CODEC_ORDER.length; i++) {
                                    var codec = MediaSourceConstants.PREFERRED_CODEC_ORDER[i];
                                    if ((codec in ctx.audio_codecs) && (ctx.server_audio_codecs.indexOf(codec)>=0)){
                                        if (ctx.mediasource_codecs[codec]) {
                                            ctx.audio_framework = "mediasource";
                                        }
                                        else {
                                            ctx.audio_framework = "aurora";
                                        }
                                        ctx.audio_codec = codec;
                                        ctx.log("using", ctx.audio_framework, "audio codec", codec);
                                        break;
                                    }
                                }
                                if(!ctx.audio_codec) {
                                    ctx.warn("audio codec: no matches found");
                                    ctx.audio_enabled = false;
                                }
                            }
                        }
                        if (ctx.audio_enabled) {
                            ctx._sound_start_receiving();
                        }
                    }
                }
                ctx.server_is_desktop = Boolean(hello["desktop"]) || Boolean(hello["shadow"]);
                if (ctx.server_is_desktop) {
                    jQuery("body").addClass("desktop");
                }
                ctx.server_screen_sizes = hello["screen-sizes"] || [];
                console.log("server screen sizes:", ctx.server_screen_sizes)

                ctx.remote_open_files = Boolean(hello["open-files"]);
                ctx.remote_file_transfer = Boolean(hello["file-transfer"]);
                ctx.remote_printing = Boolean(hello["printing"]);
                if (ctx.remote_printing && ctx.printing) {
                    // send our printer definition
                    var printers = {
                        "HTML5 client": {
                            "printer-info": "Print to PDF in client browser",
                            "printer-make-and-model": "HTML5 client version",
                            "mimetypes": ["application/pdf"]
                        }
                    };
                    ctx.send(["printers", printers]);
                }
                // start sending our own pings
                ctx._send_ping();
                ctx.ping_timer = setInterval(function () {
                    ctx._send_ping();
                    return true;
                }, ctx.PING_FREQUENCY);
                ctx.reconnect_attempt = 0;
                ctx.on_connection_progress("Session started", "", 100);
                ctx.on_connect();
            }


            /**
             * Connect
             * @type {XpraClient.connect}
             */
            XpraClient.prototype.connect = function() {
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
                    var worker = new Worker(xpraPath + '/www/js/lib/wsworker_check.js');
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
            }

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

                win._set_decorated(false);

                win.ensure_visible();

                win.fill_screen();

                win.set_maximized(true);


            }
            /**
             * end of the patch
             */

            // and connect
            client.connect();

            var pasteboard = $('#pasteboard');
            if (clipboard) {
                //clipboard hooks:
                pasteboard.on('paste', function (e) {
                    var paste_data = (e.originalEvent || e).clipboardData.getData('text/plain');
                    client._debug("paste event, data=", paste_data);
                    client.send_clipboard_token(unescape(encodeURIComponent(paste_data)));
                    return false;
                });
                pasteboard.on('copy', function (e) {
                    var clipboard_buffer = client.get_clipboard_buffer();
                    $('#pasteboard').text(decodeURIComponent(escape(clipboard_buffer)));
                    $('#pasteboard').select();
                    client._debug("copy event, clipboard buffer=", clipboard_buffer);
                    client.clipboard_pending = false;
                    return true;
                });
                pasteboard.on('cut', function (e) {
                    var clipboard_buffer = client.get_clipboard_buffer();
                    $('#pasteboard').text(decodeURIComponent(escape(clipboard_buffer)));
                    $('#pasteboard').select();
                    client._debug("cut event, clipboard buffer=", clipboard_buffer);
                    client.clipboard_pending = false;
                    return true;
                });
                $('#screen').on('click', function (e) {
                    //console.log("click pending=", client.clipboard_pending, "buffer=", client.clipboard_buffer);
                    if (client.clipboard_pending) {
                        var clipboard_buffer = client.get_clipboard_buffer();
                        $('#pasteboard').text(clipboard_buffer);
                        $('#pasteboard').select();
                        client._debug("click event, with pending clipboard buffer=", clipboard_buffer);
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
            //file transfer hooks:
            if (file_transfer) {
                function send_file(f) {
                    console.log("file:", f.name, ", type:", f.type, ", size:", f.size, "last modified:", f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a');
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
            //keyboard input for tablets:
            pasteboard.on("input", function(e) {
                var txt = pasteboard.val();
                pasteboard.val("");
                client._debug("oninput:", txt);
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
                        client._debug(packet);
                        client.send(packet);
                        packet = ["key-action", client.topwindow, str, false, modifiers, keyval, str, keycode, group];
                        client._debug(packet);
                        client.send(packet);
                    }
                    catch (e) {
                        client.error("input handling error: "+e);
                    }
                }
            });
        });

    }



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
