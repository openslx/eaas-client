/**
 *
 *
 * @class ComponentBuilder
 */
class ComponentBuilder {

    constructor() {
        /*
            InputMedium
        */
        this.options = undefined;

    }
    /**
     *
     *
     * @param options
     * @memberof ComponentBuilder
     */
    setComponentOptions(options) {
        this.options = options;
    }
    /**
     *
     *
     * @return
     * @memberof ComponentBuilder
     */
    build() {
        if (!this.options)
            return {};
        let component = {
            options: {
                cpuMillicores: this.options.cpuMillicores,
                memory: this.options.memory,
                userData: this.options.userData,
                timeContext: this.options.timeContext
            }
        };
        return component;
    }
}
/**
 *
 *
 * @export
 * @class ComponentOptions
 * @param userData
 */
export class ComponentOptions {
    constructor(userData) {
        this.userData = userData;
        this.cpuMillicores = null;
        this.memory = null;
    }
    /**
     *
     *
     * @param val
     * @memberof ComponentOptions
     */
    setUserData(val) {
        this.userData = val;
    }
    /**
     *
     *
     * @param val
     * @memberof ComponentOptions
     */
    setCpu(val) {
        this.cpuMillicores = val;
    }
    /**
     *
     *
     * @param val
     * @memberof ComponentOptions
     */
    setMemory(val) {
        this.memory = val;
    }
}
/**
 *
 *
 * @export
 * @class InputBuilder
 * * @param destination
 */
export class InputBuilder {
    constructor(destination) {
        this.size = 512;
        this.destination = destination;
        this.content = [];
        this.partition_table_type = undefined;
        this.filesystem_type = undefined;
        this.type = undefined;
    }
    /**
     *
     *
     * @param d
     * @memberof InputBuilder
     */
    setDestination(d) {
        this.destination = d;
    }
    /**
     *
     *
     * @param _size
     * @memberof InputBuilder
     */
    setSize(_size) {
        this.size = _size;
    }

    /**
     *
     *
     * @param c
     * @memberof InputBuilder
     */
    addContent(c) {
        this.content.push(c);
    }
    /**
     *
     *
     * @return
     * @memberof InputBuilder
     */
    build() {
        let input_data = {};
        input_data.size_mb = this.size;
        input_data.destination = this.destination;
        input_data.partition_table_type = this.partition_table_type;
        input_data.filesystem_type = this.filesystem_type;
        input_data.type = this.type;
        input_data.content = this.content;

        input_data.content = [];
        
        this.content.forEach(element => {
            input_data.content.push(element.build());
        });
        
        return input_data;
    }
}

/**
 *
 *
 * @export
 * @class InputContentBuilder
 * @param url
 */
export class InputContentBuilder {
    constructor(url) {
        this.action = "copy";
        this.url = url;
        this.compression_format = "tar";
        this.name = undefined; 
    }
    /**
     *
     *
     * @param _url
     * @memberof InputContentBuilder
     */
    setUrl(_url) {
        this.url = _url;
    }
    /**
     *
     *
     * @param _name
     * @memberof InputContentBuilder
     */
    setName(_name) {
        this.name = _name;
    }
    /**
     *
     *
     * @param _action
     * @memberof InputContentBuilder
     */
    setAction(_action) {
        this.action = _action;
    }
    /**
     *
     *
     * @param _cFmt
     * @memberof InputContentBuilder
     */
    setCompressionFmt(_cFmt) {
        this.compression_format = _cFmt;
    }
    /**
     *
     *
     * @return
     * @memberof InputContentBuilder
     */
    build() {
        let content = {};

        content.action = this.action;
        content.url = this.url;
        content.compression_format = this.compression_format;
        content.name = this.name;

        return content;
    }
}
/**
 *
 *
 * @export
 * @class MachineComponentBuilder
 * @extends {ComponentBuilder}
 * @param environmentId
 * @param [imageArchive=null]
 */
export class MachineComponentBuilder extends ComponentBuilder {

