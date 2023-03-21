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

  XpraClient.prototype._keyb_process = new Proxy(
    XpraClient.prototype._keyb_process,
    {
      apply(target, thisArg, argArray) {
        const { clientHeight, clientWidth } = thisArg.container;
        if (clientHeight === 0 || clientWidth === 0) return true;
        return Reflect.apply(target, thisArg, argArray);
      },
    }
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

  XpraClient.prototype.send = new Proxy(XpraClient.prototype.send, {
    apply(target, thisArg, argArray) {
      if (
        thisArg.debugLogPackets === true ||
        thisArg.debugLogPackets?.includes(argArray[0][0])
      ) {
        console.debug(argArray[0].flat());
      }
      return Reflect.apply(target, thisArg, argArray);
    },
  });

  Object.defineProperty(XpraWindow.prototype, "windowtype", {
    get() {
      return this.client.windowDecorations ? this._windowtype : "+";
    },
    set(v) {
      this._windowtype = v;
    },
  });

  XpraClient.prototype.on_first_ui_event = function () {
    this._eaasFirstWindowResolve();
    const topwindow = this.id_to_window[this.topwindow];
    topwindow.move(0, 0);
    topwindow.geometry_cb(topwindow);
  };

  XpraClient.prototype._process_window_move_resize = new Proxy(
    XpraClient.prototype._process_window_move_resize,
    {
      apply(target, thisArg, argArray) {
        const [packet] = argArray;
        packet[2] = 0; // x
        packet[3] = 0; // y
        return Reflect.apply(target, thisArg, argArray);
      },
    }
  );

  XpraClient.prototype.process_xdg_menu = () => {};

  // HACK: Make mouse movement relative
  const RELATIVE_OFFSET = -10_000;
  XpraClient.prototype.do_window_mouse_move = new Proxy(
    XpraClient.prototype.do_window_mouse_move,
    {
      apply(target, thisArg, argArray) {
        const [e, window] = argArray;
        if (thisArg.clientGrabbed) {
          const { movementX, movementY } = e.originalEvent;
          const modifiers = thisArg._keyb_get_modifiers(e);
          const buttons = [];
          thisArg.send([
            "pointer-position",
            thisArg.clientGrabbedWid || thisArg.topwindow,
            [movementX + RELATIVE_OFFSET, movementY + RELATIVE_OFFSET],
            modifiers,
            buttons,
          ]);
          return;
        }
        return Reflect.apply(target, thisArg, argArray);
      },
    }
  );

  XpraClient.prototype.do_window_mouse_click = new Proxy(
    XpraClient.prototype.do_window_mouse_click,
    {
      apply(target, thisArg, argArray) {
        const [e, window, pressed] = argArray;
        if (thisArg.forceRelativeMouse && !thisArg.clientGrabbed) {
          thisArg._clientGrabbedFirstClick = true;
          const { container } = thisArg;
          const doc = container.ownerDocument;
          container.requestPointerLock();
          const change = ({ target }) => {
            if (!target.pointerLockElement) {
              thisArg.clientGrabbed = false;
              remove();
            } else {
              thisArg.clientGrabbed = true;
              thisArg.clientGrabbedWid = window && window.wid;
            }
          };
          const error = () => {
            console.error("Could not lock pointer");
            remove();
          };
          const remove = () => {
            doc.removeEventListener("pointerlockchange", change);
            doc.removeEventListener("pointerlockerror", error);
          };
          doc.addEventListener("pointerlockchange", change);
          doc.addEventListener("pointerlockerror", error);
        }
        const ret = Reflect.apply(target, thisArg, argArray);
        if (!pressed) thisArg._clientGrabbedFirstClick = false;
        return ret;
      },
    }
  );

  XpraClient.prototype.getMouse = new Proxy(XpraClient.prototype.getMouse, {
    apply(target, thisArg, argArray) {
      const ret = Reflect.apply(target, thisArg, argArray);
      if (!thisArg._clientGrabbedFirstClick && thisArg.forceRelativeMouse) {
        ret.x = RELATIVE_OFFSET;
        ret.y = RELATIVE_OFFSET;
      }
      return ret;
    },
  });

  XpraClient.prototype._get_desktop_size = new Proxy(
    XpraClient.prototype._get_desktop_size,
    {
      apply(target, thisArg, argArray) {
        // See XpraWindow.prototype.ensure_visible()
        const min_visible = 10;
        let ret = Reflect.apply(target, thisArg, argArray);
        ret = ret.map((v) => Math.max(min_visible, v));
        return ret;
      },
    }
  );

  const ghostCursorAuto = atob("iVBORw0KGgoAAAANSUhEUgAAAA4AAAAWCAYAAADwza0nAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAAB3RJTUUH3gcBFCcYPPpNFQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAKDSURBVDjLlZM/SBtRHMe/93LepZ6eFIXQwU4GiopLHSxCKeUIiAUFRwcHYwZXxSWZsgTEIYiIboEEdPDvYMgZqEPFqUWK4GDULvZqKW3Jcekd713udYlizorND970+33eh/d7vx+ur6+7AATQaFSr1ejW1lYPAKkhkHMeM00zurq62gOgqSFwdHQ0ZppmdHFx8cV/w5zzWFtbW2x8fDxWLpejCwsLYQDiYxwBAEopisUi5ubmyNTU1OtkMvn8MVgEAMYYGGPI5/NobW0NxOPxN7Ztv0+lUlcA3AdB13VBKQVjDDs7O2hpaRFnZ2ff2rZdTKfTBoDqP8G7VsYYNjY2oCiKmEgkNMdx9JWVle9+uA68sVJKsb6+DkVRxGQyGbEsq5DL5X7chcU73a2zMsaQy+UERVGa5ufnI7ZtFzY3N3/ewHWd81sZY8hkMkIwGJTT6XTEsqyCruu/AHgC5zwmCMIt3NzcDFVVkc1meXt7OyeEIBAI8O7u7oBhGObk5GRhf3+/XGeUJAn9/f04OTlBqVRCKBSyl5eXryRJcgkhXJblakdHhwrAujXKsozt7W2vt7cXfX19pLOzE0dHR97Q0NCHw8NDo/afvPZGlwBAMBjE3t6ep6qqValUnLGxMRiGgd3dXSGRSHTVim0ADgAGgBMA0HXdE0XR1DTt+ODg4HM8Hvc8z8PS0pIwODj4bGBg4Kl/ZwkAeJ73OxKJHDuO83V6erokimJlZGQEFxcXOD095cPDw/dml5yfn3/RNO0jpfQbgD8A6NnZ2adUKuXNzMwgHA4Ll5eXLgDBP3ZPAMi+RNPa2trLfD7/bmJi4hWAkN8o1A73XSbUCqVajj60JQ3HXxKQQjZ2meK/AAAAAElFTkSuQmCC");

  XpraWindow.prototype.set_cursor = new Proxy(XpraWindow.prototype.set_cursor, {
    async apply(target, thisArg, argArray) {
      const [encoding, w, h, xhot, yhot, img_data] = argArray;
      if (thisArg.client.ghostCursor !== "none" && encoding == "png") {
        const url = `data:image/${encoding};base64,${btoa(img_data)}`;
        if (await isImageTransparent(url)) {
          argArray[5] = ghostCursorAuto;
        }
      }
      return Reflect.apply(target, thisArg, argArray);
    },
  });

  async function isImageTransparent(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3, ii = data.length; i < ii; i += 4) {
      if (data[i] != 0) return false;
    }
    return true;
  }

  // For debug use in `xpra-html5/html5/index.html`
  /*
  XpraClient = new Proxy(XpraClient, {
    construct(target, argArray, newTarget) {
      const thisArg = Reflect.construct(target, argArray, newTarget);
      thisArg.forceRelativeMouse = true;
      return thisArg;
    },
  });
  */
};

