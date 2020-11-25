import {NetworkSession} from "./lib/networkSession.js"
import {ComponentSession} from "./lib/componentSession.js"
import {ClientError, sendEsc, sendCtrlAltDel, sendAltTab, _fetch, requestPointerLock} from "./lib/util.js"
import {prepareAndLoadXpra} from "./lib/xpraWrapper.js"
import EventTarget from "./third_party/event-target/esm/index.js"

export {sendEsc, sendCtrlAltDel, sendAltTab, requestPointerLock};
export {ClientError};

function strParamsToObject(str) {
    var result = {};
    if (!str) return result; // return on empty string

    str.split("&").forEach(function (part) {
        var item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
    });
    return result;
}

export class Client extends EventTarget {
    constructor(api_entrypoint, idToken = null) {
        super();
        this.API_URL = api_entrypoint.replace(/([^:])(\/\/+)/g, '$1/').replace(/\/+$/, '');
        this.container;
        this.idToken = idToken;

        this.deleteOnUnload = true;

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
            if(session.getNetwork() && !session.forceKeepalive)
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

    /* 
        needs to be a global client function, 
        we may checkpoint more then a single machine in the future.
    */
    async checkpoint(request) {
        let session = this.activeView;
        this.disconnect();
        return session.checkpoint(request);
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

    async attachNewEnv(sessionId, container, environmentRequest) 
    {
        let session =  await _fetch(`${this.API_URL}/sessions/${sessionId}`, "GET", null, this.idToken);   
        session.sessionId = sessionId;
        this.load(session);
        
        let componentSession = await this.createComponent(environmentRequest);
        this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);

        this._connectToNetwork(componentSession, sessionId);
        componentSession.forceKeepalive = true;

        this.network.sessionComponents.push(componentSession);
        this.network.networkConfig.components.push({componentId: componentSession.componentId, networkLabel: "Temp Client"});
        this.sessions.push(componentSession);

        await this.connect(container, componentSession);
    }

    async attach(sessionId, container, _componentId)
    {
        let session =  await _fetch(`${this.API_URL}/sessions/${sessionId}`, "GET", null, this.idToken);
        session.sessionId = sessionId;
        this.load(session);

        let componentSession;
        if(_componentId) {
            componentSession = this.getSession(_componentId);
        }
        this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);

        console.log("attching component:" + componentSession);
        await this.connect(container, componentSession);
    }

