import {_fetch} from "./util.js"
import {ClientOptions, NetworkComponentConfig} from "./clientOptions.js"
import {MachineComponentBuilder, InputContentBuilder, ContainerRuntimeBuilder, InputBuilder} from "./componentBuilder.js"

export class NetworkBuilder {

    constructor(api, idToken = null) {
        this.API_URL = api;
        this.idToken = idToken;

        this.clientOptions = null;
        this.components = [];
    }

    getComponents () {
        return this.components;
    }

    getClientOptions() {
        return this.clientOptions;
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

    async getNetworkEnvironmentById(id)
    {
        return await _fetch(`${this.API_URL}/network-environments/${id}`, "GET", null, this.idToken);
    }
    
    async getEnvironmentById(envId)
    {
        return await _fetch(`${this.API_URL}environment-repository/environments/${envId}`);
    }

    async loadNetworkEnvironment(networkEnvironment) 
    {
        this.clientOptions = new ClientOptions(networkEnvironment);
        for (const networkElement of networkEnvironment.emilEnvironments) {
            let env = this.getEnvironmentById(networkElement.envId);
            
            let component = new MachineComponentBuilder(env.envId, env.archive);
            component.setEthernetAddress(networkElement.macAddress);
            component.setObject(env.objectId, env.objectArchive);

            if(networkElement.toVisualize) {
                component.setInteractive();
            }
    
            let networkComponentConfig = new NetworkComponentConfig(networkElement.label, networkElement.macAddress);
            networkComponentConfig.setServerConfiguration(networkElement.serverIp, networkElement.serverPorts);
            networkComponentConfig.setFqdn(networkElement.fqdn);
            component.setNetworkConfig(networkComponentConfig);

            component.setEthernetAddress(networkElement.macAddress);

            components.push(component);
        }

        if (networkEnvironment.dnsServiceEnvId) {
            let dnsEnvironment = await this.getEnvironmentById(networkEnvironment.dnsServiceEnvId);
            this.components.push(await this.buildDnsService(dnsEnvironment, networkEnvironment.envId))
        }

        if (networkEnvironment.smbServiceId) {
            let smbEnvironment = await this.getEnvironmentById(networkEnvironment.smbServiceId);
            this.components.push(await this.buildSmbService(smbEnvironment));
        }

        if (networkEnvironment.linuxArchiveProxyEnvId) {
            let linuxArchiveProxyEnvironment = await this.getEnvironmentById(networkEnvironment.linuxArchiveProxyEnvId);
            this.components.push(await this.buildLinuxArchiveService(linuxArchiveProxyEnvironment));
        }

        console.log(this.components);
    }

    async buildSmbService(smbEnvironment) 
    {
        const component = new MachineComponentBuilder(smbEnvironment.runtimeId, "public");
        const sts = await _fetch(`${this.API_URL}/user-data-storage/sts`);

        let runtimeBuilder = new ContainerRuntimeBuilder(smbEnvironment.envId, smbEnvironment.archive);
        runtimeBuilder.enableDhcp(true);
        runtimeBuilder.addUserEnvironment()
        runtimeBuilder.setLinuxRuntime("EAAS_STORAGE_CONFIG=" + JSON.stringify(sts.data));

        component.setRuntime(runtimeBuilder);
        
        let networkComponentConfig = new NetworkComponentConfig("Windows Network Storage Service");
        networkComponentConfig.setFqdn("storage");
        component.setNetworkConfig(networkComponentConfig);

        return component;
    }

    async buildDnsService(dnsEnvironment, networkId) 
    {
        let runtimeBuilder = new ContainerRuntimeBuilder(dnsEnvironment.envId, dnsEnvironment.archive);
        runtimeBuilder.enableDhcp(dnsEnvironment.networking.isDHCPenabled);
        runtimeBuilder.enableTelnet(dnsEnvironment.networking.isTelnetEnabled);

        const networkConfiguration = await _fetch(`${this.API_URL}/network-environments/${networkId}?jsonUrl=true`);
        let inputBuilder = new InputBuilder(dnsEnvironment.input);
        let content = new InputContentBuilder(sessionStorage.DEBUG_network_json_url ? sessionStorage.DEBUG_network_json_url : networkConfiguration.url);
        content.setName("network.json");
        inputBuilder.addContent(content);
    
        const component = new MachineComponentBuilder(dnsEnvironment.runtimeId, "public");
        component.setRuntime(runtimeBuilder);
        component.addRuntimeInput(inputBuilder);
        
        let networkComponentConfig = new NetworkComponentConfig("DNS/DHCP Service");
        component.setNetworkConfig(networkComponentConfig);

        console.log(component);
        return component;
    }

    async buildLinuxArchiveService(archiveEnvironment) 
    {
        let runtimeBuilder = new ContainerRuntimeBuilder(archiveEnvironment.envId, archiveEnvironment.archive);
        runtimeBuilder.enableDhcp(true);
        runtimeBuilder.enableTelnet(archiveEnvironment.networking.isTelnetEnabled);
    
        const component = new MachineComponentBuilder(archiveEnvironment.runtimeId, "public");
        component.setRuntime(runtimeBuilder);
       
        let networkComponentConfig = new NetworkComponentConfig("Linux Archive Proxy Service");
        networkComponentConfig.setFqdn("ftp.debian.org");
        component.setNetworkConfig(networkComponentConfig);
        
        return component;
    }

    async init(client, sessionKey, lifeTime) 
    {
        await client.start(this.components, this.clientOptions);
        await client.detach(sessionKey, lifeTime);
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