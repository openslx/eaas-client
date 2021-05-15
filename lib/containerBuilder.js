import {
	_fetch
} from "./util.js";

/**
 *
 *
 * @export
 * @class ContainerBuilder
 * @param imageSource
 * @param urlString
 * @param metadata
 */
export class ContainerBuilder {
	constructor(imageSource, urlString, metadata) {
		this.imageUrl = urlString;
		this.name = undefined;
		this.processArgs = null;
		this.processEnvs = null;
		this.inputFolder = "/input";
		this.outputFolder = "/output";
		this.imageType = imageSource;
		this.title = null;
		this.description = null;
		this.author = null;
		this.guiRequired = undefined;
		this.customSubdir = undefined;
		this.runtimeId = undefined;
		this.serviceContainer = false;
		this.enableNetwork = false;
		this.serviceContainerId = undefined;
		this.workingDir = null;
		this.archive = "default";

		if(metadata)
		{
			this.configureProcess(metadata.entryProcesses, metadata.envVariables);
			this.setWorkDirectory(metadata.workingDir);
		}
	}
	/**
	 *
	 * @param n
	 * @memberOf ContainerBuilder
	 */
	setName(n) {
		this.name = n;
	}
	/**
	 *
	 * @param d
	 * @memberOf ContainerBuilder
	 */
	setWorkDirectory(d)
	{
		this.workingDir = d;
	}
	/**
	 *
	 * @param args
	 * @param envs
	 * @memberOf ContainerBuilder
	 */
	configureProcess(args, envs)
	{
		this.processArgs = args;
		this.processEnvs = envs;
	}
	/**
	 *
	 * @param f
	 * @memberOf ContainerBuilder
	 */
	setInputFolder(f)
	{
		this.inputFolder = f;
	}
	/**
	 *
	 * @param f
	 * @memberOf ContainerBuilder
	 */
	setOutputFolder(f)
	{
		this.outputFolder = f;
	}
	/**
	 *
	 * @param t
	 * @memberOf ContainerBuilder
	 */
	setTitle(t)
	{
		this.title = t;
	}
	/**
	 *
	 * @param d
	 * @memberOf ContainerBuilder
	 */
	setDescription(d)
	{
		this.description = d;
	}
	/**
	 *
	 * @param a
	 * @memberOf ContainerBuilder
	 */
	setAuthor(a)
	{
		this.author = a;
	}
	/**
	 *
	 * @param runtimeId
	 * @memberOf ContainerBuilder
	 */
	setRuntime(runtimeId)
	{
		this.runtimeId = runtimeId;
	}
	/**
	 *
	 * @param b
	 * @memberOf ContainerBuilder
	 */
	enableGui(b)
	{
		this.guiRequired = b;
	}
	/**
	 *
	 * @param b
	 * @memberOf ContainerBuilder
	 */
	setEnableNetwork(b) {
		this.enableNetwork = b;
	}
	/**
	 *
	 * @param a
	 * @memberOf ContainerBuilder
	 */
	setArchive(a) {
		this.archive = a;
	}
	/**
	 *
	 * @param name
	 * @memberOf ContainerBuilder
	 */
	setServiceContainerId(name) {
		if(name) {
			this.serviceContainer = true;
			this.serviceContainerId = name;
		}
		else {
			this.serviceContainer = false;
			this.serviceContainerId = undefined;
		}
	}
	/**
	 *
	 * @param api
	 * @param idToken
	 * @return
	 * @memberOf ContainerBuilder
	 */
	async build(api, idToken = null)
	{
		return await _fetch(`${api}EmilContainerData/importContainer`, "POST", this, idToken);
	}
}
/**
 *
 *
 * @export
 * @class EmulatorBuilder
 * @param url
 * @param [metadata=null]
 */
export class EmulatorBuilder {
	constructor(url, metadata=null) {
		this.imageUrl = url;
		this.metadata = metadata;
	}
	/**
	 *
	 * @param api
	 * @param idToken
	 * @return
	 * @memberOf EmulatorBuilder
	 */
	async build(api, idToken = null)
	{
		return await _fetch(`${api}EmilContainerData/importEmulator`, "POST", this, idToken);
	}
}
/**
 *
 *
 * @export
 * @class ContainerImageBuilder
 * @param url
 * @param containerSource
 */
export class ContainerImageBuilder {
	constructor(url, containerSource) {
		this.urlString = url;
		this.containerType = containerSource;

		if(this.containerType !== "rootfs" &&
			this.containerType !== "simg" &&
			this.containerType !== "dockerhub")
			throw new Error(`invalid container source '${containerSource}'. valid types are rootfs, simg, dockerhub, readymade`);

		this.tag = undefined;
		this.digest = undefined;
	}
	/**
	 *
	 * @param tag
	 * @memberOf ContainerImageBuilder
	 */
	setTag(tag) {
		this.tag = tag;
	}
	/**
	 *
	 * @param d
	 * @memberOf ContainerImageBuilder
	 */
	setDigest(d)
	{
		this.digest = d;
	}
	/**
	 *
	 * @param api
	 * @param [idToken=null]
	 * @return
	 * @memberOf ContainerImageBuilder
	 */
	async build(api, idToken = null) {
		return await _fetch(`${api}EmilContainerData/buildContainerImage`, "POST", this, idToken);
	}
}
