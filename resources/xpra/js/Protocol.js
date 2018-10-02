function XpraProtocolWorkerHost() {
    this.worker = null;
    this.packet_handler = null;
    this.packet_ctx = null
}

XpraProtocolWorkerHost.prototype.open = function (uri) {
    var me = this;
    if (this.worker) {
        this.worker.postMessage({c: "o", u: uri});
        return
    }
    this.worker = new Worker("js/Protocol.js");
    this.worker.addEventListener("message", function (e) {
        var data = e.data;
        switch (data.c) {
            case"r":
                me.worker.postMessage({c: "o", u: uri});
                break;
            case"p":
                if (me.packet_handler) {
                    me.packet_handler(data.p, me.packet_ctx)
                }
                break;
            case"l":
                console.log(data.t);
                break;
            default:
                console.error("got unknown command from worker");
                console.error(e.data)
        }
    }, false)
};
XpraProtocolWorkerHost.prototype.close = function () {
    this.worker.postMessage({c: "c"})
};
XpraProtocolWorkerHost.prototype.terminate = function () {
    this.worker.postMessage({c: "t"})
};
XpraProtocolWorkerHost.prototype.send = function (packet) {
    this.worker.postMessage({c: "s", p: packet})
};
XpraProtocolWorkerHost.prototype.set_packet_handler = function (callback, ctx) {
    this.packet_handler = callback;
    this.packet_ctx = ctx
};
XpraProtocolWorkerHost.prototype.set_cipher_in = function (caps, key) {
    this.worker.postMessage({c: "z", p: caps, k: key})
};
XpraProtocolWorkerHost.prototype.set_cipher_out = function (caps, key) {
    this.worker.postMessage({c: "x", p: caps, k: key})
};

function XpraProtocol() {
    this.is_worker = false;
    this.packet_handler = null;
    this.packet_ctx = null;
    this.websocket = null;
    this.raw_packets = [];
    this.cipher_in = null;
    this.cipher_in_block_size = null;
    this.cipher_out = null;
    this.rQ = [];
    this.sQ = [];
    this.mQ = [];
    this.header = [];
    this.process_interval = 0
}

