import(import.meta.url).then(v=>window.mod=v);

import "https://rawgit.com/creatorrr/web-streams-polyfill/master/dist/polyfill.min.js";
import picotcp from "./picotcp.js";

export { picotcp };

const sleep = ms => new Promise(r => setTimeout(r, ms));

/*
wait = ms=>{for(const end = performance.now() + ms; performance.now() < end;);}
setInterval(()=>{console.log(++x);wait(1100*a);console.log("done",x);}, 1000);x=0;a=1
*/


/** @param {Uint8Array} buffer */
window.SEND = buffer => {
    /** @type {WebSocket} */ const ws = window.ws;
    const length = buffer.length;
    // console.log("SENDING into VM -->", buffer, length);
    const blob = new Blob([new Uint8Array([length >> 8, length & 0xff]), buffer]);
    ws.send(blob);
    return length;
};

window.POLL = (n, dev, module) => {
    while (n--) {
        if (!window.Q.length) break;
        const buf = window.Q.shift();
        // TODO: When do we need to free this?
        const pointer = module._malloc(buf.length);
        module.writeArrayToMemory(buf, pointer);
        // console.log("<-- GETTING from VM", new Uint8Array(buf), buf.length, pointer);
        module.ccall("pico_stack_recv", "number", ["number", "number", "number"],
            [dev, pointer, buf.length]);
    }
    return n;
};
window.Q = [];

export const messages = [];
export async function start(data) {
    // if (typeof TransformStream === "undefined") await import("https://rawgit.com/creatorrr/web-streams-polyfill/master/dist/polyfill.min.js");

    const urls = Object.entries(data).filter(([k])=>k.startsWith("ws+ethernet+"));
    const url = new URL(urls[0][1]);
    const ws = new WebSocket(url);

    let stack;
    ws.onopen = async () => {
        await sleep(7000);
        console.log("open ws");
        stack = picotcp();
        console.log("opoen,", stack);
        setInterval(() => stack._pico_stack_tick(), 500);
    };
    ws.binaryType = "arraybuffer";
    /*ws.onmessage = ev => {
        const buf = new Uint8Array(ev.data);
        messages.push(Array.from(buf));
        console.log(buf);
    };*/

    window.ws = ws;
    const stream = wrapWebSocket(ws)
        .pipeThrough(new Uint8ArrayStream())
        .pipeThrough(new VDEParser())
/*        // VDE does not send a CRC.
        .pipeThrough(new EthernetParser({crcLength: 0}))
        // .pipeThrough(new EthernetPrinter())
        .pipeThrough(new IPv4Parser())
        .pipeThrough(new UDPParser())
*/        ;
    const read = stream.getReader();

    for await (const chunk of read) {
        window.Q.push(chunk);
        try { stack._pico_stack_tick(); } catch (e) {}
        // console.log(chunk);
    }

}

new ReadableStream().getReader().__proto__[Symbol.asyncIterator] = function () {
    return {
        next: () => this.read(),
    };
}

export class EthernetPrinter extends TransformStream {
    constructor() {
        /**
         * @param {Uint8Array} frame
         * @param {*} controller
         */
        const transform = (frame, controller) => {
            controller.enqueue({
                ...frame,
                source: Array.from(frame.source).map(v => v.toString(16)),
                dest: Array.from(frame.dest).map(v => v.toString(16)),
                type: frame.type.toString(16),
                frame,
            });
        };
        super({transform});
    }
}

export function wrapWebSocket(ws) {
    return new ReadableStream({
        start(controller) {
            ws.addEventListener("message", ({data}) => controller.enqueue(data));
        }
    });
}

export class Uint8ArrayStream extends TransformStream {
    constructor(websocketStream) {
        super({
            async transform(chunk, controller) {
                let ret;
                if (chunk instanceof Blob) {

                }
                if (chunk instanceof ArrayBuffer) ret = new Uint8Array(chunk);
                else return;
                controller.enqueue(ret);
            }
        });
    }
}

/**
 * @see <https://tools.ietf.org/html/rfc768>
 */
