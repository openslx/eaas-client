import {NetworkSession} from "./networkSession.js"
import {ComponentSession} from "./componentSession.js"

function strParamsToObject(str) {
    var result = {};
    if (!str) return result; // return on empty string

    str.split("&").forEach(function (part) {
        var item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
    });
    return result;
}

function formatStr(format) {
    var args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match;
    });
}

export class Client extends EventTarget {
    constructor(api_entrypoint, container, idToken = null) {
        super();
        this.API_URL = api_entrypoint.replace(/([^:])(\/\/+)/g, '$1/').replace(/\/+$/, '');
        this.container = container;
        this.idToken = idToken || localStorage.getItem('id_token');

        this.deleteOnUnload = true;

        this.networkTcpInfo = null;
        this.networkId = null;
        this.params = null;
        this.mode = null;
        this.options = null;

        this.sessions = [];

        /**
         * component session attached to browser canvas
         */
        this.activeView = null;

        this.envsComponentsData = [];

        this.isConnected = false;

        this.xpraConf = {
            xpraWidth: 640,
            xpraHeight: 480,
            xpraDPI: 96,
            xpraEncoding: "jpeg"
        };

        // ID for registered this.pollState() with setInterval()
        this.pollStateIntervalId = null;

        // Clean up on window close
        window.addEventListener("beforeunload", () => {
            if (this.deleteOnUnload)
                this.release();
        });
    }

    setXpraConf(width, height, dpi, xpraEncoding) {
        this.xpraConf = {
            xpraWidth: width,
            xpraHeight: height,
            xpraDPI: dpi,
            xpraEncoding: xpraEncoding
        };
    }

    // ... token &&  { authorization : `Bearer ${token}`}, 
    // ... obj && {"content-type" : "application/json" }
    // ...obj && {body: JSON.stringify(obj) },


    async _pollState() {
        if (this.network) {
            this.network.keepalive();
        }

        for (const session of this.sessions) {

            if(session.getNetworkId() && !session.forceKeepalive)
                continue;

            let result = await session.getEmulatorState();
            if (!result)
                continue;

            let emulatorState = result.state;

            if (emulatorState == "OK")
                session.keepalive();
            else if (emulatorState == "STOPPED" || emulatorState == "FAILED") {
                if(this.onEmulatorStopped)
                    this.onEmulatorStopped();
                session.keepalive();
                this.dispatchEvent(new CustomEvent("error", { detail: `${emulatorState}` })); // .addEventListener("error", (e) => {})
            }
            else
                this.dispatchEvent(new CustomEvent("error", { detail: session }));
        }
    }

    _onResize(width, height) {

        if(!this.container)
        {
            console.log("container null: ");
            console.log(this);
            return;
        }

        this.container.style.width = width;
        this.container.style.height = height;

        if (this.onResize) {
            this.onResize(width, height);
        }
    }

    getActiveSession() {
        return this.activeView;
    }

    // Disconnects viewer from a running session
    disconnect() {
        if (!this.activeView) {
            return;
        }

        console.log("Disconnecting viewer...");
        if (this.mode === "guac") {
            this.guac.disconnect();
            BWFLA.unregisterEventCallback(this.guac.getDisplay(), 'resize', this._onResize.bind(this));
        }
        else if (this.mode === "xpra") {
            this.xpraClient.close();
        }

        if (this.rtcPeerConnection != null)
            this.rtcPeerConnection.close();

        let myNode = document.getElementById("emulator-container");
        // it's supposed to be faster, than / myNode.innerHTML = ''; /
        while (myNode.firstChild) {
            myNode.removeChild(myNode.firstChild);
        }
        this.activeView.disconnect();
        this.activeView = undefined;
        this.container = undefined;
        console.log("Viewer disconnected successfully.")
    }

