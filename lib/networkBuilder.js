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

    addComponent (c) {
        let label = "machine " + this.components.length;
        let networkComponentConfig = new NetworkComponentConfig(label);
        c.setNetworkConfig(networkComponentConfig);
        this.components.push(c);
    }

    getComponents () {
        return this.components;
    }

    getClientOptions() {
        return this.clientOptions;
    }

    getDefaultClientOptions() 
    {
        return ClientOptions.getDefaultOptions();
    }

    async getSessions() 
    {
        return  _fetch(`${this.API_URL}/sessions`, "GET", null, this.idToken);
    }

    getDefaultDhcpConfig() {
        return {
            network: "10.0.0.0/24", 
            gateway: "10.0.0.1", 
            upstream_dns: "8.8.8.8",
            dhcp: {ip:"10.0.0.2"},
            environments:[]
        };
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

            // this needs to be done elsewhere
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
        runtimeBuilder.addUserEnvironment("EAAS_STORAGE_CONFIG=" + JSON.stringify(sts.data))
        component.setRuntime(runtimeBuilder);
        
        let networkComponentConfig = new NetworkComponentConfig("Windows Network Storage Service");
        networkComponentConfig.setFqdn("storage");
        component.setNetworkConfig(networkComponentConfig);

        return component;
    }

    async enableDhcpService(config)
    {
        let dnsEnvironment = await this.getEnvironmentById("service-dns");
        this.components.push(await this.buildDnsService(dnsEnvironment, null, config))
    }

    async buildDnsService(dnsEnvironment, networkId, config = null) 
    {
        let runtimeBuilder = new ContainerRuntimeBuilder(dnsEnvironment.envId, dnsEnvironment.archive);
        runtimeBuilder.enableDhcp(dnsEnvironment.networking.isDHCPenabled);
        runtimeBuilder.enableTelnet(dnsEnvironment.networking.isTelnetEnabled);

        if(!config) {
            if(!networkId)
                throw new Error("Either config or network ID is required to configure DHCP");
            config = await _fetch(`${this.API_URL}/network-environments/${networkId}?json=true`);
        }
        runtimeBuilder.addUserEnvironment(`EAAS_NETWORK_CONFIG=${JSON.stringify(config)}`);

        const component = new MachineComponentBuilder(dnsEnvironment.runtimeId, "public");
        component.setRuntime(runtimeBuilder);
        
        let networkComponentConfig = new NetworkComponentConfig("DNS/DHCP Service");
        component.setNetworkConfig(networkComponentConfig);

        return component;
    }

    async enableLinuxArchiveService()
    {
        let linuxArchiveProxyEnvironment = await this.getEnvironmentById("service-archive-proxy");
        this.components.push(await this.buildLinuxArchiveService(linuxArchiveProxyEnvironment));
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