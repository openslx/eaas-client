import {ClientError, _fetch} from './util.js'
import { ClientOptions, NetworkComponentConfig } from "./clientOptions.js";
import { MachineComponentBuilder } from "./componentBuilder.js"

export class NetworkUtils {
    constructor(api, idToken = null) {
        this.API_URL = api;
        this.idToken = idToken;
    }

    async getNetworkEnvironment(id)
    {
        return  _fetch(`${this.API_URL}/network-environments/${id}`, "GET", null, this.idToken);
    }

    async getSessions() 
    {
        return  _fetch(`${this.API_URL}/sessions`, "GET", null, this.idToken);
    }

    async getSession(sessionKey)
    {
        let sessions = await this.getSessions();
        if(!sessions)
            throw new Error("no sessions found");

        const session = sessions.find((s) => (s.name === sessionKey));
        if(session)
            return session;
        else
            throw new Error ("session not found " + sessions + " key " + sessionKey);
    }


    async initNetworkSession(client, networkId, sessionKey)
    {
        const networkEnvironment = await this.getNetworkEnvironment(networkId);
        const clientOptions = new ClientOptions(networkEnvironment);
        let components = [];

        for (const networkElement of networkEnvironment.emilEnvironments) {
            let env = await _fetch(`${this.API_URL}/environment-repository/environments/${networkElement.envId}`, "GET", null, this.idToken);
            
            let component = new MachineComponentBuilder(env.envId, env.archive);
            component.setEthernetAddress(networkElement.macAddress);
            component.setObject(env.objectId, env.objectArchive);

            if(networkElement.toVisualize) {
                component.setInteractive();
            }
    
            let networkComponentConfig = new NetworkComponentConfig(networkElement.label, networkElement.macAddress);
            networkComponentConfig.setServerConfiguration(networkElement.serverIp, networkElement.serverPorts);
            component.setNetworkConfig(networkComponentConfig);
            
            console.log(component);
            components.push(component);
        }

        if (networkEnvironment.dnsServiceEnvId) {
            let env = await _fetch(`${this.API_URL}/environment-repository/environments/${networkEnvironment.dnsServiceEnvId}`, "GET", null, this.idToken);
            if (env.runtimeId) {
                const runtimeEnv = await _fetch(`${this.API_URL}/environment-repository/environments/${env.runtimeId}`, "GET", null, this.idToken);
                let component;
                let input_data = [];
                let input = {};
                input.size_mb = 512;
                input.destination = env.input;
    
                const url = await _fetch(`${this.API_URL}/network-environments/${networkEnvironment.envId}?jsonUrl=true`);
                input.content = [{
                    "action": "copy",
                    "url": sessionStorage.DEBUG_network_json_url ? sessionStorage.DEBUG_network_json_url : url.url,
                    "compression_format": "tar",
                    "name": "network.json",
                }];
                input_data.push(input);
                component = new MachineComponentBuilder(env.runtimeId, runtimeEnv.archive);
    
                component.setLinuxRuntime(
                {
                    userContainerEnvironment: env.envId,
                    userContainerArchive: env.archive,
                    networking: env.networking,
                    input_data: input_data
                });
    
                let networkComponentConfig = new NetworkComponentConfig("DNS/DHCP Service");
                component.setNetworkConfig(networkComponentConfig);
                components.push(component);
            }
        }
        await client.start(components, clientOptions);
        await client.detach(sessionKey, "-1");
    }

    async connectNetworkSession(client, networkId, sessionKey)
    {
        let session = null;
        try {
            session = await this.getSession(sessionKey);
            console.log(session);
        }
        catch(e)
        {
            console.log(e);
        }
        
        if(!session) {
            await this.initNetworkSession(client, networkId, sessionKey);
            session = await this.getSession(sessionKey);
            console.log(session);
        }
        return session;
    }
}
