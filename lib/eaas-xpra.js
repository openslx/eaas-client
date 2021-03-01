const patchXpra = () => {
  if (patchXpra.done) return;
  patchXpra.done = true;

  // TODO: Make configurable
  const translateId = (id) => (id === "screen" ? "emulator-container" : id);

  document.getElementById = new Proxy(document.getElementById, {
    apply(target, thisArg, argArray) {
      argArray[0] = translateId(argArray[0]);
      return Reflect.apply(target, thisArg, argArray);
    },
  });

  XpraClient.prototype.init_state = new Proxy(XpraClient.prototype.init_state, {
    apply(target, thisArg, argArray) {
      const res = Reflect.apply(target, thisArg, argArray);
      thisArg.process_interval = 0;
      thisArg.server_resize_exact = true;
      thisArg.server_is_desktop = true;
      return res;
    },
  });

  XpraClient.prototype.getMouse = function (e, window) {
    const { left, top } = jQuery(this.container).offset();
    const x = e.clientX + jQuery(document).scrollLeft() - left;
    const y = e.clientY + jQuery(document).scrollTop() - top;
    const button = e.which ?? e.button + 1;
    return { x, y, button };
  };

  XpraWindow.prototype.update_zindex = function () {
    this.div.css("z-index", "1000");
  };

  const proxyVisible = {
    apply(target, thisArg, argArray) {
      const { clientHeight, clientWidth } = thisArg.container;
      if (clientHeight === 0 || clientWidth === 0) return true;
      return Reflect.apply(target, thisArg, argArray);
    },
  };
  XpraClient.prototype._keyb_process = new Proxy(
    XpraClient.prototype._keyb_process,
    proxyVisible
  );

  XpraClient.prototype._new_window = new Proxy(
    XpraClient.prototype._new_window,
    {
      apply(target, thisArg, argArray) {
        argArray[1] = 0; // x
        argArray[2] = 0; // y
        argArray[5].decorations = false; // metadata
        return Reflect.apply(target, thisArg, argArray);
      },
    }
  );
};

globalThis.loadXpra = (
  xpraUrl,
  xpraPath,
  { xpraEncoding } = {},
  eaasClientObj
) => {
  {
    // HACK: eaas-client might pass wrong URL
    const xpraUrl2 = new URL(xpraUrl, location);
    xpraUrl2.protocol = xpraUrl2.protocol.replace(/^http/, "ws");
    if (location.protocol == "https:") xpraUrl2.protocol = "wss";
    xpraUrl = String(xpraUrl2);
  }

  patchXpra();

  window.oncontextmenu = () => false;

  const client = new XpraClient("emulator-container");
  client.div = "emulator-container";

  const container = document.getElementById(client.div);
  const windowsList = Object.assign(document.createElement("div"), {
    id: "open_windows_list",
    hidden: true,
  });
  container.append(windowsList);

  client.debug = () => {};
  client.remote_logging = true;
  client.clipboard_enabled = false;
  client.bandwidth_limit = 0;
  client.steal = true;
  client.swap_keys = Utilities.isMacOS();
  client.audio_enabled = false;
  if (xpraEncoding) client.enable_encoding(xpraEncoding);
  client.keyboard_layout = Utilities.getKeyboardLayout();

  const ignore_audio_blacklist = false;
  client.init(ignore_audio_blacklist);

  const xpraUrl2 = new URL(xpraUrl, location);
  client.ssl = xpraUrl2.protocol === "wss:";
  client.host = xpraUrl2.hostname;
  client.port = xpraUrl2.port;
  client.path = xpraUrl2.pathname;

  client.connect(xpraPath);
  eaasClientObj.xpraClient = client;
  return client;
};
