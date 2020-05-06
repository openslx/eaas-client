

export class InputMediaBuilder {

    constructor(type)
    {
        this.type = type;
        this.partTableType;
        this.fileSystemType;
        this.sizeInMb;
        this.destination;
        this.extfiles = [];
    }

    setPartitionTable(type)
    {
        this.partTableType = type;
    }

    setFileystem(type)
    {
        this.fileSystemType = type;
    }

    setDestination(dest)
    {
        this.destination = dest;
    }

    addFile(extFile)
    {
        this.extfiles.push(extFile);
    }    
    
    build()
    {
        return {
            type: this.type,
            partTableType: this.partTableType,
            fileSystemType: this.fileSystemType,
            sizeInMb: this.sizeInMb,
            destination: this.destination,
            extfiles: this.extfiles
        };
    }
}