    constructor(environmentId, imageArchive = null) {
        super();

        this.type = "machine";

        // possible machine component config fields

        // required;
        this.environment = environmentId;

        this.userMedia = undefined;
        this.input_data = [];

        // optional
        this.archive = imageArchive;
        this.inputs = [];

        this.object = undefined;
        this.objectArchive = undefined;

        this.software = undefined;

        // boolean
        this._lockEnvironment = undefined;
        this.emulatorVersion = undefined;
        this.nic = undefined;
        this.linuxRuntimeData = undefined;

        this.keyboardLayout = undefined;
        this.keyboardModel = undefined;
        this.hasOutput = false;
        this.outputDriveId = false;

        // ui only settings
        this.interactive = false;

        // for internal use, if network is configure
        this.networkSettings = null;
    }


    getHasOutput() {
        return this.hasOutput;
    }

    setHasOutput(val) {
        this.hasOutput = val;
    }

    getOutputDriveId() {
        return this.outputDriveId;
    }

    setOutputDriveId(val) {
        this.outputDriveId = val;
    }

    /**
     *
     *
     * @param url
     * @param mediumType
     * @memberof MachineComponentBuilder
     */
    addUserMedia(url, mediumType) {
        if (!this.userMedia)
            this.userMedia = [];

        this.userMedia.push({
            url: url,
            mediumType: mediumType
        });
    }
    /**
     *
     *
     * @return
     * @memberof MachineComponentBuilder
     */
    getNetworkConfig() {
        return this.networkSettings;
    }
    /**
     *
     *
     * @param val
     * @memberof MachineComponentBuilder
     */
    setNetworkConfig(val) {
        this.networkSettings = val;
        if(val && val.hwAddress != "auto")
            this.nic = val.hwAddress;
    }
    /**
     *
     *
     * @return
     * @memberof MachineComponentBuilder
     */
    getId() {
        return this.environment;
    }
    /**
     *
     *
     * @param val
     * @memberof MachineComponentBuilder
     */
    setInteractive(val) {
        this.interactive = val;
    }
    /**
     *
     *
     * @return
     * @memberof MachineComponentBuilder
     */
    isInteractive() {
        return this.interactive;
    }
    /**
     *
     *
     * @param archive
     * @memberof MachineComponentBuilder
     */
    setImageArchive(archive) {
        this.archive = archive;
    }
    /**
     *
     *
     * @param inputMedia
     * @memberof MachineComponentBuilder
     */
    addInputMedia(inputMedia) {
        this.input_data.push(inputMedia);
    }
    /**
     *
     *
     * @param objectId
     * @param objectArchive
     * @memberof MachineComponentBuilder
     */
    setObject(objectId, objectArchive) {
        this.object = objectId;
        this.objectArchive = objectArchive;
    }
    /**
     *
     *
     * @param val
     * @memberof MachineComponentBuilder
     */
    setSoftware(software, objectArchive) {
        this.software = software;
        this.objectArchive = objectArchive;
    }
    /**
     *
     *
     * @param {boolean} [doLock=true]
     * @memberof MachineComponentBuilder
     */
    lockEnvironment(doLock = true) {
        this.lockEnvironment = doLock;
    }
    /**
     *
     *
     * @param emulatorVersion
     * @memberof MachineComponentBuilder
     */
    setEmulatorVersion(emulatorVersion) {
        this.emulatorVersion = emulatorVersion;
    }
    /**
     *
     *
     * @param mac
     * @memberof MachineComponentBuilder
     */
    setEthernetAddress(mac) {
        this.nic = mac;
    }
    /**
     *
     *
     * @param r
     * @memberof MachineComponentBuilder
     */
    setRuntime(r) {
        this.linuxRuntimeData = r.build();
    }
    
