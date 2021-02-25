import {
    _fetch,
    ClientError
} from "./util.js";
import EventTarget from "../third_party/event-target/esm/index.js";
/**
 *
 *
 * @export
 * @class ComponentSession
 * @extends {EventTarget}
 * @param api
 * @param environmentId
 * @param componentId
 * @param [idToken=null]
 */
export class ComponentSession extends EventTarget {
    constructor(api, environmentId, componentId, idToken = null) {
        super();

        this.API_URL = api;
        this.idToken = idToken;
        this.environmentId = environmentId;
        this.componentId = componentId;
        this.removableMediaList = null;

        this.request = null;

        this.eventSource = null;

        this.hasNetworkSession = false;
        this.released = false;
        this.emulatorState = undefined;

        this.network = undefined;

        let eventUrl = this.API_URL + "/components/" + this.componentId + "/events";
        if (idToken) {
            // TODO: idToken() might return a `Promise`
            // (which cannot be awaited in a constructor).
            const access_token = typeof idToken === "function" ? idToken() : idToken;
            eventUrl += `?${new URLSearchParams({access_token})}`;
        }

        this.eventSource = new EventSource(eventUrl);

        this.isStarted = true;
    }
    /**
     * 
     *
     * @static
     * @param {ComponentBuilder} componentRequest
     * @param api
     * @param idToken
     * @return
     * @memberof ComponentSession
     */
    static async createComponent(componentRequest, api, idToken) {
        try {

            let result = await _fetch(`${api}/components`, "POST", componentRequest.build(), idToken);
            let component = new ComponentSession(api, componentRequest.environment, result.id, idToken);
            component.setRemovableMediaList(result.removableMediaList);
            component.setSessionRequestInfo(componentRequest);
            console.log("Environment " + componentRequest.environment + " started.");

            return component;
        } catch (error) {
            throw new ClientError("Starting server-side component failed!", error);
        }
    }