    startContainer(containerId, args) {
        var data = {};
        data.type = "container";
        data.environment = containerId;
        data.input_data = args.input_data;

        console.log("Starting container " + containerId + "...");
        var deferred = $.Deferred();

        $.ajax({
            type: "POST",
            url: this.API_URL + "/components",
            data: JSON.stringify(data),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        }).then((data, status, xhr) => {
            console.log("container " + containerId + " started.");
            this.componentId = data.id;
            this.isStarted = true;
            this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);
            deferred.resolve();
        },
            (xhr) => {
                this._onFatalError($.parseJSON(xhr.responseText));
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
    async start(environments, args, attachId) {
        let componentSession = undefined;
        this.tcpGatewayConfig = args.tcpGatewayConfig;
        if (typeof args.xpraEncoding != "undefined" && args.xpraEncoding != null)
            this.xpraConf.xpraEncoding = args.xpraEncoding;

        if (attachId) {
            if (environments.length > 1) {
                this._onFatalError("We don't support hot connection for multiple environments ... yet. ");
            }
            // console.log(" I came to attachId section!" , environments[0]);
            return this._connectEnvs2(environments, attachId);
        }

        // if (environments.length > 1 || args.enableNetwork) 
        this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);
        try {
            for (const environmentRequest of environments) {
                componentSession = await ComponentSession.startComponent(this.API_URL, environmentRequest.data, this.idToken);
                this.sessions.push(componentSession);
                if (environmentRequest.visualize == true) {
                    this.activeView = componentSession;
                    if (this.componentId != null) {
                        throw new Error("We support visualization of only one environment at the time!! Visualizing the last specified...");
                    }
                }
            }
            if (args.enableNetwork) {
                this.network = new NetworkSession(this.API_URL, this.idToken);
                await this.network.startNetwork(this.sessions, args);
            }
        }
        catch (e) {
            this.release();
            throw new Error("starting environment session failed: " + e);
        }
        return componentSession;
    }

    async attachNewEnv(environmentRequest, session) {
        const componentSession = await ComponentSession.startComponent(this.API_URL, environmentRequest, this.idToken);
        this._attachToSwitch({id: componentSession.componentId}, session.sessionId);
        componentSession.type = "machine";
        session.components.push(componentSession);
        session.network.components.push({componentId: componentSession.componentId, networkLabel: "Temp Client"});
        session.componentIdToInitialize = componentSession.componentId;
        componentSession.forceKeepalive = true;
        this.sessions.push(componentSession);
        console.log(this.sessions);
        return session;
    }

    load(sessionId, sessionComponents, networkInfo)
    {

        for(const sc of sessionComponents)
        {

            if(sc.type !== "machine")
                continue;

            if (this.sessions.filter((sessionComp) => sessionComp.componentId === sc.componentId).length > 0)
                continue;
            
            let session = new ComponentSession(this.API_URL, sc.environmentId, sc.componentId, this.idToken);
            this.sessions.push(session);
        }

        this.network = new NetworkSession(this.API_URL, this.idToken);
        this.network.load(sessionId, this.sessions, networkInfo);
    }

    _connectEnvs2(environments, attachId) {
        var idsData = [];
        for (let i = 0; i < environments.length; i++) {
            $.ajax({
                type: "POST",
                url: this.API_URL + "/components",
                headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {},
                success: function (envData, status2, xhr2) {
                    idsData.push(envData);
                    if (environments[i].visualize == true) {
                        // console.log("this.componentId " + this.componentId);
                        if (this.componentId != null) {
                            console.error("We support visualization of only one environment at the time!! Visualizing the last specified...");
                            return;
                        }
                        this.componentId = envData.id;
                        this.driveId = envData.driveId;
                        this.removableMediaList = envData.removableMediaList;
                        var eventUrl = this.API_URL + "/components/" + envData.id + "/events";
                        if (localStorage.getItem('id_token'))
                            eventUrl += "?access_token=" + localStorage.getItem('id_token');
                        this.eventSource = new EventSource(eventUrl);
                    }
                },
                async: false,
                data: JSON.stringify(environments[i].data),
                contentType: "application/json"
            })
        }
        this._attachToSwitch(idsData[0], attachId);
    }

    _attachToSwitch(clientData, networkID) {
        $.ajax({
            type: "POST",
            url: this.API_URL + "/networks/" + networkID + "/addComponentToSwitch",
            data: JSON.stringify({
                componentId: clientData.id,
            }),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        }).then( (status, xhr) =>{
            this.isStarted = true;
            this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);
            },
            (xhr) => {
                this._onFatalError($.parseJSON(xhr.responseText));
                deferred.reject();
            });
    };

