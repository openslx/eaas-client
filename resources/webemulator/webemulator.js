class WebEmulator {
  constructor() {
    window.emu = this;

  const params = new URLSearchParams(location.hash.slice(1), location);
  const controlURLs = JSON.parse(params.get("controlurls"));
  const controlURL = new URL(controlURLs.webemulator, location);
  controlURL.protocol = controlURL.protocol.replace(/^http/, "ws");
  controlURL.hash = "";
  const socket = this._socket = new RPCSocket(controlURL);


  socket.addEventListener("notification", (ev) => {
    const data = JSON.parse(ev.data);
    switch (data.type) {
      case "prepareEmulatorRunner":

      break;
      case "start":
        this.start();
      break;
      case "connectDrive":
        const file = new WebEmulatorFile({socket, fd: data.fd, size: 500000000}, data.fd);
        this.connectDrive(data.drive, file, data.connect);
      break;
      case "addNic":
        const macaddr = data.macaddr;
        const url = controlURLs[`ws+ethernet+${macaddr}`];
        const ws = new WS(url);
        this.addNic(macaddr, ws);
      break;
    }
  });

  }
  //const file = new WebEmulatorFile({socket, fd: 1, size: 500000000});

  start() {}
  prepareEmulatorRunner() {}
  connectDrive() {}
  addNic() {}
}

