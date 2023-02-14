import { Client } from "../../eaas-client.js";
import {
    ImageDataSource,
    MachineComponentBuilder,
} from "../../lib/componentBuilder.js";

const backendUrl = `https://${location.search.slice(1)}/emil/`;
const envId = "525f42be-aa4f-46bd-86fa-d31883745278";
const imageArchive = "public";

const diskId = "4b88d70e-4a77-4420-8377-2cb9b10dd1f2";

const div = document.createElement("div");
div.id = "emulator-container";
document.body.append(div);

const client = new Client(backendUrl);
const machine = new MachineComponentBuilder(envId, imageArchive);

const image = new ImageDataSource(diskId);
machine.setDriveAssignment(2, image);

await client.start([machine]);
await client.connect(div);