export class UDPParser extends TransformStream {
    /**
     * @param {payload: Uint8Array} lower
     * @param {*} controller
     */
    static transform(lower, controller) {
        const {payload} = lower;
        const ret = {
            source: payload[0] << 8 | payload[1],
            dest: payload[2] << 8 | payload[3],
            length: payload[4] << 8 | payload[5],
            checksum: payload[6] << 8 | payload[7],
        };
        Object.assign(ret, {
            payload: payload.subarray(8, ret.length),
            lower,
        });
        controller.enqueue(ret);
    }
    constructor() { super(new.target); }
}

/**
 * @see <https://tools.ietf.org/html/rfc791>
 */
export class IPv4Parser extends TransformStream {
    /**
     * @param {payload: Uint8Array} lower
     * @param {*} controller
     */
    static transform(lower, controller) {
        const {type, payload} = lower;
        if (type !== 0x800) return;
        const ret = {
            version: payload[0] >> 4,
            ihl: payload[0] & 0b1111,
            dscp: payload[1] >> 2,
            ecn: payload[1] & 0b11,
            length: payload[2] << 8 | payload[3],
            id: payload[4] << 8 | payload[5],
            flags: payload[6] >> 5,
            fragmentOffset: (payload[6] & 0b11111) << 8 | payload[7],
            ttl: payload[8],
            /** @see <https://www.iana.org/assignments/protocol-numbers/protocol-numbers.xhtml> */
            protocol: payload[9],
            headerChecksum: payload[10] << 8 | payload[11],
            source: payload.subarray(12, 12 + 4),
            dest: payload.subarray(16, 16 + 4),
        }
        const headerLength = 20;
        // TODO: options.
        Object.assign(ret, {
            payload: payload.subarray(headerLength, ret.length),
            lower,
        });
        controller.enqueue(ret);
    }
    constructor() { super(new.target); }
}

/**
 * @see <https://en.wikipedia.org/wiki/Ethernet_frame>
 */
export class EthernetParser extends TransformStream {
    constructor({crcLength = 4}) {
        super({
            /**
             * @param {Uint8Array} frame
             * @param {*} controller
             */
            transform(frame, controller) {
                const dest = frame.subarray(0, 6);
                const source = frame.subarray(6, 12);
                /** @see <https://www.iana.org/assignments/ieee-802-numbers/ieee-802-numbers.xhtml> */
                const type = frame[12] << 8 | frame[13];
                const payload = frame.subarray(14, crcLength ? -crcLength : undefined);
                const crc = crcLength ? frame.subarray(-4) : null;
                controller.enqueue({source, dest, type, payload, crc, lower: frame});
            }
        });
    }
}

export class VDEParser extends TransformStream {
    // No WebSocket message has more than 1500 octets; however,
    // Ethernet frames (and VDE headers) may be arbitrarily
    // spreaded over several messages. There can also be several
    // Ethernet frames per WebSocket message.
    constructor(websocketStream) {
        /** @type {Uint8Array} */
        let leftover = null;
        /** @type {Uint8Array} */
        let leftoverHeader = null;
        super({
            /**
             * @param {Uint8Array} chunk
             * @param {*} controller
             */
            transform(chunk, controller) {
                if (leftover) {
                    const chunkLength = chunk.length;
                    leftover.set(chunk);
                    chunk = chunk.subarray(leftover.length);
                    leftover = leftover.subarray(chunkLength);
                    if (leftover.length === 0) {
                        controller.enqueue(new Uint8Array(leftover.buffer));
                        leftover = null;
                    }
                }
                for (; chunk.length;) {
                    if (chunk.length == 1) {
                        leftoverHeader = chunk;
                        return;
                    }
                    // Read VDE header (unsigned integer length of following
                    // Ethernet frame as 2 octets in big-endian format).
                    // @see <https://github.com/virtualsquare/vde-2/blob/6736126558ee915459e0a03bdfb223f8454bda7a/src/lib/libvdeplug.c#L740>
                    let length;
                    if (leftoverHeader) {
                        length = leftoverHeader[0] << 8 | chunk[0];
                        leftoverHeader = null;
                        chunk = chunk.subarray(1);
                    } else {
                        length = chunk[0] << 8 | chunk[1];
                        chunk = chunk.subarray(2);
                    }
                    if (chunk.length >= length) {
                        controller.enqueue(chunk.subarray(0, length));
                        chunk = chunk.subarray(length);
                    } else {
                        leftover = new Uint8Array(length);
                        leftover.set(chunk);
                        leftover = leftover.subarray(chunk.length);
                        return;
                    }
                }
            }
        });
    }
}