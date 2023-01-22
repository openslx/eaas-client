import { Client } from "./eaas-client.js";
import { MachineComponentBuilder } from "./lib/componentBuilder.js";

const backendUrl =
  "https://6ee231d1-4776-4d97-b54c-a1afb2eb2adc.fr.bw-cloud-instance.org/emil/";
const envId = "8e2e4d21-89f1-4ddd-8dd4-0a55f59d9d9f";
const imageArchive = "public";

const diskId = "53347c72-bbd6-4f40-8167-688ac197a353";

const div = document.createElement("div");
div.id = "emulator-container";
document.body.append(div);

const client = new Client(backendUrl);
const machine = new MachineComponentBuilder(envId, imageArchive);
machine.setDriveAssignment(4, "image", diskId);

await client.start([machine]);
await client.connect(div);