    async release() {

        console.log("released");
        this.disconnect();
        clearInterval(this.keepaliveIntervalId);

        if (this.network)
        {
            this.network.relase();
            return;
        }

        let url;
        for (const session of this.sessions) {
            url = await session.stop()
            await session.release();
        }
        this.sessions = [];
        return url;
    }

    /**
     * Method to support obsolete APIs and single environment sessions
     * @Deprecated
     * @param environmentId
     * @param args
     * @returns {*}
     */
    startEnvironment(environmentId, args, input_data) {
        var data = {};
        data.type = "machine";
        data.environment = environmentId;
        if (typeof input_data !== "undefined" && input_data != null) {
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
            if (args.lockEnvironment)
                data.lockEnvironment = true;
        }
        return this.start([{ data, visualize: true }], args);
    };

    getSession(id) {
        if (!this.network)
            throw new Error("no sessions available");

        return this.network.getSession(id);
    }

    // Connects viewer to a running session
    async connect(container, view) {
        if (!view && !this.activeView)
            throw new Error("no active view defined");

        if (view && this.activeView)
            this.disconnect();

        if (view)
            this.activeView = view;

        this.container = container;
        console.log(`Connecting viewer... @ ${this.container}`);
        try {
            let result = await this.activeView.getControlUrl();
            let connectViewerFunc, controlUrl;

            // Get the first ws+ethernet connector
            const entries = Object.entries(result).filter(([k]) => k.match(/^ws\+ethernet\+/));
            if (entries.length)
                this.ethernetURL = entries[0][1];

            // Guacamole connector?
            if (result.guacamole) {
                controlUrl = result.guacamole;
                this.params = strParamsToObject(result.guacamole.substring(result.guacamole.indexOf("#") + 1));
                connectViewerFunc = this._establishGuacamoleTunnel;
                this.mode = "guac";
            }
            // XPRA connector
            else if (result.xpra) {
                controlUrl = result.xpra;
                this.params = strParamsToObject(result.xpra.substring(result.xpra.indexOf("#") + 1));
                connectViewerFunc = this._prepareAndLoadXpra;
                this.mode = "xpra";
            }
            // WebEmulator connector
            else if (result.webemulator) {
                controlUrl = encodeURIComponent(JSON.stringify(result));
                this.params = strParamsToObject(data.webemulator.substring(result.webemulator.indexOf("#") + 1));
                connectViewerFunc = this._prepareAndLoadWebEmulator;
            }
            else {
                throw Error("Unsupported connector type: " + result);
            }
            // Establish the connection
            await connectViewerFunc.call(this, controlUrl);
            console.log("Viewer connected successfully.");
            this.isConnected = true;

            if (typeof result.audio !== "undefined")
                this.initWebRtcAudio(result.audio);

        }
        catch (e) {
            console.error("Connecting viewer failed!");
            console.log(e);
            this.activeView = undefined;
        }
    };

    async detach(name, detachTime_minutes, customComponentName) {
        if (!this.network)
            throw new Error("No network session available");

        this.network.detach(name, detachTime_minutes);
        window.onbeforeunload = () => { };
        this.disconnect();
    }

