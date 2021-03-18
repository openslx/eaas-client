import { Client } from "./eaas-client.js";
import {
  InputBuilder,
  InputContentBuilder,
  MachineComponentBuilder,
} from "./lib/componentBuilder.js";
import { ClientOptions, NetworkConfig } from "./lib/clientOptions.js";
import { NetworkBuilder } from "./lib/networkBuilder.js";
import { _fetch } from "./lib/util.js";

const kbLayoutPrefs = {
  language: { name: "us", description: "English (US)" },
  layout: {
    name: "pc101",
    description: "Generic 101-key PC",
    vendor: "Generic",
  },
};

class EaasClientElement extends HTMLElement {
  constructor() {
    super();
    const container = document.createElement("div");
    container.id = "emulator-container";
    this.append(container);
    this.container = container;
    this.backendUrl = this.getAttribute("eaas-service");
    const { backendUrl } = this;
    this.client = new Client(backendUrl, undefined, { kbLayoutPrefs });
    const { client } = this;
    this.style.display = "block";
    this.style.width = "min-content";

    let envId = this.getAttribute("environment-id");
    const imageArchive = this.getAttribute("image-archive") || "public";
    const enableInternet = this.hasAttribute("enable-internet");
    const internetDate = this.hasAttribute("internet-date");
    const networkId = this.getAttribute("network-id");
    const networkLabel = this.getAttribute("network-label");
    const containerId = this.getAttribute("container-id")?.match(/\/?([^/]+)$/)[1];

    if(containerId && !envId)
      envId = this.getAttribute("container-runtime-id");

    const networkName =
      this.getAttribute("network-name") ?? `network-${Math.random()}`;
    const machine = new MachineComponentBuilder(envId, imageArchive);
    machine.setInteractive(true);
    if (containerId)
      machine.setLinuxRuntime({
        userContainerEnvironment: containerId,
        userContainerArchive: imageArchive,
      });
    
    this.client.onEmulatorStopped = async () => {
      let result = await this.client.release();
      console.log(result);
      for (const download of downloads) {
        const a = document.createElement("a");
        a.href = result.url;
        a.append(...download.childNodes);
        download.append(a);
        download.hidden = false;
        this.append(download);
      }
    };

    const userMedia = [...this.querySelectorAll("eaas-medium")];
    if(userMedia.length)
    {
      for (const medium of userMedia) {
        const url = medium.getAttribute("source-url");
        const type = medium.getAttribute("type");

        const objectId = medium.getAttribute("object-id");

        if(url && type)
          machine.addUserMedia(url, type);
        else if(objectId)
          machine.setObject(objectId, "zero conf");
      }
    }

    const downloads = [...this.querySelectorAll("eaas-result")];
    for (const download of downloads) {
      download.hidden = true;
    }

    let inputMedia;
    const inputs = [...this.querySelectorAll("eaas-input")];
    if (inputs.length) {
      inputMedia = new InputBuilder("/input");
      for (const input of inputs) {
        const contentBuilder = new InputContentBuilder(
          input.getAttribute("href")
        );
        contentBuilder.setName(input.getAttribute("name"));
        const format = input.getAttribute("format");
        if (format) {
          contentBuilder.setAction("extract");
          contentBuilder.setCompressionFmt(format);
        } else {
          contentBuilder.setAction("copy");
        }
        inputMedia.addContent(contentBuilder);
      }
    }
    if (inputMedia) machine.addInputMedia(inputMedia);

    const monitorStateChanges = async () => {
      let oldState;
      while (true) {
        const state = (
          await this.session.getEmulatorState()
        ).state.toLowerCase();
        if (state !== oldState) {
          this.dispatchEvent(new CustomEvent(state));
        }
        oldState = state;
        console.log({ state });
        await new Promise((r) => setTimeout(r, 1000));
      }
    };

    let clientOptions = new ClientOptions();
    let components = [machine];
    (async () => {
      if (enableInternet) {
        const networkBuilder = new NetworkBuilder(this.backendUrl);
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

      if (networkId) {
        const netUtils = new NetworkBuilder(backendUrl);
        const session = await netUtils.connectNetworkSession(
          client,
          networkId,
          networkName
        );

        const realSession = await _fetch(
          `${client.API_URL}/sessions/${session.id}`,
          "GET"
        );
        client.load(realSession);

        const { componentId } = client.network.networkConfig.components.find(
          (e) => e.networkLabel === networkLabel
        );

        const componentSession = client.getSession(componentId);
        this.session = componentSession;
        monitorStateChanges();
      } else {
        await client.start(components, clientOptions);
        if (enableInternet) {
          this.session = await client.getSession(
            (await client.getSessions())[0].id
          );
          monitorStateChanges();
        }
      }
      await client.connect(container);
      for (const el of [...this.childNodes])
        if (el !== this.container) el.remove();
    })();
  }
  attributeChangedCallback() {}
}

customElements.define("eaas-environment", EaasClientElement);
