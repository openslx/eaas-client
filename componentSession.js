import {_fetch} from "./util.js"

export class ComponentSession extends EventTarget {

    constructor(api, environmentId, componentId, idToken = null) {
        super();

        this.API_URL = api;
        this.idToken = idToken;
        this.environmentId = environmentId;
        this.componentId = componentId;
        this.removableMediaList = null;

        this.eventSource = null;

        this.hasNetworkSession = false;
        this.released = false;
        this.emulatorState = undefined;

        this.network = undefined;

        let eventUrl = this.API_URL + "/components/" + this.componentId + "/events";
        if (this.idToken)
            eventUrl += "?access_token=" + this.idToken;

        this.eventSource = new EventSource(eventUrl);
        
        this.isStarted = true;
    }

    setNetwort(network) {
        this.network = network;
    }

    getNetwork()
    {
        return this.network;
    }

    getRemovableMediaList() {
        return this.removableMediaList;
    }

    static async startComponent(api, environmentRequest, idToken) {
        try {
            let result = await _fetch(`${api}/components`, "POST", environmentRequest, idToken);
            let component = new ComponentSession(api, environmentRequest.environment, result.id, idToken);
            component.removableMediaList = result.removableMediaList;
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
        if (this.network && !this.forceKeepalive) // if part of an network, network session will take care
            return;

        const url = `${this.API_URL}/components/${this.componentId}/keepalive`;
        _fetch(url, "POST", null, this.idToken);
    }

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

        if (this.network) // network session takes care
            return;

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }

        _fetch(`${this.API_URL}/components/${this.componentId}`, "DELETE", null, this.idToken);
        this.componentId = undefined;
    }

    async getContainerResultUrl() {
        // console.log(this.componentId);
        if (this.componentId == null) {
            throw new Error("Component ID is null, please contact administrator");
        }

        return _fetch(`${this.API_URL}/components/${this.componentId}/result`, "GET", null, this.idToken)
    }

    // Checkpoints a running session
    async checkpoint(request) {
        if (!this.isStarted) {
            throw new Error("Environment was not started properly!");
        }

        if (this.network) {
            // Remove the main component from the network group first!
            await this.network.remove(this.componentId);
        }

        console.log("Checkpointing session...");
        let result = await _fetch(`${this.API_URL}/components/${this.componentId}/checkpoint`, "POST", request, this.idToken);
        console.log("Checkpoint created: " + result.envId);
        return result.envId;
    }
}