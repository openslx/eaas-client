
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

async function _fetch(url, method = "GET", obj, token = null) {
    let header = {};
    let body = undefined;
    if (token) header.authorization = `Bearer ${token}`;
    if (obj) {
        header['content-type'] = "application/json";
        body = JSON.stringify(obj);
    }

    const res = await fetch(url, {
        method,
        headers: header,
        body: body,
    });
    if (res.ok) {
        try {
            return await res.json();
        } catch (e) {
            return;
        }
    }

    throw new Error(`${res.status} @ ${url} : ${await res.text()}`);
}

export class NetworkSession extends EventTarget {
    constructor(api, idToken = null) {
        super();
        this.sessionId = undefined;
        this.API_URL = api;
        this.idToken = idToken;
        this.sessionComponents = [];
        this.isDetached = false;
    }

    async keepalive() {
        if (!this.sessionId || this.isDetached)
            return;
        _fetch(`${this.API_URL}/sessions/${this.sessionId}/keepalive`, "POST", null, this.idToken);
    }

    async relase() {
        if (!this.sessionId || this.isDetached)
            return;

        _fetch(`${this.API_URL}/sessions/${this.sessionId}`, "DELETE", null, this.idToken);
        this.sessionId = undefined;
    }

    async wsConnection() {
        console.log("this.networkId", this.sessionId);

        if (this.sessionId == null) {
            return null;
        }
        const url = `${this.API_URL}/networks/${this.sessionId}/wsConnection`;
        console.log("this.idToken", this.idToken);
        const res = await _fetch(url, "GET", null, this.idToken);
        console.log("res ", res);

        if (!res.ok)
            throw new Error(await res.text());

        const url2 = new URL(res.wsConnection, this.API_URL);
        if (url2.port === "443")
            url2.protocol = "wss";
        return String(url2);
    }

    load(sessionId, sessions, options)
    {
        this.isDetached = true;
        this.sessionId = sessionId;
        for (const session of sessions) {
            this.sessionComponents.push(session);
            session.setNetworkId(session);
        }
    }

    async startNetwork(sessions, options) {
        const components = [];
        console.log("!!!!!!!!! sessions", sessions);

        for (const session of sessions) {
            components.push({
                componentId: session.componentId,
                serverPorts: session.serverPorts,
                serverIp: session.serverIp,
                networkLabel: session.networkLabel ? session.networkLabel : undefined,
                hwAddress: session.hwAddress ? session.hwAddress : "auto",
            });
            this.sessionComponents.push(session);
        }

        let obj = {
            components: components,
            hasInternet: options.enableInternet ? true : false,
            enableDhcp: true,
            gateway: options.gateway,
            dhcpNetworkAddress: options.dhcpNetworkAddress,
            dhcpNetworkMask: options.dhcpNetworkMask,
            hasTcpGateway: options.hasTcpGateway ? true : false,
            tcpGatewayConfig: options.tcpGatewayConfig ? options.tcpGatewayConfig : {}
        };
        let result = await _fetch(`${this.API_URL}/networks`, "POST", obj, this.idToken);
        this.sessionId = result.id;
        this.networkTcpInfo = result.networkUrls != null ? result.networkUrls.tcp : null;

        for (const session of this.sessionComponents) {
            session.setNetworkId(this.sessionId);
        }
    }

    getSession(id)
    {
        for(let session of this.sessionComponents)
        {
            if(session.componentId === id)
                return session;
        }
        throw new Error("session not found");
    }

    async detach(name, detachTime_minutes) {
        if (this.isDetached)
            return;

        let res = await _fetch(`${this.API_URL}/sessions/${this.sessionId}/detach`, "POST", {
            lifetime: detachTime_minutes,
            lifetime_unit: "minutes",
            sessionName: name,
        }, this.idToken);
        this.isDetached = true;
    }
}

export class ComponentSession extends EventTarget {

    constructor(api, environmentId, componentId, idToken = null) {
        super();

        this.API_URL = api;
        this.idToken = idToken;
        this.environmentId = environmentId;
        this.componentId = componentId;
        this.driveId = -1;

        this.eventSource = null;

        this.hasNetworkSession = false;
        this.released = false;
        this.emulatorState = undefined;

        this.networkId = undefined;

        let eventUrl = this.API_URL + "/components/" + this.componentId + "/events";
        if (this.idToken)
            eventUrl += "?access_token=" + this.idToken;

        this.eventSource = new EventSource(eventUrl);
        
        this.isStarted = true;
    }

    setdriveId(id)
    {
        this.driveId = id;
    }

    setNetworkId(nwId) {
        this.networkId = nwId;
    }

    static async startComponent(api, environmentRequest, idToken) {
        try {
            let result = await _fetch(`${api}/components`, "POST", environmentRequest, idToken);

            this.componentId = result.id;
            
            this.driveId = result.driveId;
            let component = new ComponentSession(api, environmentRequest.environment, result.id, idToken);
            console.log("Environment " + environmentRequest.environment + " started.");

           return component;
        }
        catch (e) {
            throw new Error("failed to start environmemt: " + e);
        }
    }

    async getControlUrl() {
        if (!this.isStarted) {
            throw new Error("Environment was not started properly!");
        }
        if (this.isAbort)
            throw new Error("Environment has be stopped");

        return _fetch(`${this.API_URL}/components/${this.componentId}/controlurls`, "GET", undefined, this.idToken);
    }

    async keepalive() {
        if (this.networkId) // if part of an network, network session will take care
            return;

        const url = `${this.API_URL}/components/${this.componentId}/keepalive`;
        _fetch(url, "POST", null, this.idToken);
    };

    async getEmulatorState() {
        if (this.isStarted)
            return _fetch(`${this.API_URL}/components/${this.componentId}/state`, "GET", null, this.idToken);
        else return null;
    }