    async getProxyURL(
        {
            serverIP = this.tcpGatewayConfig.serverIp,
            serverPort = this.tcpGatewayConfig.serverPort,
            gatewayIP = "dhcp",
            localPort = "8080",
            localIP = "127.0.0.1",
        } = {}) {
        const eaasURL = new URL("web+eaas-proxy:");
        eaasURL.search = encodeURIComponent(JSON.stringify([
            `${localIP}:${localPort}`,
            await this.network.wsConnection(),
            "",
            gatewayIP,
            serverIP,
            serverPort,
        ]));
        return String(eaasURL);
    }

    downloadPrint(label) {
        return `${this.API_URL}/components/${this.componentId}/downloadPrintJob?label=${encodeURI(label)}`;
    }

    getPrintJobs(successFn, errorFn) {
        $.ajax({
            type: "GET",
            url: this.API_URL + formatStr("/components/{0}/printJobs", this.componentId),
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {},
            async: false,
        }).done(function (data, status, xhr) {
            successFn(data);
        }).fail(function (xhr) {
            if (errorFn)
                errorFn(xhr);
        });
    }

    stopEnvironment() {
        if (!this.isStarted)
            return;

        this.disconnect();
        for (const session of this.sessions) {
            session.stop();
        }

        $(this.container).empty();
    }

