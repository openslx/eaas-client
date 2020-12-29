const loadScript = (src) =>
  new Promise((onload, onerror) => {
    const script = document.createElement("script");
    Object.assign(script, { src, onload, onerror });
    document.head.append(script);
    script.remove();
  });

const WorkerCORS = new Proxy(Worker, {
  construct(target, argArray, newTarget) {
    const scriptURL = argArray[0];
    // TODO: Do not interfere if scriptURL is same-origin
    const patchImportScripts = (scriptURL) => {
      importScripts = new Proxy(importScripts, {
        apply(target, thisArgument, argumentsList) {
          Reflect.apply(
            target,
            thisArgument,
            argumentsList.map((v) => new URL(v, scriptURL))
          );
        },
      });
      importScripts(scriptURL);
    };
    const srcText = `(${patchImportScripts}).apply(undefined, ${JSON.stringify([
      scriptURL,
    ])});`;
    console.debug(srcText);
    const blob = new Blob([srcText]);
    const blobURL = URL.createObjectURL(blob);
    argArray[0] = blobURL;
    return Reflect.construct(target, argArray, newTarget);
  },
});

export async function prepareAndLoadXpra(xpraUrl, xpraConf) {
  const xpraPath = new URL("../xpra/", import.meta.url);
  Worker = WorkerCORS;
  await Promise.all([
    loadScript(new URL("./js/lib/zlib.js", xpraPath)),
    loadScript(new URL("./js/lib/aurora/aurora.js", xpraPath)),
    loadScript(new URL("./js/lib/lz4.js", xpraPath)),
    loadScript(new URL("./js/lib/jquery-ui.js", xpraPath)),
    loadScript(new URL("./js/lib/jquery.ba-throttle-debounce.js", xpraPath)),
  ]);
  // TODO: Performance: Preload these dependencies before the previous `await`
  await Promise.all([
    loadScript(new URL("./js/lib/bencode.js", xpraPath)),
    loadScript(new URL("./js/lib/forge.js", xpraPath)),
    loadScript(new URL("./js/lib/wsworker_check.js", xpraPath)),
    loadScript(new URL("./js/lib/broadway/Decoder.js", xpraPath)),
    loadScript(new URL("./js/lib/aurora/aurora-xpra.js", xpraPath)),
    loadScript(new URL("./eaas-xpra.js", xpraPath)),
    loadScript(new URL("./js/Keycodes.js", xpraPath)),
    loadScript(new URL("./js/Utilities.js", xpraPath)),
    loadScript(new URL("./js/Notifications.js", xpraPath)),
    loadScript(new URL("./js/MediaSourceUtil.js", xpraPath)),
    loadScript(new URL("./js/Window.js", xpraPath)),
    loadScript(new URL("./js/Protocol.js", xpraPath)),
    loadScript(new URL("./js/Client.js", xpraPath)),
  ]);
  this.xpraClient = loadXpra(xpraUrl, xpraPath, xpraConf, this);
}
