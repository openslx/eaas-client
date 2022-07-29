/**
 * EaaS client options to start a session
 *
 * @export
 * @class ClientOptions
 * @param [networkEnvironment=null]
 */
export class ClientOptions {
    constructor(networkEnvironment = null) {
        this.networkEnabled = (networkEnvironment) ? true : false;
        this.networkConfig = new NetworkConfig(networkEnvironment);
        this.xpraEncoding = null;
    }
    /**
     *
     *
     * @param val
     * @memberof ClientOptions
     */
    setXpraEncoding(val) {
        this.xpraEncoding = val;
    }
    /**
     *
     *
     * @return
     * @memberof ClientOptions
     */
    getXpraEncoding() {
        return this.xpraEncoding;
    }
    /**
     *
     *
     * @return
     * @memberof ClientOptions
     */
    getNetworkConfig() {
        return this.networkConfig;
    }
    /**
     *
     *
     * @param {boolean} [val=true]
     * @memberof ClientOptions
     */
    enableNetworking(val = true) {
        this.networkEnabled = val;
    }
    /**
     *
     *
     * @return
     * @memberof ClientOptions
     */
    isNetworkEnabled() {
        return this.networkEnabled;
    }
    /**
     *
     *
     * @static
     * @return
     * @memberof ClientOptions
     */
    static getDefaultOptions() {
        let clientOptions = new ClientOptions();
        clientOptions.enableNetworking(true);
        clientOptions.getNetworkConfig().setNetworkDefaults();

        return clientOptions;
    }
}
/**
 * Network Configuration options
 *
 * @export
 * @class NetworkConfig
 * @param [networkEnvironment=null]
 */
export class NetworkConfig {
    constructor(networkEnvironment = null) {
        this.components = [];

        if (!networkEnvironment) {
            this._enableInternet = false;
            this.dhcpEnabled = false;
            this.gateway = null;
            this.network = null;
            this.tcpGatewayConfig = null;
            this.lifetime = null;
        } else {
            this.setNetwork(networkEnvironment.network);
            this.setGateway(networkEnvironment.gateway);
            this.enableInternet(networkEnvironment.enableInternet);
            this.lifetime = null; //Will use default value provided by backend if not manually set up by frontend
            if (!networkEnvironment.dnsServiceEnvId)
                this.enableSlirpDhcp(networkEnvironment.isDHCPenabled);

            try {
                let tcpGatewayConfig = new TcpGatewayConfig(networkEnvironment.networking.serverIp, networkEnvironment.networking.serverPort);
                tcpGatewayConfig.enableSocks(networkEnvironment.networking.enableSocks);
                tcpGatewayConfig.enableLocalMode(networkEnvironment.networking.localServerMode);
                this.setTcpGatewayConfig(tcpGatewayConfig);
            } catch (e) {
                // console.log(e);
            }
        }
    }
    /**
     *
     *
     * @memberof NetworkConfig
     */
    setNetworkDefaults() {
        this.setNetwork("10.0.0.0/24");
        this.setGateway("10.0.0.1");
    }
    /**
     *
     *
     * @param conf
     * @memberof NetworkConfig
     */
    setTcpGatewayConfig(conf) {
        this.tcpGatewayConfig = conf;
    }
    /**
     *
     *
     * @return
     * @memberof NetworkConfig
     */
    getTcpGatewayConfig() {
        return this.tcpGatewayConfig;
    }
    /**
     *
     *
     * @param {boolean} [val=true]
     * @memberof NetworkConfig
     */
    enableInternet(val = true) {
        this._enableInternet = val;
    }
    /**
     *
     *
     * @param {boolean} [val=true]
     * @memberof NetworkConfig
     */
    enableSlirpDhcp(val = true) {
        this.dhcpEnabled = val;
    }
    /**
     *
     *
     * @param val
     * @memberof NetworkConfig
     */
    setGateway(val) {
        this.gateway = val;
    }
    /**
     *
     *
     * @param val
     * @memberof NetworkConfig
     */
    setNetwork(val) {
        this.network = val;
    }
    /**
     *
     *
     * @param val
     * @memberof NetworkConfig
     */
    setLifetime(val) {
        this.lifetime = val;
    }


