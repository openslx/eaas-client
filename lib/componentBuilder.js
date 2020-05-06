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

export class MachineComponentBuilder extends ComponentBuilder {

    constructor(environmentId, imageArchive = null) {
        super();

        this.type = "machine";

        // possible machine component config fields

        // required;
        this.environment = environmentId;
       
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
        if(objectId && !objectArchive)
            throw new Error("setObject: requires objectArchive is required");
        
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

    setLinuxRuntime(runtime)
    {
        if(!runtime)
            return;

        this.linuxRuntimeData = {
            userContainerEnvironment: runtime.userContainerEnvironment,
            userContainerArchive: runtime.userContainerArchive,
            isDHCPenabled: runtime.networking.isDHCPenabled,
            isTelnetEnabled: runtime.networking.isTelnetEnabled,
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
            archive: this.archive,
            input_data: this.inputs,
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