    async start(components, options) {
        if(options) {
            this.xpraConf.xpraEncoding = options.getXpraEncoding();
        }

        try {
            const promisedComponents = components.map(async component => {
                let componentSession = await this.createComponent(component);
                    this.sessions.push(componentSession);
                    if (component.isInteractive() === true) {
                        this.activeView = componentSession;
                    }
                    return componentSession;
            });
            this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);
            await Promise.all(promisedComponents);

            if (options && options.isNetworkEnabled()) {
                this.network = new NetworkSession(this.API_URL, this.idToken);
                await this.network.startNetwork(this.sessions, options);
            }
        }
        catch (e) {
            this.release(true);
            console.log(e);
            throw new ClientError("Starting environment session failed!", e);
        }
    }

    async createComponent(componentRequest) {
        try {
            let result = await _fetch(`${this.API_URL}/components`, "POST", componentRequest.build(), this.idToken);
            let component = new ComponentSession(this.API_URL, componentRequest.environment, result.id, this.idToken);
            component.setRemovableMediaList(result.removableMediaList);
            component.setSessionRequestInfo(componentRequest);
            console.log("Environment " + componentRequest.environment + " started.");

           return component;
        }
        catch (error) {
            throw new ClientError("Starting server-side component failed!", error);
        }
    }
    
    load(session)
    {
        const sessionId = session.sessionId;
        const sessionComponents = session.components;
        const networkInfo = session.network;

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

    async _connectToNetwork(component, networkID) {
        const result = await _fetch(`${this.API_URL}/networks/${networkID}/addComponentToSwitch`, "POST", 
            {
                componentId: component.getId(),
            },
            this.idToken);
        return result;
    }

    async release(destroyNetworks = false) {
        console.log("released: " + destroyNetworks);
        this.disconnect();
        clearInterval(this.pollStateIntervalId);

        if (this.network)
        {
            // we do not release by default network session, as they are detached by default
            if(destroyNetworks)
                await this.network.relase();
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

    getSession(id) {
        if (!this.network)
            throw new Error("no sessions available");

        return this.network.getSession(id);
    }

    getSessions() {
        if (!this.network) {
            return [];
        }

        const sessionInfo = [];
        let networkSessions = this.network.getSessions();

        for(let session of networkSessions)
        {
            const conf = this.network.getNetworkConfig(session.componentId);
            sessionInfo.push({
                id: conf.componentId,
                title: conf.networkLabel
            });
        }
        
        return sessionInfo;

    }

    // Connects viewer to a running session
    async connect(container, view) {
        if (!view) {
            console.log("no view defined. using first session");
            view = this.sessions[0];    
        }

        if (this.activeView)
            this.disconnect();

        if (!view)
            throw new Error("no active view possible");           
        
        this.activeView = view;

        this.container = container;
        console.log(`Connecting viewer... @ ${this.container}`);
        try {
            let result = await this.activeView.getControlUrl();
            let connectViewerFunc, controlUrl;
            let viewerData;

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
                connectViewerFunc = prepareAndLoadXpra;
                this.mode = "xpra";
                viewerData = this.xpraConf;
            }
            // WebEmulator connector
            else if (result.webemulator) {
                controlUrl = encodeURIComponent(JSON.stringify(result));
                this.params = strParamsToObject(result.webemulator.substring(result.webemulator.indexOf("#") + 1));
                connectViewerFunc = this._prepareAndLoadWebEmulator;
            }
            else {
                throw Error("Unsupported connector type: " + result);
            }
            // Establish the connection
            await connectViewerFunc.call(this, controlUrl, viewerData);
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

    async stop() {
        // let activeSession = this.activeView;
        let results = [];
        this.disconnect();
        for (const session of this.sessions) {
            let result = await session.stop();
            results.push({id: session.getId(), result: result});
        }

        $(this.container).empty();
        return results;
    }

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
                eaasClientPath = scripts[prop].src;
            }
        }
        var webemulatorPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "webemulator/";
        var iframe = document.createElement("iframe");
        iframe.setAttribute("style", "width: 100%; height: 600px;");
        iframe.src = webemulatorPath + "#controlurls=" + url;
        this.container.appendChild(iframe);
    }

    // WebRTC based sound
    async initWebRtcAudio (url) {
        //const audioStreamElement = document.createElement('audio');
        //audioStreamElement.controls = true;
        //document.documentElement.appendChild(audioStreamElement);

        await fetch(url + '?connect', { method: 'POST' });

        let _url = new URL(url);
        console.log("using host: " + _url.hostname + " for audio connection");
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        const audioctx = new AudioContext();

        let configuredIceServers = [
                { urls: 'stun:stun.l.google.com:19302'},
        ];

        if(_url.hostname !== "localhost") {
            configuredIceServers.push(
                {   urls: "turn:" + _url.hostname,
                    username: "eaas",
                    credential: "eaas"});
        }

        const rtcConfig = {
            iceServers: configuredIceServers
        }
        console.log("Creating RTC peer connection...");
        this.rtcPeerConnection = new RTCPeerConnection(rtcConfig);

        this.rtcPeerConnection.onicecandidate = async (event) => {
            if (!event.candidate) {
                console.log("ICE candidate exchange finished!");
                return;
            }

            console.log("Sending ICE candidate to server...", event.candidate);

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


/** Hides the layer containing client-side mouse-cursor. */
export function hideClientCursor(guac) {
    var display = guac.getDisplay();
    display.showCursor(false);
}


/** Shows the layer containing client-side mouse-cursor. */
export function showClientCursor(guac) {
    var display = guac.getDisplay();
    display.showCursor(true);
}
