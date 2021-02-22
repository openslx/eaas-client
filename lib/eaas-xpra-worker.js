importScripts = new Proxy(importScripts, {
    apply(target, thisArgument, argumentsList) {
        Reflect.apply(target, thisArgument, argumentsList.map(v => `../xpra/js/${v}`));
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

/*
{
    const target = XpraProtocol.prototype.process_receive_queue;
    XpraProtocol.prototype.process_receive_queue = function (...argumentsList) {
        const thisArgument = this;
        do {
            Reflect.apply(target, thisArgument, argumentsList);
        } while (thisArgument.rQ.length > 0 && thisArgument.header.length === 0);
    }
}
*/

XpraProtocol.prototype.process_receive_queue = new Proxy(XpraProtocol.prototype.process_receive_queue, {
    apply(target, thisArgument, argumentsList) {
        do {
            Reflect.apply(target, thisArgument, argumentsList);
        } while (thisArgument.rQ.length > 0 && thisArgument.header.length === 0);
    },
});
