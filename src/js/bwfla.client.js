var EaasClient = EaasClient || {};

/**
 * Determines the resolution
 */

EaasClient.Client = function (api_entrypoint, container) {

    // Clean up on window close
    window.onbeforeunload = function () {
        this.disconnect();
        this.release();
    }.bind(this);


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

    // ID for registered this.pollState() with setInterval()
    this.pollStateIntervalId = null;

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
        return result;
    }


    var isStarted = false;
    this.pollState = function () {
        $.get(API_URL + formatStr("/components/{0}/state", _this.componentId))
            .then(function (data, status, xhr) {
                    var state = data.state;
                    if (state == "OK")
                        _this.keepalive();
                    else if (state == "INACTIVE") {
                        location.reload();
                    } else
                        _this._onFatalError("Invalid component state: " + state);
            }).fail(function() {
                _this._onFatalError("connection failed")
            });
    };

    this._onFatalError = function (msg) {
        if (this.pollStateIntervalId)
            clearInterval(this.pollStateIntervalId);

        this.disconnect();

        if (this.onError) {
            this.onError(msg || {"error": "No error message specified"});
        }

        console.error(msg);
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
        $.fn.focusWithoutScrolling = function () {
            var x = window.scrollX, y = window.scrollY;
            this.focus();
            window.scrollTo(x, y);
            return this;
        };

        // Remove old diplay element, if present
        if (this.guac) {
            var element = this.guac.getDisplay().getElement();
            $(element).remove();
        }

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
	    data.userContext = args.userContext;
        }

        var deferred = $.Deferred();

        console.log("Starting environment " + environmentId + "...");
        $.ajax({
            type: "POST",
            url: API_URL + "/components",
            data: JSON.stringify(data),
            contentType: "application/json"
        })
            .then(function (data, status, xhr) {
                console.log("Environment " + environmentId + " started.");
                _this.componentId = data.id;
                _this.driveId = data.driveId;
                _this.isStarted = true;
                _this.pollStateIntervalId = setInterval(_this.pollState, 1500);
                deferred.resolve();
            },
            function (xhr) {
                _this._onFatalError($.parseJSON(xhr.responseText));
                deferred.reject();
            });

        return deferred.promise();
    };

    // Connects viewer to a running session
    this.connect = function () {
        var deferred = $.Deferred();

        if (!this.isStarted) {
            _this._onFatalError("Environment was not started properly!");
            deferred.reject();
            return deferred.promise();
        }

        console.log("Connecting viewer...");
        $.get(API_URL + formatStr("/components/{0}/controlurls", _this.componentId))
            .done(function (data, status, xhr) {
                var connectViewerFunc;
                var controlUrl;

                // Guacamole connector?
                if (typeof data.guacamole !== "undefined") {
                    controlUrl = data.guacamole;
                    connectViewerFunc = _this.establishGuacamoleTunnel;
                }
                // XPRA connector
                else if (typeof data.xpra !== "undefined") {
                    controlUrl = data.xpra;
                    connectViewerFunc = _this.prepareAndLoadXpra;
                }
                else {
                    console.error("Unsupported connector type: " + data);
                    deferred.reject();
                    return;
                }

                // Establish the connection
                connectViewerFunc.call(_this, controlUrl);
                console.log("Viewer connected successfully.")
                deferred.resolve();
            })
            .fail(function (xhr) {
                console.error("Connecting viewer failed!")
                _this._onFatalError($.parseJSON(xhr.responseText))
                deferred.reject();
            });

        return deferred.promise();
    };

    // Disconnects viewer from a running session
    this.disconnect = function () {
        var deferred = $.Deferred();

        if (!this.isStarted) {
            _this._onFatalError("Environment was not started properly!");
            deferred.reject();
            return deferred.promise();
        }

        console.log("Disconnecting viewer...");
        if (this.guac)
            this.guac.disconnect();

        console.log("Viewer disconnected successfully.")
        deferred.resolve();
        
        return deferred.promise();
    };

    // Checkpoints a running session
    this.checkpoint = function () {
        var deferred = $.Deferred();

        if (!this.isStarted) {
            _this._onFatalError("Environment was not started properly!");
            deferred.reject();
            return deferred.promise();
        }

        console.log("Checkpointing session...");
        $.ajax({
            type: "POST",
            url: API_URL + formatStr("/components/{0}/checkpoint", _this.componentId),
            timeout: 30000
        })
            .done(function (data, status, xhr) {
                var envid = data.environment_id;
                console.log("Checkpoint created: " + envid);
                deferred.resolve(envid);
            })
            .fail(function (xhr, status, error) {
                var json = $.parseJSON(xhr.responseText);
                if (json.message !== null)
                    console.error("Server-Error:" + json.message);

                if (error !== null)
                    console.error("Ajax-Error: " + error);

                console.error("Checkpointing failed!");
                deferred.reject();
            });

        return deferred.promise();
    };

    this.getScreenshotUrl = function () {
        return API_URL + formatStr("/components/{0}/screenshot", _this.componentId);
    };

    this.getPrintUrl = function () {
        return API_URL + formatStr("/components/{0}/print", _this.componentId);
    };

    this.stopEnvironment = function () {
        if (typeof this.guac !== "undefined")
            this.guac.disconnect()
        if (this.pollStateIntervalId)
            clearInterval(this.pollStateIntervalId);
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

    this.sendCtrlAltDel = function() {
      this.guac.sendKeyEvent(1, 0xFFE9);
      this.guac.sendKeyEvent(1, 0xFFE3);
      this.guac.sendKeyEvent(1, 0xFFFF);
      this.guac.sendKeyEvent(0, 0xFFE9);
      this.guac.sendKeyEvent(0, 0xFFE3);
      this.guac.sendKeyEvent(0, 0xFFFF);
    };

    this.snapshot = function (postObj, onChangeDone) {
        $.ajax({
            type: "POST",
            url: API_URL + formatStr("/components/{0}/snapshot", _this.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json"
        }).then(function (data, status, xhr) {
            onChangeDone(data, status);
        });
    };

    this.changeMedia = function (postObj, onChangeDone) {
        $.ajax({
            type: "POST",
            url: API_URL + formatStr("/components/{0}/changeMedia", _this.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json"
        }).then(function (data, status, xhr) {
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
            $.getScript(xpraPath + '/eaas-xpra.js'),
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
            $.getScript(xpraPath + '/js/Client.js'),

            $.Deferred(function (deferred) {
                $(deferred.resolve);
            })
        ).done(function () {
            loadXpra(xpraUrl, xpraPath);
        })

    }

    // TODO: Check whether this works with current server-side implementation!
    // this.startEnvironmentWithInternet = function (environmentId, kbLanguage,
    //                                               kbLayout) {
    //     $.ajax({
    //         type: "POST",
    //         url: API_URL + "/components",
    //         data: JSON.stringify({
    //             environment: environmentId,
    //             keyboardLayout: kbLanguage,
    //             keyboardModel: kbLayout
    //         }),
    //         contentType: "application/json"
    //     }).done(
    //         function (data) {
    //             this.tmpdata = data;
    //             $.ajax({
    //                 type: "POST",
    //                 url: API_URL + "/networks",
    //                 data: JSON.stringify({
    //                     components: [{
    //                         componentId: data.id
    //                     }],
    //                     hasInternet: true
    //                 }),
    //                 contentType: "application/json"
    //             }).done(
    //                 function (data2) {
    //                     this.pollState(this.tmpdata.controlUrl.replace(
    //                         /([^:])(\/\/+)/g, '$1/'), this.tmpdata.id);
    //                 }.bind(this)).fail(function (xhr, textStatus, error) {
    //                 this._onFatalError($.parseJSON(xhr.responseText));
    //             }.bind(this));

    //         }.bind(this)).fail(function (xhr, textStatus, error) {
    //         //this._onFatalError($.parseJSON(xhr.responseText).message);
    //     }.bind(this));
    // }
};
