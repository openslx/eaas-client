import {
    ClientError,
    _fetch
} from './util.js';
import EventTarget from "../third_party/event-target/esm/index.js";
/**
 *
 *
 * @export
 * @class NetworkSession
 * @extends {EventTarget}
 * @param api
 * @param [idToken=null]
 */
export class ComputeSession extends EventTarget {

    constructor(api, idToken = null) {
        super();
        this.sessionId = undefined;
        this.API_URL = api;
        this.idToken = idToken;
      
    }

    /**
     *
     *
     * @param sessions
     * @param options
     * @memberof ComputeSession
     */
    async start(sessions, options) {
        
        let request = {}; 
        request.components = [];
        if(options && options.timeout)
            request.timeout = options.timeout;

        sessions.forEach(session => {
            let comp = {};
            comp.componentId = session.componentId;
            comp.environmentId = session.environmentId;
            comp.saveEnvironmentLabel = "test";
            request.components.push(comp);
        });

        let result = await _fetch(`${this.API_URL}/compute`, "POST", request, this.idToken);
        this.sessionId = result.id;
        console.log(result.id);
    }

    async state() {
        return await _fetch(`${this.API_URL}/compute/${this.sessionId}`, "GET", null, this.idToken);
    }

}
