importScripts = new Proxy(importScripts, {
    apply(target, thisArgument, argumentsList) {
        Reflect.apply(target, thisArgument, argumentsList.map(v => `js/${v}`));
    },
})

importScripts("Protocol.js");

if (!self.setImmediate) {
    const handlers = [];
    const {port1, port2} = new MessageChannel();
    port2.onmessage = () => handlers.shift()();

    self.setImmediate = (handler, ...args) => {
      handlers.push(() => handler(...args));
      port1.postMessage(undefined);
    }
}

XpraProtocol.prototype.process_receive_queue = new Proxy(XpraProtocol.prototype.process_receive_queue, {
    apply(target, thisArgument, argumentsList) {
        Reflect.apply(target, thisArgument, argumentsList);
        if (thisArgument.rQ.length > 0) setImmediate(() => thisArgument.process_receive_queue());
    },
})
