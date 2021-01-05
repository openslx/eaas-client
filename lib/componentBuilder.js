class ComponentBuilder {

    constructor()
    {
        /*
            InputMedium
        */
       this.options;

    }

    setComponentOptions(options)
    {
        this.options = options;
    }

    build() {
        if(!this.options)
            return {};
        let component = {
            options: {
                cpuMillicores: this.options.cpuMillicores,
                memory: this.options.memory,
                userData: this.options.userData
            }
        }
        return component;
    }
}

export class ComponentOptions
{
    constructor(userData)
    {
        this.userData = userData;
        this.cpuMillicores;
        this.memory; 
    }

    setUserData(val)
    {
        this.userData = val;
    }

    setCpu(val)
    {
        this.cpuMillicores = val;
    }

    setMemory(val)
    {
        this.memory = val;
    }
}

export class InputBuilder 
{
    constructor (destination) {
        this.size = 512;
        this.destination = destination;
        this.content = [];
        this.partition_table_type = undefined;
        this.filesystem_type = undefined;
        this.type = undefined;
    }

    setDestination(d)
    {
        this.destination = d;
    }

    setSize(_size)
    {
        this.size = _size;
    }

    addContent(c)
    {
        this.content.push(c);
    }

    build() {
        let input_data = {};
        input_data.size_mb = this.size;
        input_data.destination = this.destination;
        input_data.partition_table_type = this.partition_table_type;
        input_data.filesystem_type = this.filesystem_type;
        input_data.type = this.type;

        input_data.content = [];
        this.content.forEach(element => {
            input_data.content.push(element.build());
        });
        return input_data;
    }
}


export class InputContentBuilder {
    constructor(url) {
        this.action = "copy";
        this.url = url;
        this.compression_format = "tar";
        this.name;
    }

    setUrl(_url)
    {
        this.url = _url;
    }

    setName(_name)
    {
        this.name = _name;
    }

    setAction(_action)
    {
        this.action = _action;
    }

    setCompressionFmt(_cFmt)
    {
        this.compression_format = _cFmt;
    }

    build() {
        let content = {};

        content.action = this.action;
        content.url = this.url;
        content.compression_format = this.compression_format;
        content.name = this.name;

        return content;
    }
}

export class MachineComponentBuilder extends ComponentBuilder {

    constructor(environmentId, imageArchive = null) {
        super();

        this.type = "machine";

        // possible machine component config fields

        // required;
        this.environment = environmentId;

        this.userMedia = [];
        this.input_data = [];
       
        // optional
        this.archive = imageArchive;
        this.inputs = [];

        this.object;
        this.objectArchive;
        
        this.software;

        // boolean
        this._lockEnvironment;
        this.emulatorVersion;
        this.nic;
        this.linuxRuntimeData;

        this.keyboardLayout;
        this.keyboardModel;

        // ui only settings
        this.interactive = false;

        // for internal use, if network is configure
        this.networkSettings = null;
    }


    addUserMedia(url, mediumType)
    {
        this.userMedia.push({
            url: url,
            mediumType: mediumType
        });
    }

    getNetworkConfig() 
    {
        return this.networkSettings;
    }

    setNetworkConfig(val)
    {
        this.networkSettings = val;
    }

    getId()
    {
        return this.environment;
    }

    setInteractive(val)
    {
        this.interactive = val;
    }

    isInteractive()
    {
        return this.interactive;
    }

    setImageArchive(archive)
    {
        this.archive = archive;
    }

    addInputMedia(inputMedia)
    {
        this.inputs.push(inputMedia.build());
    }

    setObject(objectId, objectArchive)
    {    
        this.object = objectId;
        this.objectArchive = objectArchive;
    }

    setSoftware(val)
    {
        this.software = val;
    }

    lockEnvironment(doLock = true)
    {
        this.lockEnvironment = doLock;
    }

    setEmulatorVersion(emulatorVersion)
    {
        this.emulatorVersion = emulatorVersion;
    }

    setEthernetAddress(mac)
    {
        this.nic = mac;
    }

    setRuntime(r)
    {
        this.linuxRuntimeData = r.build();
    }

    addRuntimeInput(i)
    {
        this.input_data.push(i);
    }

    setLinuxRuntime(runtime)
    {
        if(!runtime)
            return;

        this.linuxRuntimeData = {
            userContainerEnvironment: runtime.userContainerEnvironment,
            userContainerArchive: runtime.userContainerArchive,
            isDHCPenabled: runtime.networking.isDHCPenabled,
            isTelnetEnabled: runtime.networking.isTelnetEnabled,
            userEnvironment: runtime.userEnvironment,
        };
        this.inputs = runtime.input_data;
    }

    setKeyboard(layout, model)
    {
        this.keyboardLayout = layout;
        this.model = model;
    }

    build() {
        if(!this.environment)
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
            keyboardModel: this.keyboardModel,
        };
        if(this.input_data)
        {
            component.input_data = [];
            this.input_data.forEach(element => {
                component.input_data.push(element.build());
            });
        }
        else 
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

export class ContainerRuntimeBuilder {
    constructor(envId, archive = "default") {
        this.environmentId = envId;
        this.archive = archive;
        this.isDHCPenabled = false;
        this.isTelnetEnabled = false;
        this.userEnvironment = [];
        this.input = [];
    }

    enableDhcp(b = true)
    {
        this.isDHCPenabled = b;
    }

    enableTelnet(b = true)
    {
        this.isTelnetEnabled = b;
    }

    addUserEnvironment(env)
    {
        this.userEnvironment.push(env);
    } 

    build() 
    {
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

export class UviMachineComponentBuilder extends MachineComponentBuilder {
    constructor(uvi, environmentId, imageArchive = null) {
        super(environmentId, imageArchive);
        this.type = "uvi";

        this.uviUrl = uvi.url;
        this.uviFilename = uvi.filename;
        this.uviWriteable = uvi.writeable;
        this.auxFiles = uvi.auxFiles;
    }

    build()
    {
        let component = {
            uviUrl: this.uviUrl,
            uviFilename: this.uviFilename,
            uviWriteable: this.uviWriteable,
            auxFiles: this.auxFiles
        };

        return Object.assign(component, super.build());
    }
}