XpraProtocol.prototype.open = function (uri) {
    var me = this;
    this.raw_packets = [];
    this.rQ = [];
    this.sQ = [];
    this.mQ = [];
    this.header = [];
    this.websocket = null;
    try {
        this.websocket = new WebSocket(uri, "binary")
    } catch (e) {
        this.packet_handler(["error", "" + e], this.packet_ctx);
        return
    }
    this.websocket.binaryType = "arraybuffer";
    this.websocket.onopen = function () {
        me.packet_handler(["open"], me.packet_ctx)
    };
    this.websocket.onclose = function () {
        me.packet_handler(["close"], me.packet_ctx)
    };
    this.websocket.onerror = function () {
        me.packet_handler(["error"], me.packet_ctx)
    };
    this.websocket.onmessage = function (e) {
        me.rQ.push(new Uint8Array(e.data));
        setTimeout(function () {
            me.process_receive_queue()
        }, this.process_interval)
    }
};
XpraProtocol.prototype.close = function () {
    if (this.websocket) {
        this.websocket.onopen = null;
        this.websocket.onclose = null;
        this.websocket.onerror = null;
        this.websocket.onmessage = null;
        this.websocket.close();
        this.websocket = null
    }
};
XpraProtocol.prototype.protocol_error = function (msg) {
    console.error("protocol error:", msg);
    this.websocket.onopen = null;
    this.websocket.onclose = null;
    this.websocket.onerror = null;
    this.websocket.onmessage = null;
    this.header = [];
    this.rQ = [];
    this.packet_handler(["close", msg])
};
XpraProtocol.prototype.process_receive_queue = function () {
    var i = 0, j = 0;
    if (this.header.length < 8 && this.rQ.length > 0) {
        while (this.header.length < 8 && this.rQ.length > 0) {
            var slice = this.rQ[0];
            var needed = 8 - this.header.length;
            var n = Math.min(needed, slice.length);
            for (i = 0; i < n; i++) {
                this.header.push(slice[i])
            }
            if (slice.length > needed) {
                this.rQ[0] = slice.subarray(n)
            } else {
                this.rQ.shift()
            }
        }
        if (this.header[0] !== ord("P")) {
            msg = "invalid packet header format: " + this.header[0];
            if (this.header.length > 1) {
                msg += ": ";
                for (c in this.header) {
                    msg += String.fromCharCode(c)
                }
            }
            this.protocol_error(msg);
            return
        }
    }
    if (this.header.length < 8) {
        return
    }
    var proto_flags = this.header[1];
    var proto_crypto = proto_flags & 2;
    if (proto_flags != 0) {
        if (!proto_crypto) {
            this.protocol_error("we can't handle this protocol flag yet: " + proto_flags);
            return
        }
    }
    var level = this.header[2];
    if (level & 32) {
        this.protocol_error("lzo compression is not supported");
        return
    }
    var index = this.header[3];
    if (index >= 20) {
        this.protocol_error("invalid packet index: " + index);
        return
    }
    var packet_size = 0;
    for (i = 0; i < 4; i++) {
        packet_size = packet_size * 256;
        packet_size += this.header[4 + i]
    }
    var padding = 0;
    if (proto_crypto) {
        padding = this.cipher_in_block_size - packet_size % this.cipher_in_block_size;
        packet_size += padding
    }
    var rsize = 0;
    for (i = 0, j = this.rQ.length; i < j; ++i) {
        rsize += this.rQ[i].length
    }
    if (rsize < packet_size) {
        return
    }
    this.header = [];
    var packet_data = null;
    if (this.rQ[0].length == packet_size) {
        packet_data = this.rQ.shift()
    } else {
        packet_data = new Uint8Array(packet_size);
        rsize = 0;
        while (rsize < packet_size) {
            var slice = this.rQ[0];
            var needed = packet_size - rsize;
            if (slice.length > needed) {
                packet_data.set(slice.subarray(0, needed), rsize);
                rsize += needed;
                this.rQ[0] = slice.subarray(needed)
            } else {
                packet_data.set(slice, rsize);
                rsize += slice.length;
                this.rQ.shift()
            }
        }
    }
    if (proto_crypto) {
        this.cipher_in.update(forge.util.createBuffer(uintToString(packet_data)));
        var decrypted = this.cipher_in.output.getBytes();
        packet_data = [];
        for (i = 0; i < decrypted.length; i++) packet_data.push(decrypted[i].charCodeAt(0));
        packet_data = packet_data.slice(0, -1 * padding)
    }
    if (level != 0) {
        if (level & 16) {
            var d = packet_data.subarray(0, 4);
            var length = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24;
            var inflated = new Uint8Array(length);
            var uncompressedSize = LZ4.decodeBlock(packet_data, inflated, 4);
            if (uncompressedSize <= 0 && packet_size + uncompressedSize != 0) {
                this.protocol_error("failed to decompress lz4 data, error code: " + uncompressedSize);
                return
            }
        } else {
            var inflated = new Zlib.Inflate(packet_data).decompress()
        }
        packet_data = inflated
    }
    if (index > 0) {
        this.raw_packets[index] = packet_data
    } else {
        var packet = null;
        try {
            packet = bdecode(packet_data);
            for (var index in this.raw_packets) {
                packet[index] = this.raw_packets[index]
            }
            this.raw_packets = {};
            if (packet[0] === "draw" && packet[6] !== "scroll") {
                var img_data = packet[7];
                if (typeof img_data === "string") {
                    var uint = new Uint8Array(img_data.length);
                    for (i = 0, j = img_data.length; i < j; ++i) {
                        uint[i] = img_data.charCodeAt(i)
                    }
                    packet[7] = uint
                }
            }
            if (this.is_worker) {
                this.mQ[this.mQ.length] = packet;
                var me = this;
                setTimeout(function () {
                    me.process_message_queue()
                }, this.process_interval)
            } else {
                this.packet_handler(packet, this.packet_ctx)
            }
        } catch (e) {
            console.error("error processing packet " + e)
        }
    }
};
XpraProtocol.prototype.process_send_queue = function () {
    while (this.sQ.length !== 0 && this.websocket) {
        var packet = this.sQ.shift();
        if (!packet) {
            return
        }
        var bdata = null;
        try {
            bdata = bencode(packet)
        } catch (e) {
            console.error("Error: failed to bencode packet:", packet);
            continue
        }
        var proto_flags = 0;
        var payload_size = bdata.length;
        if (this.cipher_out) {
            proto_flags = 2;
            var padding_size = this.cipher_out_block_size - payload_size % this.cipher_out_block_size;
            for (var i = padding_size - 1; i >= 0; i--) {
                bdata += String.fromCharCode(padding_size)
            }
            this.cipher_out.update(forge.util.createBuffer(bdata));
            bdata = this.cipher_out.output.getBytes()
        }
        var actual_size = bdata.length;
        var cdata = [];
        for (var i = 0; i < actual_size; i++) cdata.push(ord(bdata[i]));
        var level = 0;
        var header = ["P".charCodeAt(0), proto_flags, level, 0];
        for (var i = 3; i >= 0; i--) header.push(payload_size >> 8 * i & 255);
        header = header.concat(cdata);
        if (this.websocket) {
            this.websocket.send(new Uint8Array(header).buffer)
        }
    }
};
XpraProtocol.prototype.process_message_queue = function () {
    while (this.mQ.length !== 0) {
        var packet = this.mQ.shift();
        if (!packet) {
            return
        }
        var raw_draw_buffer = packet[0] === "draw" && packet[6] !== "scroll";
        postMessage({c: "p", p: packet}, raw_draw_buffer ? [packet[7].buffer] : [])
    }
};
XpraProtocol.prototype.send = function (packet) {
    this.sQ[this.sQ.length] = packet;
    var me = this;
    setTimeout(function () {
        me.process_send_queue()
    }, this.process_interval)
};
XpraProtocol.prototype.set_packet_handler = function (callback, ctx) {
    this.packet_handler = callback;
    this.packet_ctx = ctx
};
XpraProtocol.prototype.set_cipher_in = function (caps, key) {
    this.cipher_in_block_size = 32;
    var secret = forge.pkcs5.pbkdf2(key, caps["cipher.key_salt"], caps["cipher.key_stretch_iterations"], this.cipher_in_block_size);
    this.cipher_in = forge.cipher.createDecipher("AES-CBC", secret);
    this.cipher_in.start({iv: caps["cipher.iv"]})
};
XpraProtocol.prototype.set_cipher_out = function (caps, key) {
    this.cipher_out_block_size = 32;
    var secret = forge.pkcs5.pbkdf2(key, caps["cipher.key_salt"], caps["cipher.key_stretch_iterations"], this.cipher_out_block_size);
    this.cipher_out = forge.cipher.createCipher("AES-CBC", secret);
    this.cipher_out.start({iv: caps["cipher.iv"]})
};
if (!(typeof window == "object" && typeof document == "object" && window.document === document)) {
    importScripts("lib/bencode.js", "lib/zlib.js", "lib/lz4.js", "lib/forge.js");
    var protocol = new XpraProtocol;
    protocol.is_worker = true;
    protocol.set_packet_handler(function (packet, ctx) {
        var raw_draw_buffer = packet[0] === "draw" && packet[6] !== "scroll";
        postMessage({c: "p", p: packet}, raw_draw_buffer ? [packet[7].buffer] : [])
    }, null);
    self.addEventListener("message", function (e) {
        var data = e.data;
        switch (data.c) {
            case"o":
                protocol.open(data.u);
                break;
            case"s":
                protocol.send(data.p);
                break;
            case"x":
                protocol.set_cipher_out(data.p, data.k);
                break;
            case"z":
                protocol.set_cipher_in(data.p, data.k);
                break;
            case"c":
                protocol.close();
                break;
            case"t":
                self.close();
                break;
            default:
                postMessage({c: "l", t: "got unknown command from host"})
        }
    }, false);
    postMessage({c: "r"})
}
var Buffer = require("buffer").Buffer;
var LZ4 = require("lz4");