    /**
     *
     *
     * @param component
     * @memberof NetworkConfig
     */
    addNetworkComponent(component) {
        if (!this.components.includes(component)) this.components.push(component);
    }
    /**
     *
     *
     * @return
     * @memberof NetworkConfig
     */
    build() {
        const hasTcpGateway = (this.tcpGatewayConfig && !this.tcpGatewayConfig.isLocalModeEnabled()) ? true : false;

        let networkRequest = {
            hasInternet: this._enableInternet,
            enableDhcp: this.dhcpEnabled,
            gateway: this.gateway,
            network: this.network,
            hasTcpGateway: hasTcpGateway,
            tcpGatewayConfig: this.tcpGatewayConfig ? this.tcpGatewayConfig.build() : {}
        };
        if (this.lifetime != null){
            networkRequest.lifetime = this.lifetime;
        }

        networkRequest.components = [];
        this.components.forEach(element => {
            networkRequest.components.push(element.build());
        });
        return networkRequest;
    }
}
/**
 *
 *
 * @export
 * @class NetworkComponentConfig
 * @param networkLabel
 * @param hwAddress
 */
export class NetworkComponentConfig {
    constructor(networkLabel, hwAddress) {
        this.componentId = undefined; // unused?
        this.networkLabel = networkLabel;
        this.hwAddress = "auto";
        this.fqdn = null;

        this.serverIp = null;
        this.serverPorts = null;

        if (hwAddress)
            this.hwAddress = hwAddress;
    }
    /**
     *
     *
     * @param val
     * @memberof NetworkComponentConfig
     */
    setFqdn(val) {
        this.fqdn = val;
    }
    /**
     *
     *
     * @return
     * @memberof NetworkComponentConfig
     */
    getFqdn() {
        return this.fqdn;
    }
    /**
     *
     *
     * @param componentId
     * @memberof NetworkComponentConfig
     */
    setComponentId(componentId) {
        this.componentId = componentId;
    }
    /**
     *
     *
     * @param serverIp
     * @param serverPorts
     * @memberof NetworkComponentConfig
     */
    setServerConfiguration(serverIp, serverPorts) {
        this.serverIp = serverIp;
        this.serverPorts = serverPorts;
    }
    /**
     *
     *
     * @return
     * @memberof NetworkComponentConfig
     */
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
/**
 *
 * @export
 * @class TcpGatewayConfig
 * @param ip
 * @param port
 */
export class TcpGatewayConfig {
    constructor(ip, port) {
        this.socks = null;

        if (!ip || !port)
            throw new Error("ip and portnumber are required");

        this.serverPort = port;
        this.serverIp = ip;
        this.localMode = false; // if true -> tcpGateway is false, but config is set
    }
    /**
     *
     *
     * @param {boolean} [val=true]
     * @memberof TcpGatewayConfig
     */
    enableSocks(val = true) {
        this.socks = val;
    }
    /**
     *
     *
     * @param {boolean} [val=true]
     * @memberof TcpGatewayConfig
     */
    enableLocalMode(val = true) {
        this.localMode = val;
    }
    /**
     *
     *
     * @return
     * @memberof TcpGatewayConfig
     */
    getServerIp() {
        return this.serverIp;
    }
    /**
     *
     *
     * @return
     * @memberof TcpGatewayConfig
     */
    getServerPort() {
        return this.serverPort;
    }
    /**
     *
     *
     * @return
     * @memberof TcpGatewayConfig
     */
    isLocalModeEnabled() {
        return this.localMode;
    }
    /**
     *
     *
     * @return
     * @memberof TcpGatewayConfig
     */
    build() {
        return {
            socks: this.socks,
            serverIp: this.serverIp,
            serverPort: this.serverPort
        };
    }
}