    /**
     *
     *
     * @param network
     * @memberof ComponentSession
     */
    setNetwork(network) {
        this.network = network;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    getId() {
        return this.componentId;
    }
    /**
     *
     *
     * @param req
     * @memberof ComponentSession
     */
    setSessionRequestInfo(req) {
        this.request = req;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    getNetwork() {
        return this.network;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    hasSharedNetworkPorts() {
        if (!this.network)
            return false;

        let config = this.network.getNetworkConfig(this.componentId);
        if (!config)
            return false;

        let configuredPorts = config.serverPorts;
        if (!configuredPorts || configuredPorts.length < 1)
            return false;

        if (!config.fqdn && !config.serverIp)
            return false;

        return true;
    }
    /**
     *
     *
     * @param [{
     *         serverIp = null,
     *         serverPort = null,
     *         gatewayIP = "dhcp",
     *         localPort = "8080",
     *         localIP = "127.0.0.1",
     *     }={}]
     * @return
     * @memberof ComponentSession
     */
    async getProxyURL({
        serverIp = null,
        serverPort = null,
        gatewayIP = "dhcp",
        localPort = "8080",
        localIP = "127.0.0.1",
    } = {}) {

        if (!this.network)
            throw new Error("This component is not part of a network");

        let config = this.network.getNetworkConfig(this.componentId);
        if (!config)
            throw new Error("This component has no network configurations");

        let configuredPorts = config.serverPorts;
        if (!configuredPorts || configuredPorts.length < 1)
            throw new Error("No public port configured");

        if (serverPort && !configuredPorts.contains(serverPort))
            throw new Error("Server port " + serverPort + "not configured. Configured ports " + configuredPorts.toString());

        if (!serverPort)
            serverPort = configuredPorts[0];

        if (!serverIp)
            serverIp = config.fqdn;

        if (!serverIp)
            serverIp = config.serverIp;

        if (!serverIp || !serverPort)
            throw Error("TCP gateway is not configured: target IP:PORT is required");

        return this._getProxyURLRaw({
            serverIp,
            serverPort,
            gatewayIP,
            localPort,
            localIP
        });
    }

    async _getProxyURLRaw({
        serverIp,
        serverPort,
        gatewayIP,
        localPort,
        localIP
    }) {
        const eaasURL = new URL("web+eaas-proxy:");
        eaasURL.search = encodeURIComponent(JSON.stringify([
            `${localIP}:${localPort}`,
            await this.network.wsConnection(),
            "",
            gatewayIP,
            serverIp,
            serverPort,
        ]));
        return String(eaasURL);
    }

    /**
     *
     *
     * @param mediaList
     * @memberof ComponentSession
     */
    setRemovableMediaList(mediaList) {
        this.removableMediaList = mediaList;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    getRemovableMediaList() {
        return this.removableMediaList;
    }


    /**
     * Create a new derivate 
     *
     * @param {SnapshotRequestBuilder} snapshotRequest
     * @param networkEnvironmentId
     * @return
     * @memberof ComponentSession
     */
    async cerateSnapshot(snapshotRequest) {

        let postRequest = snapshotRequest.build();

        postRequest.envId = this.environmentId;
        if(this.request)
        {
            if(this.request.object)
                postReq.objectId = this.request.object;
            
            if(this.request.software)
                postReq.softwareId = this.request.software;
        }

        let result = await _fetch(`${this.API_URL}/components/${this.componentId}/snapshot`, "POST", postObj, this.idToken);

        if (result.status === "1")
            throw new Error("failed creating snapshot: " + result.message);
            
        return result;
    }

    /**
     * Create a new derivate 
     *
     * @deprecated
     * @param postObj
     * @param networkEnvironmentId
     * @return
     * @memberof ComponentSession
     */
    async snapshot(postObj, networkEnvironmentId) {
        postObj.envId = this.environmentId;
        let result = await _fetch(`${this.API_URL}/components/${this.componentId}/snapshot`, "POST", postObj, this.idToken);

        if (result.status === "1")
            throw new Error("failed creating snapshot: " + result.message);

        if (this.network && networkEnvironmentId) {
            this.network.updateNetwork(networkEnvironmentId, this.environmentId, result.envId);
        }

        return result;
    }
    /**
     *
     *
     * @param postObj
     * @return
     * @memberof ComponentSession
     */
    async changeMedia(postObj) {
        return _fetch(`${this.API_URL}/components/${this.componentId}/changeMedia`, "POST", postObj, this.idToken);
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async getControlUrl() {
        if (!this.isStarted) {
            throw new Error("Environment was not started properly!");
        }
        if (this.isAbort)
            throw new Error("Environment has be stopped");

        return _fetch(`${this.API_URL}/components/${this.componentId}/controlurls`, "GET", undefined, this.idToken);
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async keepalive() {
        if (this.network && !this.forceKeepalive) // if part of an network, network session will take care
            return;

        const url = `${this.API_URL}/components/${this.componentId}/keepalive`;
        _fetch(url, "POST", null, this.idToken);
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async getEmulatorState() {
        if (this.isStarted)
            return _fetch(`${this.API_URL}/components/${this.componentId}/state`, "GET", null, this.idToken);
        else return null;
    }
    /**
     *
     *
     * @memberof ComponentSession
     */
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }

        if (this.peer_connection != null)
            this.peer_connection.close();
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async stop() {
        let res = _fetch(`${this.API_URL}/components/${this.componentId}/stop`, "GET", null, this.idToken);
        this.isStarted = false;
        return res;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async release() {
        if (!this.componentId)
            return;

        if (this.network) // network session takes care
            return;

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }

        _fetch(`${this.API_URL}/components/${this.componentId}`, "DELETE", null, this.idToken);
        this.componentId = undefined;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async getContainerResultUrl() {
        // console.log(this.componentId);
        if (this.componentId == null) {
            throw new Error("Component ID is null, please contact administrator");
        }

        return _fetch(`${this.API_URL}/components/${this.componentId}/result`, "GET", null, this.idToken);
    }

    /**
     * Checkpoints a running session
     *
     * @param request
     * @return
     * @memberof ComponentSession
     */
    async checkpoint(request) {
        if (!this.isStarted) {
            throw new Error("Environment was not started properly!");
        }

        if (this.network) {
            // Remove the main component from the network group first!
            await this.network.remove(this.componentId);
        }

        try {
            console.log("Checkpointing session...");
            let result = await _fetch(`${this.API_URL}/components/${this.componentId}/checkpoint`, "POST", request, this.idToken);
            if (result.status === "1")
                throw new Error(result.message);
            console.log("Checkpoint created: " + result.envId);
            return result.envId;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }
    /**
     *
     *
     * @param label
     * @return
     * @memberof ComponentSession
     */
    downloadPrint(label) {
        return `${this.API_URL}/components/${this.componentId}/downloadPrintJob?${new URLSearchParams({label})}`;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentSession
     */
    async getPrintJobs() {
        return _fetch(`${this.API_URL}/components/${this.componentId}/printJobs`, "GET", null, this.idToken);
    }
}

export class SnapshotRequestBuilder {
    constructor(type) {
        this.type = type;
        this.message = undefined;
        this.title = undefined;
        this.isRelativeMouse = undefined;
        this.cleanRemovableDrives = undefined;
    }

    setMessage(m) {
        this.message = m;
    } 

    setTitle(t) {
        this.title = t;
    }

    enableRelativeMouse(b=true)
    {
        this.isRelativeMouse = b;
    }

    removeVolatileDrives(b = true)
    {
        this.cleanRemovableDrives = b;
    }
}

/**
 *
 *
 * @export
 * @class SaveRevisionRequest
 * @extends {SnapshotRequestBuilder}
 */
export class SaveRevisionRequest extends SnapshotRequestBuilder{
    constructor(message)
    {
        super("saveRevision");
        this.message = message;
    }
}

/**
 *
 *
 * @export
 * @class SaveObjectEnvironmentRequest
 * @extends {SnapshotRequestBuilder}
 */
export class SaveObjectEnvironmentRequest extends SnapshotRequestBuilder {
    constructor(title, message)
    {
        super("objectEnvironment");
        this.title = title;
        this.message = message;
    }
}

/**
 *
 *
 * @export
 * @class SaveNewEnvironmentRequest
 * @extends {SnapshotRequestBuilder}
 */
export class SaveNewEnvironmentRequest extends SnapshotRequestBuilder {
    constructor(title, message)
    {
        super("newEnvironment");
        this.title = title;
        this.message = message;
    }
}

/**
 *
 *
 * @export
 * @class SaveImportRequest
 * @extends {SnapshotRequestBuilder}
 */
export class SaveImportRequest extends SnapshotRequestBuilder {
    constructor(title)
    {
        super("saveImport");
        this.title = title;
    }
}

/**
 *
 *
 * @export
 * @class SaveUserSessionRequest
 * @extends {SnapshotRequestBuilder}
 */
export class SaveUserSessionRequest extends SnapshotRequestBuilder {
    constructor()
    {
        super("saveUserSession");
    }
}

