import {_fetch} from "./util.js"

export class ComponentSession extends EventTarget {

    constructor(api, environmentId, componentId, idToken = null) {
        super();

        this.API_URL = api;
        this.idToken = idToken;
        this.environmentId = environmentId;
        this.componentId = componentId;
        this.driveId = -1;
        this.removableMediaList = null;

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

    setNetworkId(nwId) {
        this.networkId = nwId;
    }

    static async startComponent(api, environmentRequest, idToken) {
        try {
            let result = await _fetch(`${api}/components`, "POST", environmentRequest, idToken);

            this.componentId = result.id;
            
            this.driveId = result.driveId;
            this.removableMediaList = result.removableMediaList;
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

    getNetworkId()
    {
        return this.networkId;
    }

    async keepalive() {
        if (this.networkId && !this.forceKeepalive) // if part of an network, network session will take care
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
        let res = _fetch(`${this.API_URL}/components/${this.componentId}/stop`, "GET", null, this.idToken);
        this.isStarted = false;
        console.log("stop: " + res);
        return res;
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