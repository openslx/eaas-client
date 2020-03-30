import {_fetch} from './util.js'

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
            networkEnvironmentId: options.envId ? options.envId : undefined,
            components: components,
            hasInternet: options.enableInternet ? true : false,
            enableDhcp: true,
            gateway: options.gateway,
            network: options.network,
            dhcpNetworkAddress: options.dhcpNetworkAddress,
            dhcpNetworkMask: options.dhcpNetworkMask,
            hasTcpGateway: options.hasTcpGateway ? true : false,
            tcpGatewayConfig: options.tcpGatewayConfig ? options.tcpGatewayConfig : {}
        };
        let result = await _fetch(`${this.API_URL}/networks`, "POST", obj, this.idToken);
        this.sessionId = result.id;
        this.networkTcpInfo = result.networkUrls != null ? result.networkUrls.tcp : null;

        for (const session of this.sessionComponents) {
            session.setNetwork(this);
        }
    }

    getId()
    {
        return this.sessionId;
    }


    async remove(compid) {
        console.log("Removing component " + compid + " from network " + this.sessionId);
        await _fetch(`${this.API_URL}/networks/${this.sessionId}/components/${compid}`, "DELETE", null, this.idToken);
        console.log("Component removed: " + compid);
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