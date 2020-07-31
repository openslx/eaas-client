
export class ClientOptions {
    constructor()
    {
        this._networkEnabled = false;
        this.networkConfig = new NetworkConfig();
        this.xpraEncoding = null;
    }

    setXpraEncoding(val)
    {
        this.xpraEncoding = val;
    }

    getXpraEncoding()
    {
        return this.xpraEncoding;
    }

    getNetworkConfig()
    {
        return this.networkConfig;
    }

    enableNetworking(val = true)
    {
        this._networkEnabled = val;
    }

    isNetworkEnabled() 
    {
        return this._networkEnabled;
    } 
}

export class NetworkConfig
{
    constructor()
    {
        this._enableInternet = false;
        this.dhcpEnabled = false;
        this.gateway = null;
        this.network = null;
        this.dhcpNetworkAddress = null;
        this.dhcpNetworkMask = null;
        this.tcpGatewayConfig = null;
        this.components = [];
    }

    setTcpGatewayConfig(conf)
    {
        this.tcpGatewayConfig = conf;
    }

    getTcpGatewayConfig()
    {
        return this.tcpGatewayConfig;
    }

    enableInternet(val = true)
    {
        this._enableInternet = val;
    }

    enableSlirpDhcp(val = true)
    {
        this.dhcpEnabled = val;
    }

    setGateway(val)
    {
        this.gateway = val;
    }

    setNetwork(val) {
        this.network = val;
    }
    
    setDhcpNetworkAddress(val)
    {
        this.dhcpNetworkAddress = val;
    }

    setDhcpNetworkMask(val)
    {
        this.dhcpNetworkMask = val;
    }

    addNetworkComponent(component) {
        this.components.push(component);
    }

    build() {
        const hasTcpGateway = (this.tcpGatewayConfig && !this.tcpGatewayConfig.isLocalModeEnabled() )? true : false;

        let networkRequest = {
            networkEnvironmentId: this.environmentId,
            hasInternet: this._enableInternet,
            enableDhcp: this.dhcpEnabled,
            gateway: this.gateway,
            network: this.network,
            dhcpNetworkAddress: this.dhcpNetworkAddress,
            dhcpNetworkMask: this.dhcpNetworkMask,
            hasTcpGateway: hasTcpGateway,
            tcpGatewayConfig: this.tcpGatewayConfig ? this.tcpGatewayConfig.build() : {}
        };

        networkRequest.components = [];
        this.components.forEach(element => {
            networkRequest.components.push(element.build());
        });
        return networkRequest;
    }
}

export class NetworkComponentConfig
{
    constructor(networkLabel, hwAddress)
    {
        this.componentId;
        this.networkLabel = networkLabel;
        this.hwAddress = "auto";
        this.fqdn = null;

        this.serverIp = null;
        this.serverPorts =  null;
        
        if(hwAddress)
            this.hwAddress = hwAddress;
    }

    setFqdn(val)
    {
        this.fqdn = val;
    }

    getFqdn()
    {
        return this.fqdn;
    }

    setComponentId(componentId) {
        this.componentId = componentId;
    }

    setServerConfiguration(serverIp, serverPorts)
    {
        this.serverIp = serverIp;
        this.serverPorts = serverPorts;
    } 

    build() {
        return {
            componentId: this.componentId,
            networkLabel: this.networkLabel,
            fqdn: this.fqdn,
            hwAddress: this.hwAddress,
            serverIp: this.serverIp,
            serverPorts: this.serverPorts
        };
    }
}

export class TcpGatewayConfig{
    constructor(ip, port)
    {
        this.socks = null;
        
        if(!ip || !port)
            throw new Error("ip and portnumber are required");
            
        this.serverPort = port;
        this.serverIp = ip;
        this.localMode = false; // if true -> tcpGateway is false, but config is set
    }

    enableSocks(val = true)
    {
        this.socks = val;
    }

    enableLocalMode(val = true)
    {
        this.localMode = val;
    }

    getServerIp ()
    {
        return this.serverIp;
    }

    getServerPort()
    {
        return this.serverPort;
    }

    isLocalModeEnabled() 
    {
        return this.localMode;
    }

    build() {
        return {
            socks: this.socks,
            serverIp: this.serverIp,
            serverPort: this.serverPort
        }
    }
}