{

/**
 Implementation of
 https://w3c.github.io/FileAPI/
*/

class GenericFile extends File {
  constructor(backing, fileName = "", ...rest) {
    super([], fileName, ...rest);
    this._fileName = fileName;
    this._backing = backing;
    this._rest = rest;
    this._size = backing.size;
    this._offset = 0;
  }

  get size() { return this._size; }
  get offset() { return this._offset; }

  slice(start = 0, end = this.size) {
    // <https://w3c.github.io/FileAPI/#slice-method-algo>
    const size = this.size;
    const relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
    const relativeEnd = start < 0 ? Math.max(size + end, 0) : Math.min(end, size);
    const span = Math.max(relativeEnd - relativeStart, 0);
    // `new this.constructor` allows to subclass RemoteBlob (like `Symbol.species`).
    const sliced = new this.constructor(this._backing, this._fileName, ...this._rest);
    sliced._size = span;
    sliced._offset = relativeStart;
    return sliced;
  }

  async toArrayBuffer() {
    const res = await fetch(this.url, {headers: {range: `bytes=${this.offset}-${this.offset+this.size}`}})
    return res.arrayBuffer();
  }
}



class RemoteBlob extends File {
  constructor(url, _size, _offset = 0, _root = null) {
    super([], "");
    Object.assign(this, {url, _size, _offset, _root});
  }

  get size() { return this._size; }
  get offset() { return this._offset; }

  slice(start = 0, end = this.size) {
    // <https://w3c.github.io/FileAPI/#slice-method-algo>
    const size = this.size;
    const relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
    const relativeEnd = start < 0 ? Math.max(size + end, 0) : Math.min(end, size);
    const span = Math.max(relativeEnd - relativeStart, 0);
    // `new this.constructor` allows to subclass RemoteBlob (like `Symbol.species`).
    return new this.constructor(this.url, span, relativeStart, this);
  }

  async toArrayBuffer() {
    const res = await fetch(this.url, {headers: {range: `bytes=${this.offset}-${this.offset+this.size}`}})
    return res.arrayBuffer();
  }
}

class WebEmulatorFile extends GenericFile {
  async toArrayBuffer() {
    const backing = this._backing;
    return (await backing.socket.send(JSON.stringify({pos: this.offset, size: this.size, fd: backing.fd}))).data;
  }
}

class WebsocketBlob extends RemoteBlob {
  constructor(url, ...rest) {
    super(url, ...rest);
    this.remote = this._root && this._root.remote || (typeof url === "string" ? new RPCSocket(url) : url);
  }

  async toArrayBuffer() {
    return (await this.remote.send(JSON.stringify({pos: this.offset, size: this.size, fd:1}))).data;
  }
}

/**
class ResumableSocket extends WebSocket {
  constructor(...args) {
    this._websocket = new WebSocket();
    this.addEventListener("message", message => {
      if 
    });
  }
}
*/

function castGet(object, Class, property) {
  return Object.getOwnPropertyDescriptor(Class.prototype, property).get.call(this);
}
function castSet(object, Class, property, value) {
  return Object.getOwnPropertyDescriptor(Class.prototype, property).set.call(this, value);
}

window.setImmediate2 = window.setImmediate;

// Simple polyfill of <https://w3c.github.io/setImmediate/>.
// (HACK: Polyfilling setImmediate directly breaks v86.)
if (!window.setImmediate) {
  const handlers = [];
  const {port1, port2} = new MessageChannel();
  port2.onmessage = () => handlers.shift()();

  window.setImmediate2 = function setImmediate(handler, ...args) {
    handlers.push(() => handler(...args));
    port1.postMessage(undefined);
  }
}




function forwardEvent(from, to, type) {
   // Events cannot be dispatched again while they are currently being
   // dispatched already. Thus, we have to wait till the
   // current macrotask is finished (using `setImmediate`).
   from.addEventListener(type, ev =>
   setImmediate2(() => to._fakeBase === from && to.dispatchEvent(ev)));
}

function copyProperties(from, to, names) {
  for (const name of names) to[name] = from[name];
}

function forwardProperty(Class, property, BaseClass = Object.getPrototypeOf(Class)) {
  Object.defineProperty(Class.prototype, property, {
    get() {
      return Reflect.get(this._fakeBase || BaseClass.prototype, property, this._fakeBase || this);
    },
    set(value) {
      return Reflect.set(this._fakeBase || BaseClass.prototype, property, value, this._fakeBase || this);
    }
  });
}

function forwardMethod(Class, method, BaseClass = Object.getPrototypeOf(Class)) {
  Class.prototype[method] = function (...args) {
    const base = this._fakeBase;
    if (base) return Reflect.apply(base[method], base, args)
    return Reflect.apply(BaseClass.prototype[method], this, args);
  }
}

class WS extends WebSocket {
  constructor(...args) {
    super(...args);
    this._fakeBase = null;
    this._eventNames = [];
    this._constructorArgs = args;
    this.addEventListener("close", (ev) => {
      if (!ev.wasClean) this._constructFakeBase();
    });
  }

  _constructFakeBase() {
    const base = new WebSocket(...this._constructorArgs);
    for (const event of ["open", "error", "close", "message"]) forwardEvent(base, this, event);
    base.binaryType = this.binaryType;
    this._fakeBase = base;
  }
}
for (const prop of ["readyState", "bufferedAmount", "extensions", "protocol", "binaryType"]) forwardProperty(WS, prop);
for (const method of ["close", "send"]) forwardMethod(WS, method);
/*
const x = new WS("wss://echo.websocket.org/");
x.onerror = console.log;
x.onopen = console.log;
x.onclose = console.log;
x.onmessage = console.log;
*/

class ResumableWebSocket extends FileReader {
  constructor(...args) {
    super();
    console.log(args, "con");
    this.lastReceivedEventId = 0;
    this.lastSentEventId = 0;
    this.buffer = new SlidingArray(100);
    this.isReady = false;

    const ws = this.socket = new WS(...args);
    ws.onopen = ev => {
      ws.send(JSON.stringify({lastEventId: this.lastReceivedEventId}));      
    }
    ws.onmessage = ev => {
      // console.log(ev, this.isReady);
      if (this.isReady) {
        this.lastReceivedEventId++;
        return setImmediate2(() => this.dispatchEvent(ev));
      }
      console.log("trying to parse");
      const data = JSON.parse(ev.data);
      console.log("data:", data);
      this.isReady = true;
    }
    ws.onclose = ev => {
      this.isReady = false;
    }
  }

  send(data) {
    this.buffer.push(data);
    this.lastSentEventId++;
    if (this.isReady) this.socket.send(data);
  }
}
ResumableWebSocket.Symbol = Symbol(ResumableWebSocket);


const ReconnectingMixin = Base => class Reconnecting extends Base {
  constructor(...args) {
    super(...args);
    this._fakeBase = null;
    this._eventNames = [];
    this._constructorArgs = args;
  }

  set binaryType(type) {

  }

  addEventListener(name, ...rest) {
    this._eventNames.push(name);
  }

  _constructNewBase() {
    this.add
  }
};

class ReconnectingWebSocket extends ReconnectingMixin(WebSocket) {}

class SlidingArray extends Array {
  push(...args) {
    this.splice(0, args.length);
    super.push(...args);
  }  
}

class RPCSocket extends /*WebSocket*/ ResumableWebSocket {
  constructor(...args) {
    super(...args);
// HACK BUG CHROMIUM
// Object.setPrototypeOf(this, RPCSocket.prototype);
Object.setPrototypeOf(this, new.target.prototype);

    this.addEventListener("message", message => {
      if (typeof message.data === "string") {
        const ev = new CustomEvent("notification");
        ev.data = message.data;
        this.dispatchEvent(ev);
      }
      else {
        console.log("binary");
        this._queue.shift()(message);
      }
    });
    //this._ready = new Promise(resolve => this.addEventListener("open", resolve));
    // no need to wait as ResumableWebSocket is always writable
    this._ready = true;

    this._queue = [];
// HACK:::::
  //this.send(JSON.stringify({lastEventId: 10000000}));
// END HACK::::
  }

  async send(...args) {
    
    await this._ready;
    super.send(...args);
    return new Promise(resolve => this._queue.push(resolve));
  }

}
write = (writer, blob) => writer[writeQueue] = new Promise(async (resolve, reject) => {
  // try { await writer[writeQueue]; } catch (e) {}
  try { writer.write(blob); } catch (e) { reject(e); }
  writer.addEventListener("write", resolve, {once: true});
  writer.addEventListener("error", reject, {once: true});
});



class CustomEventTarget {

}

// TODO: Do not use https://github.com/moxiecode/moxie or similar
// but describe trick to use existing FileReader
// and plug into readAs... calls
// duck typing of blob
//const toArrayBuffer

class GenericFileReader extends FileReader {
  readAsArrayBuffer(blob) {
    if (!blob.toArrayBuffer) return super.readAsArrayBuffer(blob);
    blob.toArrayBuffer().then(v => this.readAsArrayBuffer(new Blob([v])));
  }
}

window.WebEmulatorFile = WebEmulatorFile;
window.RPCSocket = RPCSocket;
window.WS = WS;

window.FileReader = GenericFileReader;

class RemoteFile extends RemoteBlob {
  

}

}
