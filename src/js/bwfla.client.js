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
        return result;
    }


    var hasConnected = false;
    this.pollState = function (componentId) {
        $.get(API_URL + formatStr("/components/{0}/state", _this.componentId))

            .then(function (data, status, xhr) {
                if (!hasConnected) {

                    $.get(API_URL + formatStr("/components/{0}/controlurls", _this.componentId))
                        .then(function (data, status, xhr) {

                            /**
                             * XPRA Section
                             */
                            if (typeof data.xpra !== "undefined") {
                                _this.params = strParamsToObject(data.xpra.substring(data.xpra.indexOf("#") + 1));

                                /**
                                 * Download dependencies and initialize Xpra session
                                 */
                                prepareAndLoadXpra(data.xpra);
                            } else {
                                /**
                                 * Guacamole Section
                                 */
                                _this.params = strParamsToObject(data.guacamole.substring(data.guacamole.indexOf("#") + 1));
                                _this.establishGuacamoleTunnel(data.guacamole);
                            }

                            _this.pollStateInterval = setInterval(_this.pollState, 1500);
                            hasConnected = true;

                            for (var i = 0; i < listeners.length; i++) {
                                // don't call removed listeners..
                                if (listeners[i]) {
                                    listeners[i]();
                                }
                            }

                        });
                } else {
                    var state = data.state;
                    if (state == "OK")
                        _this.keepalive();
                    else if (state == "INACTIVE") {
                        location.reload();
                    } else
                        _this._onError("Invalid component state: " + state);
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
        if (this.pollStateInterval)
            clearInterval(this.pollStateInterval);
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

    this.getPrintUrl = function () {
        return API_URL + formatStr("/components/{0}/print", _this.componentId);
    };

    this.stopEnvironment = function () {
        if (typeof this.guac !== "undefined")
            this.guac.disconnect()
        if (this.pollStateInterval)
            clearInterval(this.pollStateInterval);
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