    /**
     *
     *
     * @param runtime
     * @return
     * @memberof MachineComponentBuilder
     */
    setLinuxRuntime(runtime) {
        if (!runtime)
            return;

        this.linuxRuntimeData = {
            userContainerEnvironment: runtime.userContainerEnvironment,
            userContainerArchive: runtime.userContainerArchive,
            userEnvironment: runtime.userEnvironment,
            isDHCPenabled: (runtime.networking||{}).isDHCPenabled, 
            isTelnetEnabled: (runtime.networking||{}).isTelnetEnabled,
        };
       
        this.inputs = runtime.input_data;
    }
    /**
     *
     *
     * @param layout
     * @param model
     * @memberof MachineComponentBuilder
     */
    setKeyboard(layout, model) {
        this.keyboardLayout = layout;
        this.model = model;
    }
    /**
     *
     *
     * @return
     * @memberof MachineComponentBuilder
     */
    build() {
        if (!this.environment)
            throw new Error("Cannot create component request, environmentId is required.");

        let component = {
            type: this.type,
            environment: this.environment,
            userMedia: this.userMedia,
            archive: this.archive ? this.archive : "default",
            object: this.object,
            objectArchive: this.objectArchive,
            software: this.software,
            lockEnvironment: this._lockEnvironment,
            emulatorVersion: this.emulatorVersion,
            nic: this.nic,
            linuxRuntimeData: this.linuxRuntimeData,
            keyboardLayout: this.keyboardLayout,
            keyboardModel: this.keyboardModel
        };
    
        if (this.input_data.length) {
            component.input_data = [];
            this.input_data.forEach(element => {
                component.input_data.push(element.build());
            });
        } else
            component.input_data = this.inputs;
        
        return Object.assign(component, super.build());
    }

    /*
    

    static async startContainer(api, containerRequest, idToken)
    {
        var data = {};
        data.type = "container";
        data.environment = containerId;
        data.input_data = args.input_data;

        console.log("Starting container " + containerId + "...");
        var deferred = $.Deferred();

        $.ajax({
            type: "POST",
            url: this.API_URL + "/components",
            data: JSON.stringify(data),
            contentType: "application/json",
            headers: localStorage.getItem('id_token') ? { "Authorization": "Bearer " + localStorage.getItem('id_token') } : {}
        }).then((data, status, xhr) => {
            console.log("container " + containerId + " started.");
            this.componentId = data.id;
            this.isStarted = true;
            this.pollStateIntervalId = setInterval(() => { this._pollState(); }, 1500);
            deferred.resolve();
        },
            (xhr) => {
                this._onFatalError($.parseJSON(xhr.responseText));
                deferred.reject();
            });
        return deferred.promise();
    }
    */
}
/**
 *
 *
 * @export
 * @class ContainerRuntimeBuilder
 * @param envId
 * @param {string} [archive="default"]
 */
export class ContainerRuntimeBuilder {

    constructor(envId, archive = "default") {
        this.environmentId = envId;
        this.archive = archive;
        this.isDHCPenabled = false;
        this.isTelnetEnabled = false;
        this.userEnvironment = [];
        this.input = [];
    }
    /**
     *
     *
     * @param {boolean} [b=true]
     * @memberof ContainerRuntimeBuilder
     */
    enableDhcp(b = true) {
        this.isDHCPenabled = b;
    }
    /**
     *
     *
     * @param {boolean} [b=true]
     * @memberof ContainerRuntimeBuilder
     */
    enableTelnet(b = true) {
        this.isTelnetEnabled = b;
    }
    /**
     *
     *
     * @param env
     * @memberof ContainerRuntimeBuilder
     */
    addUserEnvironment(env) {
        this.userEnvironment.push(env);
    }
    /**
     *
     *
     * @return
     * @memberof ContainerRuntimeBuilder
     */
    build() {
        let linuxRuntimeData = {
            userContainerEnvironment: this.environmentId,
            userContainerArchive: this.archive,
            isDHCPenabled: this.isDHCPenabled,
            isTelnetEnabled: this.isTelnetEnabled,
            userEnvironment: this.userEnvironment,
        };
        return linuxRuntimeData;
    }
}
/**
 *
 *
 * @export
 * @class UviMachineComponentBuilder
 * @extends {MachineComponentBuilder}
 * @param uvi
 * @param environmentId
 * @param [imageArchive=null]
 */
export class UviMachineComponentBuilder extends MachineComponentBuilder {

    constructor(uvi, environmentId, imageArchive = null) {
        super(environmentId, imageArchive);
        this.type = "uvi";

        this.uviUrl = uvi.url;
        this.uviFilename = uvi.filename;
        this.uviWriteable = uvi.writeable;
        this.auxFiles = uvi.auxFiles;
    }
    /**
     *
     *
     * @return
     * @memberof UviMachineComponentBuilder
     */
    build() {
        let component = {
            uviUrl: this.uviUrl,
            uviFilename: this.uviFilename,
            uviWriteable: this.uviWriteable,
            auxFiles: this.auxFiles
        };

        return Object.assign(component, super.build());
    }
}