globalThis.loadXpra = (
  xpraUrl,
  xpraPath,
  { xpraEncoding, pointerLock = false, debugLogPackets = true, ghostCursor = "auto" } = {},
  eaasClientObj
) => {
  {
    // HACK: eaas-client might pass wrong URL
    const xpraUrl2 = new URL(xpraUrl, location);
    xpraUrl2.protocol = xpraUrl2.protocol.replace(/^http/, "ws");
    if (location.protocol == "https:" && xpraUrl2.hostname !== "localhost")
      xpraUrl2.protocol = "wss";
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

  document.addEventListener("visibilitychange", (e) => {
    const window_ids = Object.keys(client.id_to_window).map(Number);
    if (client.connected) {
      if (document.hidden) {
        client.send(["suspend", true, window_ids]);
      } else {
        client.send(["resume", true, window_ids]);
        client.redraw_windows();
        client.request_refresh(-1);
      }
    }
  });

  client.debug = () => {};
  client.remote_logging = true;
  client.clipboard_enabled = false;
  client.bandwidth_limit = 0;
  client.steal = true;
  client.swap_keys = Utilities.isMacOS();
  client.audio_enabled = false;
  client.audio_mediasource_enabled = false;
  client.audio_aurora_enabled = false;
  client.audio_httpstream_enabled = false;
  if (xpraEncoding && xpraEncoding !== "auto")
    client.enable_encoding(xpraEncoding);
  client.keyboard_layout = Utilities.getKeyboardLayout();

  client.forceRelativeMouse = pointerLock;
  client.windowDecorations = false;
  client.debugLogPackets = debugLogPackets;
  client.ghostCursor = ghostCursor;
  // client.debug_categories.push("network", "geometry");

  client._clientGrabbedFirstClick = false;

  client.eaasFirstWindow = new Promise(
    (r) => (client._eaasFirstWindowResolve = r)
  );

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
