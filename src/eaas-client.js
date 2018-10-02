var EaasClient = EaasClient || {};

/**
 * Determines the resolution
 */

EaasClient.Client = function (api_entrypoint, container) {



    // Clean up on window close
    window.onbeforeunload = function () {
        if(_this.deleteOnUnload)
        this.release();
    }.bind(this);


    this.xpraConf = {
        xpraWidth: 640,
        xpraHeight: 480,
        xpraDPI: 96,
        xpraEncoding: "rgb32"
    };

    this.setXpraConf = function (width, height, dpi, xpraEncoding) {
        xpraConf = {
            xpraWidth: width,
            xpraHeight: height,
            xpraDPI: dpi,
            xpraEncoding: xpraEncoding
        };
    };

    var _this = this;
    _this.deleteOnUnload = true;
    var API_URL = api_entrypoint.replace(/([^:])(\/\/+)/g, '$1/').replace(/\/+$/, '');

    this.componentId = null;
    this.componentId2 = null;
    this.networkTcpInfo = null;
    this.networkId = null;
    this.driveId = null;
    this.params = null;

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

    async function removeNetworkComponent(netid, compid) {
        console.log("Removing component " + compid + " from network " + netid);
        try {
            await $.ajax({
                type: "DELETE",
                url: API_URL + formatStr("/networks/{0}/components/{1}", netid, compid),
                timeout: 10000,
                headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
            });
        }
        catch (xhr) {
            const json = $.parseJSON(xhr.responseText);
            if (json.error !== null)
                console.error("Server-Error:" + json.error);
            if (json.detail !== null)
                console.error("Server-Error Details:" + json.detail);
            if (json.stacktrace !== null)
                console.error("Server-Error Stacktrace:" + json.stacktrace);

            console.error("Removing component failed!");
            throw undefined;
        }

        console.log("Component removed: " + compid);
    }

    var isStarted = false;
    var isConnected = false;
    var emulatorState;

    this.pollState = function () {

        $.ajax({
            type: "GET",
            url: API_URL + formatStr("/components/{0}/state", _this.componentId),
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {},
            async: false,
        }).then(function (data, status, xhr) {
                emulatorState = data.state;
                if (emulatorState == "OK")
                    _this.keepalive();
                else if (emulatorState == "STOPPED" || emulatorState == "FAILED") {
                    _this.keepalive();
                    if(_this.onEmulatorStopped)
                        _this.onEmulatorStopped();
                }
                else if (emulatorState == "INACTIVE") {
                    location.reload();
                } else
                    _this._onFatalError("Invalid component state: " + this.emulatorState);
            }).fail(function () {
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
            if (typeof _this.envsComponentsData != "undefined"){
                //FIXME we should send only one keepalive
                for (let i = 0; i < _this.envsComponentsData.length; i++) {
                     $.ajax({
                        type: "POST",
                        url: API_URL + formatStr("/components/{0}/keepalive", _this.envsComponentsData[i].id),
                        headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
                     });
                }
            }
            url = formatStr("/networks/{0}/keepalive", _this.networkId);
        } else if (_this.componentId != null) {
            url = formatStr("/components/{0}/keepalive", _this.componentId);
        }

        $.ajax({
           type: "POST",
           url: API_URL + url,
           headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
        });
    };

    this.establishGuacamoleTunnel = function (controlUrl) {
        $.fn.focusWithoutScrolling = function () {
            var x = window.scrollX, y = window.scrollY;
            this.focus();
            window.scrollTo(x, y);
            return this;
        };

        // Remove old display element, if present
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

    this.getContainerResultUrl = function()
    {
        console.log(_this.componentId);
        if(_this.componentId == null){
            this.onError("Component ID is null, please contact administrator");
        }
        return API_URL + formatStr("/components/{0}/result", _this.componentId);
    };

    this.startContainer = function(containerId, args)
    {
        var data = {};
        data.type = "container";
        data.environment = containerId;
	    data.input_data = args.input_data;

        console.log("Starting container " + containerId + "...");
        var deferred = $.Deferred();

        $.ajax({
            type: "POST",
            url: API_URL + "/components",
            data: JSON.stringify(data),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
        }).then(function (data, status, xhr) {
            console.log("container " + containerId + " started.");
            _this.componentId = data.id;
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

    /*
     Method to start (connected) environments directly from constructed config.
     If you want it simple, use window.client.startEnvironment(id, params);

     ############################################
      Example of Connected Environments:
       var data = {};
       data.type = "machine";
       data.environment = "ENVIRONMENT1 ID";
       var env = {data, visualize: false};

       var data = {};
       data.type = "machine";
       data.environment = "ENVIRONMENT2 ID";
       var env2 = {data, visualize: true};

       window.client.start([env, env2], params)

     ############################################
       Example of input_data:

        input_data[0] = {
            type: "HDD",
            partition_table_type: "MBR",
            filesystem_type: "FAT32",
            size_mb: 1024,
            content: [
                {
                    action: "extract",
                    compression_format: "TAR",
                    url: "http://132.230.4.15/objects/ub/policy.tar",
                    name: "test"
                }
            ]
        };

        var data = {};
        data.type = "machine";
        data.environment = "ENVIRONMENT1 ID";
        data.input_data = input_data;
     ############################################

     * @param environments
     * @param args
     * @returns {*}
     */
    this.start = function (environments, args) {

        var connectNetwork = function (envsComponentsData) {
            components = [];
            for (let i = 0; i < envsComponentsData.length; i++) {
                components.push({componentId: envsComponentsData[i].id});
            }

            $.ajax({
                type: "POST",
                url: API_URL + "/networks",
                data: JSON.stringify({
                    components: components,
                    hasInternet: args.hasInternet ? true : false,
                    hasTcpGateway: args.hasTcpGateway ? true : false,
                    tcpGatewayConfig : args.tcpGatewayConfig ? args.tcpGatewayConfig : {}
                }),
                contentType: "application/json",
                headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
            }).then(function (network_data, status, xhr) {
                    _this.envsComponentsData = envsComponentsData;
                    _this.networkId = network_data.id;
                    _this.networkTcpInfo = network_data.networkUrls != null ? network_data.networkUrls.tcp : null;
                    _this.isStarted = true;
                    _this.pollStateIntervalId = setInterval(_this.pollState, 1500);
                    deferred.resolve();
                },
                function (xhr) {
                    _this._onFatalError($.parseJSON(xhr.responseText));
                    deferred.reject();
                });
        };


        var connectEnvs = function(environments) {
            var idsData = [];
            for (let i = 0; i < environments.length; i++) {
                console.log("env: " + environments[i].data.environment);
                $.ajax({
                    type: "POST",
                    url: API_URL + "/components",
                    headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {},
                    success: function (envData, status2, xhr2) {
                        idsData.push(envData);
                        if(environments[i].visualize == true){
                            console.log("_this.componentId "+ _this.componentId);
                            if(_this.componentId != null)
                                console.error("We support visualization of only one environment at the time!! Visualizing the last specified...");
                            _this.componentId = envData.id;
                            _this.driveId = envData.driveId;
                        }
                    },
                    async:false,
                    data: JSON.stringify(environments[i].data),
                    contentType: "application/json"
                })
            }
            connectNetwork(idsData);
        };

        var deferred = $.Deferred();

        if (environments.length > 1) {
            connectEnvs(environments)
        } else {
            console.log("Starting environment " + environments[0].data.environment + "...");
            $.ajax({
                type: "POST",
                url: API_URL + "/components",
                data: JSON.stringify(environments[0].data),
                contentType: "application/json",
                headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
            })
                .then(function (data, status, xhr) {
                        _this.componentId = data.id;
                        _this.driveId = data.driveId;

                        if (args.tcpGatewayConfig || args.hasInternet) {
                            connectNetwork([data]);
                        } else {
                            console.log("Environment " + environments[0].data.environment + " started.");
                            _this.isStarted = true;
                            _this.pollStateIntervalId = setInterval(_this.pollState, 1500);
                            deferred.resolve();
                        }
                    },
                    function (xhr) {
                        _this._onFatalError($.parseJSON(xhr.responseText));
                        deferred.reject();
                    });
        }

        return deferred.promise();
    };

    /**
     * Method to support obsolete APIs and single environment sessions
     * @Deprecated
     * @param environmentId
     * @param args
     * @returns {*}
     */
    this.startEnvironment = function (environmentId, args, input_data) {
        var data = {};
        data.type = "machine";
        data.environment = environmentId;
        if (typeof input_data !== "undefined" && input_data !=  null) {
            data.input_data = [];
            data.input_data[0] = input_data;
        }

        if (typeof args !== "undefined") {
            data.keyboardLayout = args.keyboardLayout;
            data.keyboardModel = args.keyboardModel;
            data.object = args.object;

            if (args.object == null) {
                data.software = args.software;
            }
            data.userId = args.userId;
            if(args.lockEnvironment)
                data.lockEnvironment = true;
        }
        return this.start([{data, visualize: true}], args);
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

        $.ajax({
            type: "GET",
            url: API_URL + formatStr("/components/{0}/controlurls", _this.componentId),
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {},
            async: false,
        }).done(function (data, status, xhr) {
                var connectViewerFunc;
                var controlUrl;

                // Guacamole connector?
                if (typeof data.guacamole !== "undefined") {
                    controlUrl = data.guacamole;
                    _this.params = strParamsToObject(data.guacamole.substring(data.guacamole.indexOf("#") + 1));
                    connectViewerFunc = _this.establishGuacamoleTunnel;
                }
                // XPRA connector
                else if (typeof data.xpra !== "undefined") {
                    controlUrl = data.xpra;
                    _this.params = strParamsToObject(data.xpra.substring(data.xpra.indexOf("#") + 1));
                    connectViewerFunc = _this.prepareAndLoadXpra;
                }
                // WebEmulator connector
                else if (typeof data.webemulator !== "undefined") {
                    controlUrl = encodeURIComponent(JSON.stringify(data));
                    _this.params = strParamsToObject(data.webemulator.substring(data.webemulator.indexOf("#") + 1));
                    connectViewerFunc = _this.prepareAndLoadWebEmulator;
                }
                else {
                    console.error("Unsupported connector type: " + data);
                    deferred.reject();
                    return;
                }

                // Establish the connection
                connectViewerFunc.call(_this, controlUrl);
                console.log("Viewer connected successfully.");
                _this.isConnected = true;
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

        if (!this.isConnected) {
            deferred.reject();
            return deferred.promise();
        }

        console.log("Disconnecting viewer...");
        if (this.guac)
            this.guac.disconnect();

        console.log("Viewer disconnected successfully.")
        this.isConnected = false;
        deferred.resolve();

        return deferred.promise();
    };

    // Checkpoints a running session
    this.checkpoint = async function (request) {
        if (!this.isStarted) {
            _this._onFatalError("Environment was not started properly!");
            throw undefined;
        }

        if (_this.networkId != null) {
            // Remove the main component from the network group first!
            await removeNetworkComponent(_this.networkId, _this.componentId);
        }

        console.log("Checkpointing session...");
        try {
            const data = await $.ajax({
                type: "POST",
                url: API_URL + formatStr("/components/{0}/checkpoint", _this.componentId),
                timeout: 30000,
                contentType: "application/json",
                data: JSON.stringify(request),
                headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
            });

            const envid = data.envId;
            console.log("Checkpoint created: " + envid);
            return envid;
        }
        catch (xhr) {
            var json = $.parseJSON(xhr.responseText);
            if (json.message !== null)
                console.error("Server-Error:" + json.message);

            console.error("Checkpointing failed!");
            throw undefined;
        }
    };

    this.getScreenshotUrl = function () {
        return API_URL + formatStr("/components/{0}/screenshot", _this.componentId);
    };

    this.downloadPrint = function (label)
    {
        return API_URL + formatStr("/components/{0}/downloadPrintJob?label={1}", _this.componentId, encodeURI(label));
    }

    this.getPrintJobs = function (successFn, errorFn) {
        $.ajax({
            type: "GET",
            url: API_URL + formatStr("/components/{0}/printJobs", _this.componentId),
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {},
            async: false,
        }).done(function (data, status, xhr) {
            successFn(data);
        }).fail(function (xhr) {
        if(errorFn)
            errorFn(xhr);
        });
    };

    this.getEmulatorState = function () {
        if (typeof(emulatorState) !== "undefined")
            return emulatorState;
        else {
            console.warn("emulator state is not defined yet!");
            return "undefined";
        }
    };

    this.stopEnvironment = function () {

        if (!this.isStarted)
            return;

        if (this.pollStateIntervalId)
            clearInterval(this.pollStateIntervalId);
        $.ajax({
            type: "GET",
            url: API_URL + formatStr("/components/{0}/stop", _this.componentId),
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {},
            async: false,
        });

        this.isStarted = false;

        $(container).empty();
    };

    this.clearTimer = function () {
        clearInterval(this.keepaliveIntervalId);
    };

    this.release = function () {
        var result = this.disconnect();
        while (result.state() === "pending") {
            continue;  // Wait for completion!
        }

        this.stopEnvironment();
        this.clearTimer();

        $.ajax({
            type: "DELETE",
            url: API_URL + formatStr("/components/{0}", _this.componentId),
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {},
            async: false,
        });
    };

    this.sendCtrlAltDel = function() {
        this.guac.sendKeyEvent(1, 0xFFE9);
        this.guac.sendKeyEvent(1, 0xFFE3);
        this.guac.sendKeyEvent(1, 0xFFFF);
        this.guac.sendKeyEvent(0, 0xFFE9);
        this.guac.sendKeyEvent(0, 0xFFE3);
        this.guac.sendKeyEvent(0, 0xFFFF);
    };

    this.snapshot = function (postObj, onChangeDone, errorFn) {
        $.ajax({
            type: "POST",
            url: API_URL + formatStr("/components/{0}/snapshot", _this.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
        }).then(function (data, status, xhr) {
            onChangeDone(data, status);
        }).fail(function(xhr, textStatus, error) {
            if(errorFn)
                errorFn(error);
            else {
                console.log(xhr.statusText);
                console.log(textStatus);
                console.log(error);
            }
        });
    };

    this.changeMedia = function (postObj, onChangeDone) {
        $.ajax({
            type: "POST",
            url: API_URL + formatStr("/components/{0}/changeMedia", _this.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
        }).then(function (data, status, xhr) {
            onChangeDone(data, status);
        });
    };

    this.prepareAndLoadXpra = function (xpraUrl) {
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
        if(typeof eaasClientPath == "undefined") {
            xpraPath = "xpra/";
        } else {
            var xpraPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "xpra/";
        }
        jQuery.when(
            jQuery.getScript(xpraPath + '/js/lib/zlib.js'),

            jQuery.getScript(xpraPath + '/js/lib/aurora/aurora.js'),
            jQuery.getScript(xpraPath + '/js/lib/lz4.js'),
            jQuery.getScript(xpraPath + '/js/lib/jquery-ui.js'),
            jQuery.getScript(xpraPath + '/js/lib/jquery.ba-throttle-debounce.js'),
            jQuery.Deferred(function (deferred) {
                jQuery(deferred.resolve);
            })).done(function () {
            jQuery.when(
                jQuery.getScript(xpraPath + '/js/lib/bencode.js'),
                jQuery.getScript(xpraPath + '/js/lib/forge.js'),
                jQuery.getScript(xpraPath + '/js/lib/wsworker_check.js'),
                jQuery.getScript(xpraPath + '/js/lib/broadway/Decoder.js'),
                jQuery.getScript(xpraPath + '/js/lib/aurora/aurora-xpra.js'),
                jQuery.getScript(xpraPath + '/eaas-xpra.js'),
                jQuery.getScript(xpraPath + '/js/Keycodes.js'),
                jQuery.getScript(xpraPath + '/js/Utilities.js'),
                jQuery.getScript(xpraPath + '/js/Notifications.js'),
                jQuery.getScript(xpraPath + '/js/MediaSourceUtil.js'),
                jQuery.getScript(xpraPath + '/js/Window.js'),
                jQuery.getScript(xpraPath + '/js/Protocol.js'),
                jQuery.getScript(xpraPath + '/js/Client.js'),

                jQuery.Deferred(function (deferred) {
                    jQuery(deferred.resolve);
                })).done(function () {
                    loadXpra(xpraUrl, xpraPath, _this.xpraConf);
                }
            )
        })
    };

    this.prepareAndLoadWebEmulator = function (url) {
        /*
         search for eaas-client.js path, in order to include it to filePath
         */
        var scripts = document.getElementsByTagName("script");
        var eaasClientPath = "";
        for (var prop in scripts) {
            var searchingAim = "eaas-client.js";
            if (typeof(scripts[prop].src) != "undefined" && scripts[prop].src.indexOf(searchingAim) != -1) {
                var eaasClientPath = scripts[prop].src;
            }
        }
        var webemulatorPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "webemulator/";
        var iframe = document.createElement("iframe");
        iframe.setAttribute("style", "width: 100%; height: 600px;");
        iframe.src = webemulatorPath + "#controlurls=" + url;
        container.appendChild(iframe);
    };

    this.startDockerEnvironment = function (environmentId, args) {
        var data = {};
        data.type = "container";
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
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? {"Authorization" : "Bearer " + localStorage.getItem('id_token')} : {}
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


};
/*
 *  Example usage:
 *
 *      var centerOnScreen = function(width, height) {
 *          ...
 *      }
 *
 *      var resizeIFrame = function(width, height) {
 *          ...
 *      }
 *
 *      BWFLA.registerEventCallback(<target-1>, 'resize', centerOnScreen);
 *      BWFLA.registerEventCallback(<target-2>, 'resize', centerOnScreen);
 *      BWFLA.registerEventCallback(<target-2>, 'resize', resizeIFrame);
 */

var BWFLA = BWFLA || {};

// Method to attach a callback to an event
BWFLA.registerEventCallback = function(target, eventName, callback)
{
    var event = 'on' + eventName;

    if (!(event in target)) {
        console.error('Event ' + eventName + ' not supported!');
        return;
    }

    // Add placeholder for event-handlers to target's prototype
    if (!('__bwFlaEventHandlers__' in target))
        target.constructor.prototype.__bwFlaEventHandlers__ = {};

    // Initialize the list for event's callbacks
    if (!(event in target.__bwFlaEventHandlers__))
        target.__bwFlaEventHandlers__[event] = [];

    // Add the new callback to event's callback-list
    var callbacks = target.__bwFlaEventHandlers__[event];
    callbacks.push(callback);

    // If required, initialize handler management function
    if (target[event] == null) {
        target[event] = function() {
            var params = arguments;  // Parameters to the original callback

            // Call all registered callbacks one by one
            callbacks.forEach(function(func) {
                func.apply(target, params);
            });
        };
    }
};


// Method to unregister a callback for an event
BWFLA.unregisterEventCallback = function(target, eventName, callback)
{
    // Look in the specified target for the callback and
    // remove it from the execution chain for this event

    if (!('__bwFlaEventHandlers__' in target))
        return;

    var callbacks = target.__bwFlaEventHandlers__['on' + eventName];
    if (callbacks == null)
        return;

    var index = callbacks.indexOf(callback);
    if (index > -1)
        callbacks.splice(index, 1);
};

/** Custom mouse-event handlers for use with the Guacamole.Mouse */
var BwflaMouse = function(client)
{
    var events = [];
    var handler = null;
    var waiting = false;


    /** Adds a state's copy to the current event-list. */
    function addEventCopy(state)
    {
        var copy = new Guacamole.Mouse.State(state.x, state.y, state.left,
            state.middle, state.right, state.up, state.down);

        events.push(copy);
    }

    /** Sets a new timeout-callback, replacing the old one. */
    function setNewTimeout(callback, timeout)
    {
        if (handler != null)
            window.clearTimeout(handler);

        handler = window.setTimeout(callback, timeout);
    }

    /** Handler, called on timeout. */
    function onTimeout()
    {
        while (events.length > 0)
            client.sendMouseState(events.shift());

        handler = null;
        waiting = false;
    };


    /** Handler for mouse-down events. */
    this.onmousedown = function(state)
    {
        setNewTimeout(onTimeout, 100);
        addEventCopy(state);
        waiting = true;
    };

    /** Handler for mouse-up events. */
    this.onmouseup = function(state)
    {
        setNewTimeout(onTimeout, 150);
        addEventCopy(state);
        waiting = true;
    };

    /** Handler for mouse-move events. */
    this.onmousemove = function(state)
    {
        if (waiting == true)
            addEventCopy(state);
        else client.sendMouseState(state);
    };
};

var BWFLA = BWFLA || {};


/** Requests a pointer-lock on given element, if supported by the browser. */
BWFLA.requestPointerLock = function(target, event)
{
    function lockPointer() {
        var havePointerLock = 'pointerLockElement' in document
            || 'mozPointerLockElement' in document
            || 'webkitPointerLockElement' in document;

        if (!havePointerLock) {
            var message = "Your browser does not support the PointerLock API!\n"
                + "Using relative mouse is not possible.\n\n"
                + "Mouse input will be disabled for this virtual environment.";

            console.warn(message);
            alert(message);
            return;
        }

        // Activate pointer-locking
        target.requestPointerLock = target.requestPointerLock
            || target.mozRequestPointerLock
            || target.webkitRequestPointerLock;

        target.requestPointerLock();
    };

    function enableLockEventListener()
    {
        target.addEventListener(event, lockPointer, false);
    };

    function disableLockEventListener()
    {
        target.removeEventListener(event, lockPointer, false);
    };

    function onPointerLockChange() {
        if (document.pointerLockElement === target
            || document.mozPointerLockElement === target
            || document.webkitPointerLockElement === target) {
            // Pointer was just locked
            console.debug("Pointer was locked!");
            target.isPointerLockEnabled = true;
            disableLockEventListener();
        } else {
            // Pointer was just unlocked
            console.debug("Pointer was unlocked.");
            target.isPointerLockEnabled = false;
            enableLockEventListener();
        }
    };

    function onPointerLockError(error) {
        var message = "Pointer lock failed!";
        console.warn(message);
        alert(message);
    }

    // Hook for pointer lock state change events
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);

    // Hook for pointer lock errors
    document.addEventListener('pointerlockerror', onPointerLockError, false);
    document.addEventListener('mozpointerlockerror', onPointerLockError, false);
    document.addEventListener('webkitpointerlockerror', onPointerLockError, false);

    enableLockEventListener();

    // Set flag for relative-mouse mode
    target.isRelativeMouse = true;
};


/** Hides the layer containing client-side mouse-cursor. */
BWFLA.hideClientCursor = function(guac)
{
    var display = guac.getDisplay();
    display.showCursor(false);
};


/** Shows the layer containing client-side mouse-cursor. */
BWFLA.showClientCursor = function(guac)
{
    var display = guac.getDisplay();
    display.showCursor(true);
};
/*
 *  Example usage:
 *
 *      var centerOnScreen = function(width, height) {
 *          ...
 *      }
 *
 *      var resizeIFrame = function(width, height) {
 *          ...
 *      }
 *
 *      BWFLA.registerEventCallback(<target-1>, 'resize', centerOnScreen);
 *      BWFLA.registerEventCallback(<target-2>, 'resize', centerOnScreen);
 *      BWFLA.registerEventCallback(<target-2>, 'resize', resizeIFrame);
 */

var BWFLA = BWFLA || {};

// Method to attach a callback to an event
BWFLA.registerEventCallback = function(target, eventName, callback)
{
  var event = 'on' + eventName;

  if (!(event in target)) {
    console.error('Event ' + eventName + ' not supported!');
    return;
  }

  // Add placeholder for event-handlers to target's prototype
  if (!('__bwFlaEventHandlers__' in target))
    target.constructor.prototype.__bwFlaEventHandlers__ = {};

  // Initialize the list for event's callbacks
  if (!(event in target.__bwFlaEventHandlers__))
    target.__bwFlaEventHandlers__[event] = [];

  // Add the new callback to event's callback-list
  var callbacks = target.__bwFlaEventHandlers__[event];
  callbacks.push(callback);

  // If required, initialize handler management function
  if (target[event] == null) {
    target[event] = function() {
      var params = arguments;  // Parameters to the original callback

      // Call all registered callbacks one by one
      callbacks.forEach(function(func) {
        func.apply(target, params);
      });
    };
  }
};


// Method to unregister a callback for an event
BWFLA.unregisterEventCallback = function(target, eventName, callback)
{
  // Look in the specified target for the callback and
  // remove it from the execution chain for this event

  if (!('__bwFlaEventHandlers__' in target))
    return;

  var callbacks = target.__bwFlaEventHandlers__['on' + eventName];
  if (callbacks == null)
    return;

  var index = callbacks.indexOf(callback);
  if (index > -1)
    callbacks.splice(index, 1);
};

/** Custom mouse-event handlers for use with the Guacamole.Mouse */
var BwflaMouse = function(client)
{
  var events = [];
  var handler = null;
  var waiting = false;


  /** Adds a state's copy to the current event-list. */
  function addEventCopy(state)
  {
    var copy = new Guacamole.Mouse.State(state.x, state.y, state.left,
        state.middle, state.right, state.up, state.down);

    events.push(copy);
  }

  /** Sets a new timeout-callback, replacing the old one. */
  function setNewTimeout(callback, timeout)
  {
    if (handler != null)
      window.clearTimeout(handler);

    handler = window.setTimeout(callback, timeout);
  }

  /** Handler, called on timeout. */
  function onTimeout()
  {
    while (events.length > 0)
      client.sendMouseState(events.shift());

    handler = null;
    waiting = false;
  };


  /** Handler for mouse-down events. */
  this.onmousedown = function(state)
  {
    setNewTimeout(onTimeout, 100);
    addEventCopy(state);
    waiting = true;
  };

  /** Handler for mouse-up events. */
  this.onmouseup = function(state)
  {
    setNewTimeout(onTimeout, 150);
    addEventCopy(state);
    waiting = true;
  };

  /** Handler for mouse-move events. */
  this.onmousemove = function(state)
  {
    if (waiting == true)
      addEventCopy(state);
    else client.sendMouseState(state);
  };
};

var BWFLA = BWFLA || {};


/** Requests a pointer-lock on given element, if supported by the browser. */
BWFLA.requestPointerLock = function(target, event)
{
  function lockPointer() {
    var havePointerLock = 'pointerLockElement' in document
                          || 'mozPointerLockElement' in document
                          || 'webkitPointerLockElement' in document;

    if (!havePointerLock) {
      var message = "Your browser does not support the PointerLock API!\n"
                + "Using relative mouse is not possible.\n\n"
                + "Mouse input will be disabled for this virtual environment.";

      console.warn(message);
      alert(message);
      return;
    }

    // Activate pointer-locking
    target.requestPointerLock = target.requestPointerLock
                                || target.mozRequestPointerLock
                                || target.webkitRequestPointerLock;

    target.requestPointerLock();
  };

  function enableLockEventListener()
  {
    target.addEventListener(event, lockPointer, false);
  };

  function disableLockEventListener()
  {
    target.removeEventListener(event, lockPointer, false);
  };

  function onPointerLockChange() {
    if (document.pointerLockElement === target
        || document.mozPointerLockElement === target
        || document.webkitPointerLockElement === target) {
      // Pointer was just locked
      console.debug("Pointer was locked!");
      target.isPointerLockEnabled = true;
      disableLockEventListener();
    } else {
      // Pointer was just unlocked
      console.debug("Pointer was unlocked.");
      target.isPointerLockEnabled = false;
      enableLockEventListener();
    }
  };

  function onPointerLockError(error) {
    var message = "Pointer lock failed!";
    console.warn(message);
    alert(message);
  }

  // Hook for pointer lock state change events
  document.addEventListener('pointerlockchange', onPointerLockChange, false);
  document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
  document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);

  // Hook for pointer lock errors
  document.addEventListener('pointerlockerror', onPointerLockError, false);
  document.addEventListener('mozpointerlockerror', onPointerLockError, false);
  document.addEventListener('webkitpointerlockerror', onPointerLockError, false);

  enableLockEventListener();

  // Set flag for relative-mouse mode
  target.isRelativeMouse = true;
};


/** Hides the layer containing client-side mouse-cursor. */
BWFLA.hideClientCursor = function(guac)
{
  var display = guac.getDisplay();
  display.showCursor(false);
};


/** Shows the layer containing client-side mouse-cursor. */
BWFLA.showClientCursor = function(guac)
{
  var display = guac.getDisplay();
  display.showCursor(true);
};