    async sendEsc()  {
        const pressKey = async (key, keyCode = key.toUpperCase().charCodeAt(0), 
            {altKey, ctrlKey, metaKey, timeout} = {timeout: 100}, el = document.getElementById("emulator-container").firstElementChild) => {
                el.dispatchEvent(new KeyboardEvent("keydown", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
                await new Promise(r => setTimeout(r, 100));
                el.dispatchEvent(new KeyboardEvent("keyup", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
        };
        pressKey("Esc", 27, {});
    }

    sendCtrlAltDel() 
    {
        const pressKey = async (key, keyCode = key.toUpperCase().charCodeAt(0), {altKey, ctrlKey, metaKey, timeout} = {timeout: 100}, el = document.getElementById("emulator-container").firstElementChild) => {
         if (ctrlKey) {
             el.dispatchEvent(new KeyboardEvent("keydown", {key: "Control", keyCode: 17, bubbles: true}));
             await new Promise(r => setTimeout(r, 100));
         }
         if (altKey) {
             el.dispatchEvent(new KeyboardEvent("keydown", {key: "Alt", keyCode: 18, bubbles: true}));
             await new Promise(r => setTimeout(r, 100));
         }
         el.dispatchEvent(new KeyboardEvent("keydown", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
         await new Promise(r => setTimeout(r, 100));
         el.dispatchEvent(new KeyboardEvent("keyup", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
         if (altKey) {
             await new Promise(r => setTimeout(r, 100));
             el.dispatchEvent(new KeyboardEvent("keyup", {key: "Alt", keyCode: 18, bubbles: true}));
         }
         if (ctrlKey) {
             await new Promise(r => setTimeout(r, 100));
             el.dispatchEvent(new KeyboardEvent("keyup", {key: "Control", keyCode: 17, bubbles: true}));
         }
        };
        pressKey("Delete", 46, { altKey: true, ctrlKey: true, metaKey: true })
    }

    snapshot(postObj, onChangeDone, errorFn) {
        $.ajax({
            type: "POST",
            url: this.API_URL + formatStr("/components/{0}/snapshot", this.activeView.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        }).then(function (data, status, xhr) {
            onChangeDone(data, status);
        }).fail(function (xhr, textStatus, error) {
            if (errorFn)
                errorFn(error);
            else {
                console.log(xhr.statusText);
                console.log(textStatus);
                console.log(error);
            }
        });
    };

    changeMedia(postObj, onChangeDone) {
        $.ajax({
            type: "POST",
            url: this.API_URL + formatStr("/components/{0}/changeMedia", this.componentId),
            data: JSON.stringify(postObj),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        }).then(function (data, status, xhr) {
            onChangeDone(data, status);
        });
    };

    _prepareAndLoadXpra(xpraUrl) {
        /*
         search for xpra path, in order to include it to filePath
         */
        var scripts = document.getElementsByTagName("script");
        for (var prop in scripts) {
            var searchingAim = "eaas-client.js";
            if (typeof (scripts[prop].src) != "undefined" && scripts[prop].src.indexOf(searchingAim) != -1) {
                var eaasClientPath = scripts[prop].src;
            }
        }
        if (typeof eaasClientPath == "undefined") {
            xpraPath = "xpra/";
        } else {
            var xpraPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "xpra/";
        }
        let vm = this;
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
                        vm.xpraClient = loadXpra(xpraUrl, xpraPath, vm.xpraConf, vm);
                    }
                    )
            })
    };

    _establishGuacamoleTunnel(controlUrl) {
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

        this.guac.onerror = function(status) {
            console.log("GUAC-ERROR-RESPONSE:", status.code, " -> ", status.message);
        }

        hideClientCursor(this.guac);
        this.container.insertBefore(displayElement, this.container.firstChild);

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
    }

    _prepareAndLoadWebEmulator(url) {
        /*
         search for eaas-client.js path, in order to include it to filePath
         */
        var scripts = document.getElementsByTagName("script");
        var eaasClientPath = "";
        for (var prop in scripts) {
            var searchingAim = "eaas-client.js";
            if (typeof (scripts[prop].src) != "undefined" && scripts[prop].src.indexOf(searchingAim) != -1) {
                var eaasClientPath = scripts[prop].src;
            }
        }
        var webemulatorPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "webemulator/";
        var iframe = document.createElement("iframe");
        iframe.setAttribute("style", "width: 100%; height: 600px;");
        iframe.src = webemulatorPath + "#controlurls=" + url;
        container.appendChild(iframe);
    };

    startDockerEnvironment(environmentId, args) {
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
            url: this.API_URL + "/components",
            data: JSON.stringify(data),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        })
            .then((data, status, xhr) => {
                console.log("Environment " + environmentId + " started.");
                this.componentId = data.id;
                this.driveId = data.driveId;
                this.removableMediaList = data.removableMediaList;
                this.isStarted = true;
                this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);
                deferred.resolve();
            },
                (xhr) => {
                    this._onFatalError($.parseJSON(xhr.responseText));
                    deferred.reject();
                });

        return deferred.promise();
    };


    // WebRTC based sound

    async initWebRtcAudio (url) {
        //const audioStreamElement = document.createElement('audio');
        //audioStreamElement.controls = true;
        //document.documentElement.appendChild(audioStreamElement);

        await fetch(url + '?connect', { method: 'POST' });

        const audioctx = new AudioContext();
        const rtcConfig = {
            iceServers: [

                { urls: "stun:stun.l.google.com:19302" }
            ]
        };

        console.log("Creating RTC peer connection...");
        this.rtcPeerConnection = new RTCPeerConnection(rtcConfig);

        this.rtcPeerConnection.onicecandidate = async (event) => {
            if (!event.candidate) {
                console.log("ICE candidate exchange finished!");
                return;
            }

            console.log("Sending ICE candidate to server...");

            const body = {
                type: 'ice',
                data: event.candidate
            };

            const request = {
                method: 'POST',
                body: JSON.stringify(body)
            };

            await fetch(url, request);
        };

        /*
        client.rtcPeerConnection.ontrack = async (event) => {
            console.log("XXXXXXXXXXXXXXXX ONTRACK: ", event);
            console.log("Remote track received");
            audioStreamElement.srcObject = event.streams[0];
            //audioctx.createMediaStreamSource(event.streams[0])
            //    .connect(audioctx.destination);
        };
        */

        this.rtcPeerConnection.onaddstream = async (event) => {
            console.log("Remote stream received");
            // HACK: Work around https://bugs.chromium.org/p/chromium/issues/detail?id=933677
            new Audio().srcObject = event.stream;
            audioctx.createMediaStreamSource(event.stream)
                .connect(audioctx.destination);
        };

        const onServerError = (reason) => {
            console.log("Stop polling control-messages! Reason:", reason);
        };

        const onServerMessage = async (response) => {
            if (!response.ok) {
                console.log("Stop polling control-messages, server returned:", response.status);
                return;
            }

            try {
                const message = await response.json();
                if (message) {
                    switch (message.type) {
                        case 'ice':
                            console.log("Remote ICE candidate received");
                            console.log(message.data.candidate);
                            const candidate = new RTCIceCandidate(message.data);

                            await this.rtcPeerConnection.addIceCandidate(candidate);
                            break;

                        case 'sdp':
                            console.log("Remote SDP offer received");
                            console.log(message.data.sdp);
                            const offer = new RTCSessionDescription(message.data);

                            await this.rtcPeerConnection.setRemoteDescription(offer);
                            const answer = await this.rtcPeerConnection.createAnswer();
                            await this.rtcPeerConnection.setLocalDescription(answer);
                            console.log("SDP-Answer: ", answer.sdp);

                            const body = {
                                type: 'sdp',
                                data: answer
                            };

                            const request = {
                                method: 'POST',
                                body: JSON.stringify(body)
                            };

                            console.log("Sending SDP answer...");
                            await fetch(url, request);

                            break;

                        case 'eos':
                            console.log("Stop polling control-messages");
                            return;

                        default:
                            console.error("Unsupported message type: " + message.type);
                    }
                }
            }
            catch (error) {
                console.log(error);
            }

            // start next long-polling request
            fetch(url).then(onServerMessage, onServerError);
        };

        fetch(url).then(onServerMessage);
    }
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
BWFLA.registerEventCallback = function (target, eventName, callback) {
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
        target[event] = function () {
            var params = arguments;  // Parameters to the original callback

            // Call all registered callbacks one by one
            callbacks.forEach(function (func) {
                func.apply(target, params);
            });
        };
    }
};


// Method to unregister a callback for an event
BWFLA.unregisterEventCallback = function (target, eventName, callback) {
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
var BwflaMouse = function (client) {
    var events = [];
    var handler = null;
    var waiting = false;


    /** Adds a state's copy to the current event-list. */
    function addEventCopy(state) {
        var copy = new Guacamole.Mouse.State(state.x, state.y, state.left,
            state.middle, state.right, state.up, state.down);

        events.push(copy);
    }

    /** Sets a new timeout-callback, replacing the old one. */
    function setNewTimeout(callback, timeout) {
        if (handler != null)
            window.clearTimeout(handler);

        handler = window.setTimeout(callback, timeout);
    }

    /** Handler, called on timeout. */
    function onTimeout() {
        while (events.length > 0)
            client.sendMouseState(events.shift());

        handler = null;
        waiting = false;
    };


    /** Handler for mouse-down events. */
    this.onmousedown = function (state) {
        setNewTimeout(onTimeout, 100);
        addEventCopy(state);
        waiting = true;
    };

    /** Handler for mouse-up events. */
    this.onmouseup = function (state) {
        setNewTimeout(onTimeout, 150);
        addEventCopy(state);
        waiting = true;
    };

    /** Handler for mouse-move events. */
    this.onmousemove = function (state) {
        if (waiting == true)
            addEventCopy(state);
        else client.sendMouseState(state);
    };
};

/** Requests a pointer-lock on given element, if supported by the browser. */
export function requestPointerLock(target, event) {
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

    function enableLockEventListener() {
        target.addEventListener(event, lockPointer, false);
    };

    function disableLockEventListener() {
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
export function hideClientCursor(guac) {
    var display = guac.getDisplay();
    display.showCursor(false);
}


/** Shows the layer containing client-side mouse-cursor. */
export function showClientCursor(guac) {
    var display = guac.getDisplay();
    display.showCursor(true);
};