    disconnect()
    {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }

        if (this.peer_connection != null)
            this.peer_connection.close();
    }

    async stop() {
        _fetch(`${this.API_URL}/components/${this.componentId}/stop`, "GET", null, this.idToken);
        this.isStarted = false;
    }

    async release() {
        if (!this.componentId)
            return;

        if (this.networkId) // network session takes care
            return;

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }

        _fetch(`${this.API_URL}/components/${this.componentId}`, "DELETE", null, this.idToken);
        this.componentId = undefined;
    }

    getContainerResultUrl() {
        // console.log(this.componentId);
        if (this.componentId == null) {
            this.onError("Component ID is null, please contact administrator");
        }
        return this.API_URL + formatStr("/components/{0}/result", this.componentId);
    }
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
            return;
        }

        for (const session of this.sessions) {
            let result = await session.getEmulatorState();
            if (!result)
                continue;

            let emulatorState = result.state;

            if (emulatorState == "OK")
                session.keepalive();
            else if (emulatorState == "STOPPED" || emulatorState == "FAILED") {
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
    };

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
            this.pollStateIntervalId = setInterval(() => { this.pollState(); }, 1500);
            deferred.resolve();
        },
            function (xhr) {
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

    load(sessionId, sessionComponents, networkInfo)
    {
        for(const sc of sessionComponents)
        {
            if(sc.type !== "machine")
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
        // console.log("clientData.id " + clientData.id);
        $.ajax({
            type: "POST",
            url: this.API_URL + "/networks/" + networkID + "/addComponentToSwitch",
            data: JSON.stringify({
                componentId: clientData.id,
            }),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        }).then(function (status, xhr) {
            this.isStarted = true;
            this.pollStateIntervalId = setInterval(() => { this.pollState(); }, 1500);
            deferred.resolve();
        },
            function (xhr) {
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

        for (const session of this.sessions) {
            await session.stop()
            await session.release();
        }
        this.sessions = [];
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

    async _removeNetworkComponent(netid, compid) {
        console.log("Removing component " + compid + " from network " + netid);
        try {
            await $.ajax({
                type: "DELETE",
                url: this.API_URL + formatStr("/networks/{0}/components/{1}", netid, compid),
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

    // Checkpoints a running session
    async checkpoint(request) {
        if (!this.isStarted) {
            this._onFatalError("Environment was not started properly!");
            throw undefined;
        }

        if (this.networkId != null) {
            // Remove the main component from the network group first!
            await this._removeNetworkComponent(this.networkId, this.componentId);
        }

        console.log("Checkpointing session...");
        try {
            const data = await $.ajax({
                type: "POST",
                url: this.API_URL + formatStr("/components/{0}/checkpoint", this.componentId),
                timeout: 60000,
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
    };

    sendEsc() {
        this.guac.sendKeyEvent(1, 0xff1b);
        this.guac.sendKeyEvent(0, 0xff1b);
    };


    async sendCtrlAltDel() {
        const pressKey = async (key, keyCode = key.toUpperCase().charCodeAt(0), { altKey, ctrlKey, metaKey, timeout } = { timeout: 100 }, el = document.getElementById("emulator-container").firstElementChild) => {
            if (ctrlKey) {
                el.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", keyCode: 17, bubbles: true }));
                await new Promise(r => setTimeout(r, 100));
            }
            if (altKey) {
                el.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", keyCode: 18, bubbles: true }));
                await new Promise(r => setTimeout(r, 100));
            }
            el.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode, ctrlKey, altKey, metaKey, bubbles: true }));
            await new Promise(r => setTimeout(r, 100));
            el.dispatchEvent(new KeyboardEvent("keyup", { key, keyCode, ctrlKey, altKey, metaKey, bubbles: true }));
            if (altKey) {
                await new Promise(r => setTimeout(r, 100));
                el.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", keyCode: 18, bubbles: true }));
            }
            if (ctrlKey) {
                await new Promise(r => setTimeout(r, 100));
                el.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", keyCode: 17, bubbles: true }));
            }
        };
        pressKey("Delete", 46, { altKey: true, ctrlKey: true, metaKey: true })
    };

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
            .then(function (data, status, xhr) {
                console.log("Environment " + environmentId + " started.");
                this.componentId = data.id;
                this.driveId = data.driveId;
                this.isStarted = true;
                this.pollStateIntervalId = setInterval(() => { this.pollState(); }, 1500);
                deferred.resolve();
            },
                function (xhr) {
                    this._onFatalError($.parseJSON(xhr.responseText));
                    deferred.reject();
                });

        return deferred.promise();
    };


    // WebRTC based sound

    initWebRtcAudio (url) {
        //const audioStreamElement = document.createElement('audio');
        //audioStreamElement.controls = true;
        //document.documentElement.appendChild(audioStreamElement);

        const audioctx = new AudioContext();

        const rtcConfig = {
            iceServers: [

                { urls: "stun:stun.l.google.com:19302" }
            ]
        };

        console.log("Creating RTC peer connection...");

        this.rtcPeerConnection = new RTCPeerConnection(rtcConfig);

        this.rtcPeerConnection.onicecandidate = async (event) => {
            if (event.candidate == null) {
                console.log("No ICE candidate found!");
                client.rtcPeerConnection.connected = true;
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

        const onServerMessage = async (response) => {
            try {
            const message = await response.json();
            if (message) {
                try {
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

                        default:
                            console.error("Unsupported message type: " + message.type);
                    }
                }
                catch (error) {
                    console.log(error);
                }
            }
            
        }
        catch(error) {}

            // start next long-polling request
            if (client.rtcPeerConnection.connected)
                console.log("Stop polling control-messages");
            else 
            fetch(url).then(onServerMessage);

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
