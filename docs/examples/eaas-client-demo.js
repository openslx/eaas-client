import { Client } from "./eaas-client.js";
import {
  InputBuilder,
  InputContentBuilder,
  MachineComponentBuilder,
} from "./lib/componentBuilder.js";
import { ClientOptions, NetworkConfig } from "./lib/clientOptions.js";
import { NetworkBuilder } from "./lib/networkBuilder.js";
import { _fetch } from "./lib/util.js";


export async function startEnv(container, envId, enableInternet = false) {  
    const machine = new MachineComponentBuilder(envId, "public");
    machine.setInteractive(true);

    let clientOptions = new ClientOptions();
    let components = [machine];

    if (enableInternet) {
        const networkBuilder = new NetworkBuilder("https://rhizome.emulation.cloud/emil/");
        networkBuilder.addComponent(machine);
        clientOptions = await networkBuilder.getDefaultClientOptions();
        clientOptions.getNetworkConfig().enableInternet(true);
        if(!internetDate)  
        {
            clientOptions.getNetworkConfig().enableSlirpDhcp(true);
        }
        else {
            console.log(internetDate);
            networkBuilder.getNetworkConfig().archived_internet_date = internetDate;
            await networkBuilder.enableDhcpService(networkBuilder.getNetworkConfig());
        }

        components = await networkBuilder.getComponents();
    }
    await client.start(components, clientOptions);
    await client.connect(container);

}

