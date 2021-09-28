import {
    ClientError,
    _fetch
} from './util.js';
import EventTarget from "../third_party/event-target/esm/index.js";
/**
 *
 *
 * @export
 * @class NetworkSession
 * @extends {EventTarget}
 * @param api
 * @param [idToken=null]
 */
export class NetworkSession extends EventTarget {

    constructor(api, idToken = null) {
        super();
        this.sessionId = undefined;
        this.API_URL = api;
        this.idToken = idToken;
        this.sessionComponents = [];
        this.networkConfig = null;
    }
    /**
     *
     *
     * @return
     * @memberof NetworkSession
     */
    async keepalive() {
        if (!this.sessionId)
            return;
        _fetch(`${this.API_URL}/sessions/${this.sessionId}/keepalive`, "POST", null, this.idToken);
    }
    /**
     *
     *
     * @return
     * @memberof NetworkSession
     */
    async release() {
        if (!this.sessionId)
            return;

        await _fetch(`${this.API_URL}/sessions/${this.sessionId}`, "DELETE", null, this.idToken);
        this.sessionId = undefined;
    }
    /**
     *
     *
     * @return
     * @memberof NetworkSession
     */
    async wsConnection() {

        if (this.sessionId == null) {
            return null;
        }
        const url = `${this.API_URL}/networks/${this.sessionId}/wsConnection`;
        const res = await _fetch(url, "GET", null, this.idToken);

        if (!res.ok)
            throw new Error(await res.text());

        const url2 = new URL(res.wsConnection, this.API_URL);
        if (url2.port === "443")
            url2.protocol = "wss";
        return String(url2);
    }
    /**
     *
     *
     * @param sessionId
     * @param sessions
     * @param options
     * @memberof NetworkSession
     */
    load(sessionId, sessions, options) {
        this.sessionId = sessionId;
        for (const session of sessions) {
            this.sessionComponents.push(session);
            session.setNetwork(this);
        }
        this.networkConfig = options;
    }
    /**
     *
     *
     * @param componentId
     * @return
     * @memberof NetworkSession
     */
    getNetworkConfig(componentId) {
        for (let compConfig of this.networkConfig.components) {
            if (compConfig.componentId === componentId)
                return compConfig;
        }
        return null;
    }
    /**
     *
     *
     * @param sessions
     * @param options
     * @memberof NetworkSession
     */
    async startNetwork(sessions, options) {
        for (const session of sessions) {
            let netComponent = session.request.getNetworkConfig();
            if (!netComponent) {
                console.log("network session component not configured");
                continue;
            }
            netComponent.setComponentId(session.componentId);
            options.getNetworkConfig().addNetworkComponent(netComponent);
            this.sessionComponents.push(session);
        }

        let result = await _fetch(`${this.API_URL}/networks`, "POST", options.getNetworkConfig().build(), this.idToken);
        this.sessionId = result.id;
        this.networkConfig = options.getNetworkConfig().build();
        this.networkTcpInfo = result.networkUrls != null ? result.networkUrls.tcp : null;
        for (const session of this.sessionComponents) {
            session.setNetwork(this);
        }
    }

    /**
     *
     *
     * @return
     * @memberof NetworkSession
     */
    getId() {
        return this.sessionId;
    }

    async disconnect(compid) {
        console.log("disconnect component " + compid + " from network " + this.sessionId);
        await _fetch(`${this.API_URL}/networks/${this.sessionId}/disconnect/${compid}`, "POST", null, this.idToken);
    }

    async remove(compid) {
        console.log("Removing component " + compid + " from network " + this.sessionId);
        await _fetch(`${this.API_URL}/networks/${this.sessionId}/components/${compid}`, "DELETE", null, this.idToken);
    }
    /**
     *
     *
     * @param id
     * @return
     * @memberof NetworkSession
     */
    getSession(id) {
        for (let session of this.sessionComponents) {
            if (session.componentId === id)
                return session;
        }
        throw new Error("session not found");
    }
    /**
     *
     *
     * @return
     * @memberof NetworkSession
     */
    getSessions() {
        return this.sessionComponents;
    }
    /**
     *
     *
     * @param netEnvId
     * @param oldEnv
     * @param newEnv
     * @return
     * @memberof NetworkSession
     */
    async updateNetwork(netEnvId, oldEnv, newEnv) {
        try {
            let net = await _fetch(`${this.API_URL}/network-environments/${netEnvId}`, "GET", null, this.idToken);

            net.emilEnvironments.forEach(element => {
                if (element.envId === oldEnv)
                    element.envId = newEnv;
            });

            let result = await _fetch(`${this.API_URL}/network-environments`, "POST", net, this.idToken);
            return result;
        } catch (e) {
            throw new ClientError("update network failed", e);
        }
    }
    /**
     *
     *
     * @param name
     * @param detachTime_minutes
     * @memberof NetworkSession
     */
    async detach(name, detachTime_minutes) {
        console.log("detaching session " + this.sessionId);
        let res = await _fetch(`${this.API_URL}/sessions/${this.sessionId}/detach`, "POST", {
            lifetime: detachTime_minutes,
            lifetime_unit: "minutes",
            sessionName: name,
        }, this.idToken);
    }
}