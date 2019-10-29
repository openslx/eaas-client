"use strict";

function XpraWindow(client, canvas_state, wid, x, y, w, h, metadata, override_redirect, tray, client_properties, geometry_cb, mouse_move_cb, mouse_down_cb, mouse_up_cb, mouse_scroll_cb, set_focus_cb, window_closed_cb, htmldiv) {
    function on_mousescroll(e) {
        me.on_mousescroll(e)
    }

    var me = this;
    this.client = client, this.log = function () {
        client.log.apply(client, arguments)
    }, this.warn = function () {
        client.warn.apply(client, arguments)
    }, this.error = function () {
        client.error.apply(client, arguments)
    }, this.exc = function () {
        client.exc.apply(client, arguments)
    }, this.debug = function () {
        client.debug.apply(client, arguments)
    }, this.debug_categories = client.debug_categories, this.canvas = canvas_state, this.canvas_ctx = this.canvas.getContext("2d"), this.canvas_ctx.imageSmoothingEnabled = !1, this.offscreen_canvas = null, this.offscreen_canvas_ctx = null, this.draw_canvas = null, this._init_2d_canvas(), this.paint_queue = [], this.paint_pending = 0, this.div = jQuery("#" + String(wid)), this.geometry_cb = null, this.mouse_move_cb = null, this.mouse_down_cb = null, this.mouse_up_cb = null, this.mouse_scroll_cb = null, this.window_closed_cb = null, this.wid = wid, this.metadata = {}, this.override_redirect = override_redirect, this.tray = tray, this.has_alpha = !1, this.client_properties = client_properties, this.title = null, this.windowtype = null, this.fullscreen = !1, this.saved_geometry = null, this.maximized = !1, this.focused = !1, this.decorations = !0, this.resizable = !1, this.stacking_layer = 0, this.x = x, this.y = y, this.w = w, this.h = h, this.leftoffset = parseInt(jQuery(this.div).css("border-left-width"), 10), this.rightoffset = parseInt(jQuery(this.div).css("border-right-width"), 10), this.topoffset = parseInt(jQuery(this.div).css("border-top-width"), 10), this.bottomoffset = parseInt(jQuery(this.div).css("border-bottom-width"), 10), this.set_focus_cb = set_focus_cb || null, this.mouse_move_cb = mouse_move_cb || null, this.mouse_down_cb = mouse_down_cb || null, this.mouse_up_cb = mouse_up_cb || null, this.mouse_scroll_cb = mouse_scroll_cb || null, jQuery(this.canvas).mousedown(function (e) {
        me.on_mousedown(e)
    }), jQuery(this.canvas).mouseup(function (e) {
        me.on_mouseup(e)
    }), jQuery(this.canvas).mousemove(function (e) {
        me.on_mousemove(e)
    }), this.geometry_cb = geometry_cb || null, this.window_closed_cb = window_closed_cb || null, this.update_metadata(metadata, !0), jQuery(this.div).addClass("window"), this.windowtype && jQuery(this.div).addClass("window-" + this.windowtype), this.client.server_is_desktop || this.client.server_is_shadow ? (jQuery(this.div).addClass("desktop"), this.resizable = !1) : this.tray ? jQuery(this.div).addClass("tray") : this.override_redirect ? jQuery(this.div).addClass("override-redirect") : "" != this.windowtype && "NORMAL" != this.windowtype && "DIALOG" != this.windowtype && "UTILITY" != this.windowtype || (this.resizable = !0, jQuery(this.div).addClass("border"), jQuery(this.div).prepend('<div id="head' + String(wid) + '" class="windowhead"> <span class="windowicon"><img id="windowicon' + String(wid) + '" /></span> <span class="windowtitle" id="title' + String(wid) + '">' + this.title + '</span> <span class="windowbuttons"> <span id="minimize' + String(wid) + '"><img src="icons/minimize.png" /></span> <span id="maximize' + String(wid) + '"><img src="icons/maximize.png" /></span> <span id="close' + String(wid) + '"><img src="icons/close.png" /></span> </span></div>'), jQuery(this.div).draggable({cancel: "canvas"}), jQuery(this.div).on("dragstart", function (ev, ui) {
        client.do_window_mouse_click(ev, me, !1), client.mouse_grabbed = !0, me.set_focus_cb(me)
    }), jQuery(this.div).on("dragstop", function (ev, ui) {
        client.mouse_grabbed = !1, me.handle_moved(ui)
    }), jQuery(this.div).resizable({
        helper: "ui-resizable-helper",
        handles: "n, e, s, w, ne, se, sw, nw"
    }), jQuery(this.div).on("resizestart", function (ev, ui) {
        client.do_window_mouse_click(ev, me, !1), client.mouse_grabbed = !0
    }), jQuery(this.div).on("resizestop", function (ev, ui) {
        me.handle_resized(ui), me.set_focus_cb(me), client.mouse_grabbed = !1, setTimeout(function () {
            me.client.request_refresh(me.wid)
        }, 200)
    }), this.d_header = "#head" + String(wid), this.d_closebtn = "#close" + String(wid), this.d_maximizebtn = "#maximize" + String(wid), this.d_minimizebtn = "#minimize" + String(wid), this.resizable ? (jQuery(this.d_header).dblclick(function () {
        me.toggle_maximized()
    }), jQuery(this.d_closebtn).click(function () {
        window_closed_cb(me)
    }), jQuery(this.d_maximizebtn).click(function () {
        me.toggle_maximized()
    }), jQuery(this.d_minimizebtn).click(function () {
        me.toggle_minimized()
    })) : (jQuery(this.d_closebtn).hide(), jQuery(this.d_maximizebtn).hide(), jQuery("#windowlistitemmax" + String(wid)).hide(), jQuery(this.d_minimizebtn).hide()), this.topoffset = this.topoffset + parseInt(jQuery(this.d_header).css("height"), 10), jQuery(this.div).mousedown(function (e) {
        e.stopPropagation()
    }), jQuery(this.d_header).click(function () {
        me.set_focus_cb(me)
    })), jQuery(this.div).prepend('<div id="spinner' + String(wid) + '" class="spinneroverlay"><div class="spinnermiddle"><div class="spinner"></div></div></div>'), this.spinnerdiv = jQuery("#spinner" + String(wid));
    var div = document.getElementById(wid);
    Utilities.isEventSupported("wheel") ? div.addEventListener("wheel", on_mousescroll, !1) : Utilities.isEventSupported("mousewheel") ? div.addEventListener("mousewheel", on_mousescroll, !1) : Utilities.isEventSupported("DOMMouseScroll") && div.addEventListener("DOMMouseScroll", on_mousescroll, !1), this.pointer_down = -1, this.pointer_last_x = 0, this.pointer_last_y = 0, window.PointerEvent && (this.canvas.addEventListener("pointerdown", function (ev) {
        me.debug("mouse", "pointerdown:", ev), "touch" == ev.pointerType && (me.pointer_down = ev.pointerId, me.pointer_last_x = ev.offsetX, me.pointer_last_y = ev.offsetY)
    }), this.canvas.addEventListener("pointermove", function (ev) {
        if (me.debug("mouse", "pointermove:", ev), me.pointer_down == ev.pointerId) {
            var dx = ev.offsetX - me.pointer_last_x, dy = ev.offsetY - me.pointer_last_y;
            me.pointer_last_x = ev.offsetX, me.pointer_last_y = ev.offsetY;
            var mult = 20 * (window.devicePixelRatio || 1);
            ev.wheelDeltaX = Math.round(dx * mult), ev.wheelDeltaY = Math.round(dy * mult), on_mousescroll(ev)
        }
    }), this.canvas.addEventListener("pointerup", function (ev) {
        me.debug("mouse", "pointerup:", ev), me.pointer_down = -1
    }), this.canvas.addEventListener("pointercancel", function (ev) {
        me.debug("mouse", "pointercancel:", ev), me.pointer_down = -1
    }), this.canvas.addEventListener("pointerout", function (ev) {
        me.debug("mouse", "pointerout:", ev)
    })), this.screen_resized(), this.updateCSSGeometry(), this.update_metadata(metadata)

    me._set_decorated(false);
    me.move(0,0);
    const float_menu = $("#float_menu");
    if (float_menu.length > 0) {
        float_menu.hide();
    }
}

XpraWindow.prototype._init_2d_canvas = function () {
    this.offscreen_canvas = document.createElement("canvas"), this.updateCanvasGeometry(), this.offscreen_canvas_ctx = this.offscreen_canvas.getContext("2d"), this.offscreen_canvas_ctx.imageSmoothingEnabled = !1
}, XpraWindow.prototype.swap_buffers = function () {
    this.debug("draw", "swap_buffers"), this.draw_canvas = this.offscreen_canvas, this._init_2d_canvas(), this.offscreen_canvas_ctx.drawImage(this.draw_canvas, 0, 0)
}, XpraWindow.prototype.set_spinner = function (state) {
    state ? this.spinnerdiv.hide() : this.spinnerdiv.css("display", "table")
}, XpraWindow.prototype.ensure_visible = function () {
    if (!this.client.server_is_desktop && !this.client.server_is_shadow) {
        var oldx = this.x, oldy = this.y, desktop_size = this.client._get_desktop_size(), ww = desktop_size[0],
            wh = desktop_size[1];
        return oldx + this.w <= 10 ? this.x = 10 - this.w + this.leftoffset : oldx >= ww - 10 && (this.x = Math.min(oldx, ww - 10)), oldy <= 10 ? this.y = 0 + this.topoffset : oldy >= wh - 10 && (this.y = Math.min(oldy, wh - 10)), this.debug("geometry", "ensure_visible() oldx=", oldx, "oldy=", oldy, "x=", this.x, "y=", this.y), oldx == this.x && oldy == this.y || (this.updateCSSGeometry(), !1)
    }
}, XpraWindow.prototype.updateCanvasGeometry = function () {
    this.canvas.width != this.w && (this.canvas.width = this.w), this.canvas.height != this.h && (this.canvas.height = this.h), this.offscreen_canvas.width != this.w && (this.offscreen_canvas.width = this.w), this.offscreen_canvas.height != this.h && (this.offscreen_canvas.height = this.h)
}, XpraWindow.prototype.updateCSSGeometry = function () {
    if (this.updateCanvasGeometry(), this.client.server_is_desktop || this.client.server_is_shadow) return void jQuery(this.div).position({of: jQuery("#screen")});
    this.outerH = this.h + this.topoffset + this.bottomoffset, this.outerW = this.w + this.leftoffset + this.rightoffset, jQuery(this.div).css("width", this.outerW), jQuery(this.div).css("height", this.outerH), this.outerX = this.x - this.leftoffset, this.outerY = this.y - this.topoffset, jQuery(this.div).css("left", this.outerX), jQuery(this.div).css("top", this.outerY), this.debug("geometry", "updateCSSGeometry() left=", this.outerX, ", top=", this.outerY, ", width=", this.outerW, ", height=", this.outerH)
}, XpraWindow.prototype.updateFocus = function () {
    this.focused ? jQuery(this.div).addClass("windowinfocus") : jQuery(this.div).removeClass("windowinfocus")
}, XpraWindow.prototype.on_mousemove = function (e) {
    return this.mouse_move_cb(this.client, e, this), e.preventDefault(), !1
}, XpraWindow.prototype.on_mousedown = function (e) {
    return this.mouse_down_cb(this.client, e, this), e.preventDefault(), !1
}, XpraWindow.prototype.on_mouseup = function (e) {
    return this.mouse_up_cb(this.client, e, this), e.preventDefault(), !1
}, XpraWindow.prototype.on_mousescroll = function (e) {
    return this.mouse_scroll_cb(this.client, e, this), !1
}, XpraWindow.prototype.toString = function () {
    return "Window(" + this.wid + ")"
}, XpraWindow.prototype.update_zindex = function () {
    var z = 5e3 + this.stacking_layer;
    (this.tray ? z = 0 : this.override_redirect || this.client.server_is_desktop || this.client.server_is_shadow ? z = 15e3 : "DROPDOWN" == this.windowtype || "TOOLTIP" == this.windowtype || "POPUP_MENU" == this.windowtype || "MENU" == this.windowtype || "COMBO" == this.windowtype ? z = 2e4 : "UTILITY" != this.windowtype && "DIALOG" != this.windowtype || (z = 15e3), this.metadata.above) ? z += 5e3 : this.metadata.below && (z -= 5e3);
    this.focused && (z += 2500), jQuery(this.div).css("z-index", z)
}, XpraWindow.prototype.update_metadata = function (metadata, safe) {
    this.debug("main", "update_metadata(", metadata, ")");
    for (var attrname in metadata) this.metadata[attrname] = metadata[attrname];
    safe ? this.set_metadata_safe(metadata) : this.set_metadata(metadata), this.update_zindex()
}, XpraWindow.prototype.set_metadata_safe = function (metadata) {
    if ("title" in metadata) {
        this.title = metadata.title;
        var decodedTitle = decodeURIComponent(escape(this.title));
        jQuery("#title" + this.wid).html(decodedTitle);
        var trimmedTitle = Utilities.trimString(decodedTitle, 30);
        jQuery("#windowlistitemtitle" + this.wid).text(trimmedTitle)
    }
    if ("has-alpha" in metadata && (this.has_alpha = metadata["has-alpha"]), "window-type" in metadata && (this.windowtype = metadata["window-type"][0]), "decorations" in metadata && (this.decorations = metadata.decorations, this._set_decorated(this.decorations), this.updateCSSGeometry(), this.handle_resized(), this.apply_size_constraints()), "opacity" in metadata) {
        var opacity = metadata.opacity;
        opacity < 0 ? opacity = 1 : opacity /= 4294967296, jQuery(this.div).css("opacity", "" + opacity)
    }
    for (var attrs = ["modal", "above", "below"], i = 0; i < attrs.length; i++) {
        var attr = attrs[i];
        if (attr in metadata) {
            metadata[attr] ? jQuery(this.div).addClass(attr) : jQuery(this.div).removeClass(attr)
        }
    }
    if (this.resizable && "size-constraints" in metadata && this.apply_size_constraints(), "class-instance" in metadata) {
        var wm_class = metadata["class-instance"], classes = jQuery(this.div).prop("classList");
        if (classes) for (var i = 0; i < classes.length; i++) {
            var tclass = "" + classes[i];
            0 === tclass.indexOf("wmclass-") && wm_class && !wm_class.includes(tclass) && jQuery(this.div).removeClass(tclass)
        }
        if (wm_class) for (var i = 0; i < wm_class.length; i++) {
            var tclass = wm_class[i].replace(/[^0-9a-zA-Z]/g, "");
            tclass && !jQuery(this.div).hasClass(tclass) && jQuery(this.div).addClass("wmclass-" + tclass)
        }
    }
}, XpraWindow.prototype.apply_size_constraints = function () {
    if (this.resizable) {
        this.maximized ? jQuery(this.div).draggable("disable") : jQuery(this.div).draggable("enable");
        var hdec = 0;
        this.decorations && (hdec = jQuery("#head" + this.wid).outerHeight(!0));
        var min_size = null, max_size = null, size_constraints = this.metadata["size-constraints"];
        size_constraints && (min_size = size_constraints["minimum-size"], max_size = size_constraints["maximum-size"]);
        var minw = null, minh = null;
        min_size && (minw = min_size[0] + 0, minh = min_size[1] + hdec);
        var maxw = null, maxh = null;
        max_size && (maxw = max_size[0] + 0, maxh = max_size[1] + hdec), minw > 0 && minw == maxw && minh > 0 && minh == maxh ? (jQuery(this.d_maximizebtn).hide(), jQuery("#windowlistitemmax" + String(this.wid)).hide(), jQuery(this.div).resizable("disable")) : (jQuery(this.d_maximizebtn).show(), this.maximized ? jQuery(this.div).resizable("disable") : jQuery(this.div).resizable("enable")), this.maximized || (jQuery(this.div).resizable("option", "minWidth", minw), jQuery(this.div).resizable("option", "minHeight", minh), jQuery(this.div).resizable("option", "maxWidth", maxw), jQuery(this.div).resizable("option", "maxHeight", maxh))
    }
}, XpraWindow.prototype.set_metadata = function (metadata) {
    this.set_metadata_safe(metadata), "fullscreen" in metadata && this.set_fullscreen(1 == metadata.fullscreen), "maximized" in metadata && this.set_maximized(1 == metadata.maximized)
}, XpraWindow.prototype.save_geometry = function () {
    this.saved_geometry = {
        x: this.x,
        y: this.y,
        w: this.w,
        h: this.h
    }, this.debug("geometry", "save_geometry() saved-geometry=", this.saved_geometry)
}, XpraWindow.prototype.restore_geometry = function () {
    null != this.saved_geometry && (this.x = this.saved_geometry.x, this.y = this.saved_geometry.y, this.w = this.saved_geometry.w, this.h = this.saved_geometry.h, this.debug("geometry", "restore_geometry() saved-geometry=", this.saved_geometry), this.saved_geometry = null, this.handle_resized(), this.set_focus_cb(this))
}, XpraWindow.prototype.set_maximized = function (maximized) {
    jQuery(this.div).is(":hidden") && jQuery(this.div).show(), this.maximized != maximized && (this.max_save_restore(maximized), this.maximized = maximized, this.handle_resized(), this.set_focus_cb(this), this.apply_size_constraints())
}, XpraWindow.prototype.toggle_maximized = function () {
    this.set_maximized(!this.maximized)
}, XpraWindow.prototype.set_minimized = function (minimized) {
    jQuery(this.div).toggle(200)
}, XpraWindow.prototype.toggle_minimized = function () {
    this.set_minimized(!this.minimized)
}, XpraWindow.prototype.set_fullscreen = function (fullscreen) {
    this.fullscreen != fullscreen && (this.resizable && (fullscreen ? this._set_decorated(!1) : this._set_decorated(this.decorations)), this.max_save_restore(fullscreen), this.fullscreen = fullscreen, this.updateCSSGeometry(), this.handle_resized(), this.set_focus_cb(this))
}, XpraWindow.prototype._set_decorated = function (decorated) {
    this.topoffset = parseInt(jQuery(this.div).css("border-top-width"), 10), decorated ? (jQuery("#head" + this.wid).show(), jQuery(this.div).removeClass("undecorated"), jQuery(this.div).addClass("window"), this.d_header && (this.topoffset = this.topoffset + parseInt(jQuery(this.d_header).css("height"), 10), this.debug("geometry", "_set_decorated(", decorated, ") new topoffset=", self.topoffset))) : (jQuery("#head" + this.wid).hide(), jQuery(this.div).removeClass("window"), jQuery(this.div).addClass("undecorated"))
}, XpraWindow.prototype.max_save_restore = function (use_all_space) {
    use_all_space ? (this.save_geometry(), this.fill_screen()) : this.restore_geometry()
}, XpraWindow.prototype.fill_screen = function () {
    var screen_size = this.client._get_desktop_size();
    this.x = 0 + this.leftoffset, this.y = 0 + this.topoffset, this.w = screen_size[0] - this.leftoffset - this.rightoffset, this.h = screen_size[1] - this.topoffset - this.bottomoffset, this.debug("geometry", "fill_screen() ", this.x, this.y, this.w, this.h)
}, XpraWindow.prototype.handle_resized = function (e) {
    this.debug("geometry", "handle_resized(", e, ")"), e && (this.x = this.x + Math.round(e.position.left - e.originalPosition.left), this.y = this.y + Math.round(e.position.top - e.originalPosition.top), this.w = Math.round(e.size.width) - this.leftoffset - this.rightoffset, this.h = Math.round(e.size.height) - this.topoffset - this.bottomoffset), this.updateCSSGeometry(), this.geometry_cb(this)
}, XpraWindow.prototype.handle_moved = function (e) {
    var left = Math.round(e.position.left), top = Math.round(e.position.top);
    this.debug("geometry", "handle_moved(", e, ") left=", left, ", top=", top), this.x = left + this.leftoffset, this.y = top + this.topoffset, this.ensure_visible(), this.geometry_cb(this)
}, XpraWindow.prototype.screen_resized = function () {
    if (this.debug("geometry", "screen_resized() server_is_desktop=", this.client.server_is_desktop, ", server_is_shadow=", this.client.server_is_shadow), this.client.server_is_desktop && this.match_screen_size(), this.client.server_is_shadow) {
        var ids = Object.keys(this.client.id_to_window);
        0 != ids.length && ids[0] != this.wid || this.recenter()
    }
    (this.fullscreen || this.maximized) && (this.fill_screen(), this.handle_resized()), this.ensure_visible()
}, XpraWindow.prototype.recenter = function (force_update_geometry) {
    var x = this.x, y = this.y;
    this.debug("geometry", "recenter() x=", x, ", y=", y, ", desktop size: ", this.client.desktop_width, this.client.desktop_height), x = Math.round((this.client.desktop_width - this.w) / 2), y = Math.round((this.client.desktop_height - this.h) / 2), this.x != x || this.y != y || force_update_geometry ? (this.debug("geometry", "window re-centered to:", x, y), this.x = x, this.y = y, this.updateCSSGeometry(), this.geometry_cb(this)) : this.debug("geometry", "recenter() unchanged at ", x, y), (this.x < 0 || this.y < 0) && this.warn("window does not fit in canvas, offsets: ", x, y)
}, XpraWindow.prototype.match_screen_size = function () {
    var maxw = this.client.desktop_width, maxh = this.client.desktop_height, neww = 0, newh = 0;
    if (this.client.server_resize_exact) neww = maxw, newh = maxh, this.log("resizing to exact size:", neww, newh); else {
        if (0 == this.client.server_screen_sizes.length) return void this.recenter();
        for (var screen_size, best = 0, w = 0, h = 0, screen_sizes = this.client.server_screen_sizes, i = 0; i < screen_sizes.length; i++) screen_size = screen_sizes[i], w = screen_size[0], h = screen_size[1], w <= maxw && h <= maxh && w * h > best && (best = w * h, neww = w, newh = h);
        if (0 == neww && 0 == newh) {
            best = 0;
            for (var i = 0; i < screen_sizes.length; i++) screen_size = screen_sizes[i], w = screen_size[0], h = screen_size[1], (0 == best || w * h < best) && (best = w * h, neww = w, newh = h)
        }
        this.log("best screen size:", neww, newh)
    }
    this.w = neww, this.h = newh, this.recenter(!0)
}, XpraWindow.prototype.move_resize = function (x, y, w, h) {
    this.debug("geometry", "move_resize(", x, y, w, h, ")"), this.w == w && this.h == h && this.x == x && this.y == y || (this.w = w, this.h = h, this.x = x, this.y = y, this.ensure_visible() || this.geometry_cb(this), this.updateCSSGeometry())
}, XpraWindow.prototype.move = function (x, y) {
    this.debug("geometry", "move(", x, y, ")"), this.move_resize(x, y, this.w, this.h)
}, XpraWindow.prototype.resize = function (w, h) {
    this.debug("geometry", "resize(", w, h, ")"), this.move_resize(this.x, this.y, w, h)
}, XpraWindow.prototype.initiate_moveresize = function (mousedown_event, x_root, y_root, direction, button, source_indication) {
    var dir_str = MOVERESIZE_DIRECTION_STRING[direction];
    if (this.log("initiate_moveresize", dir_str, [x_root, y_root, direction, button, source_indication]), direction == MOVERESIZE_MOVE && mousedown_event) {
        var e = mousedown_event;
        e.type = "mousedown.draggable", e.target = this.div[0], this.div.trigger(e)
    } else if (direction == MOVERESIZE_CANCEL) jQuery(this.div).draggable("disable"), jQuery(this.div).draggable("enable"); else if (direction in MOVERESIZE_DIRECTION_JS_NAME) {
        var js_dir = MOVERESIZE_DIRECTION_JS_NAME[direction],
            resize_widget = jQuery(this.div).find(".ui-resizable-handle.ui-resizable-" + js_dir).first();
        if (resize_widget) {
            var pageX = resize_widget.offset().left, pageY = resize_widget.offset().top;
            resize_widget.trigger("mouseover"), resize_widget.trigger({
                type: "mousedown",
                which: 1,
                pageX: pageX,
                pageY: pageY
            })
        }
    }
}, XpraWindow.prototype.get_internal_geometry = function () {
    return {x: this.x, y: this.y, w: this.w, h: this.h}
}, XpraWindow.prototype.handle_mouse_click = function (button, pressed, mx, my, modifiers, buttons) {
    this.debug("mouse", "got mouse click at ", mx, my), this.mouse_click_cb(this, button, pressed, mx, my, modifiers, buttons)
}, XpraWindow.prototype.update_icon = function (width, height, encoding, img_data) {
    var src = "/favicon.png";
    if ("png" == encoding) {
        if ($("#title" + String(this.wid)).css("left", 32), "string" == typeof img_data) {
            for (var uint = new Uint8Array(img_data.length), i = 0; i < img_data.length; ++i) uint[i] = img_data.charCodeAt(i);
            img_data = uint
        }
        src = "data:image/" + encoding + ";base64," + Utilities.ArrayBufferToBase64(img_data)
    }
    return jQuery("#windowicon" + String(this.wid)).attr("src", src), jQuery("#windowlistitemicon" + String(this.wid)).attr("src", src), src
}, XpraWindow.prototype.reset_cursor = function () {
    jQuery("#" + String(this.wid)).css("cursor", "default")
}, XpraWindow.prototype.set_cursor = function (encoding, w, h, xhot, yhot, img_data) {
    if ("png" == encoding) {
        var cursor_url = "url('data:image/" + encoding + ";base64," + window.btoa(img_data) + "')";
        jQuery("#" + String(this.wid)).css("cursor", cursor_url + ", default"), jQuery("#" + String(this.wid)).css("cursor", cursor_url + " " + xhot + " " + yhot + ", auto")
    }
}, XpraWindow.prototype.eos = function () {
    this._close_jsmpeg(), this._close_broadway(), this._close_video()
}, XpraWindow.prototype.draw = function () {
    (this.has_alpha || this.tray) && this.canvas_ctx.clearRect(0, 0, this.draw_canvas.width, this.draw_canvas.height), this.canvas_ctx.drawImage(this.draw_canvas, 0, 0)
}, XpraWindow.prototype._init_broadway = function (enc_width, enc_height, width, height) {
    var me = this;
    this.broadway_decoder = new Decoder({
        rgb: !0,
        size: {width: enc_width, height: enc_height}
    }), this.log("broadway decoder initialized"), this.broadway_paint_location = [0, 0], this.broadway_decoder.onPictureDecoded = function (buffer, p_width, p_height, infos) {
        me._broadway_paint(buffer, enc_width, enc_height, width, height, p_width, p_height, infos)
    }
}, XpraWindow.prototype._broadway_paint = function (buffer, enc_width, enc_height, width, height, p_width, p_height, infos) {
    if (this.debug("draw", "broadway picture decoded: ", buffer.length, "bytes, size ", p_width, "x", p_height + ", paint location: ", this.broadway_paint_location, "with infos=", infos), this.broadway_decoder) {
        var img = this.offscreen_canvas_ctx.createImageData(p_width, p_height);
        img.data.set(buffer);
        var x = this.broadway_paint_location[0], y = this.broadway_paint_location[1];
        this.offscreen_canvas_ctx.putImageData(img, x, y, 0, 0, enc_width, enc_height), enc_width == width && enc_height == height || this.offscreen_canvas_ctx.drawImage(this.offscreen_canvas, x, y, enc_width, enc_height, x, y, width, height)
    }
}, XpraWindow.prototype._close_broadway = function () {
    this.broadway_decoder = null
}, XpraWindow.prototype._close_video = function () {
    if (this.debug("draw", "close_video: video_source_buffer=", this.video_source_buffer, ", media_source=", this.media_source, ", video=", this.video), this.video_source_ready = !1, this.video) {
        if (this.media_source) {
            try {
                this.video_source_buffer && this.media_source.removeSourceBuffer(this.video_source_buffer), this.media_source.endOfStream()
            } catch (e) {
                this.exc(e, "video media source EOS error")
            }
            this.video_source_buffer = null, this.media_source = null
        }
        this.video.remove(), this.video = null
    }
}, XpraWindow.prototype._push_video_buffers = function () {
    this.debug("draw", "_push_video_buffers()");
    var vsb = this.video_source_buffer, vb = this.video_buffers;
    if (vb && vsb && this.video_source_ready && (0 != vb.length || 0 != this.video_buffers_count)) {
        for (; vb.length > 0 && !vsb.updating;) {
            var buffers = vb.splice(0, 20), buffer = [].concat.apply([], buffers);
            vsb.appendBuffer(new Uint8Array(buffer).buffer), this.video_buffers_count += buffers.length
        }
        vb.length > 0 && setTimeout(this._push_video_buffers, 25)
    }
}, XpraWindow.prototype._init_video = function (width, height, coding, profile, level) {
    var me = this;
    this.media_source = MediaSourceUtil.getMediaSource(), this.video = document.createElement("video"), this.video.setAttribute("autoplay", !0), this.video.setAttribute("muted", !0), this.video.setAttribute("width", width), this.video.setAttribute("height", height), this.video.style.pointerEvents = "all", this.video.style.position = "absolute", this.video.style.zIndex = this.div.css("z-index") + 1, this.video.style.left = this.leftoffset + "px", this.video.style.top = this.topoffset + "px", this.debug_categories.includes("audio") && (MediaSourceUtil.addMediaElementEventDebugListeners(this.video, "video"), this.video.setAttribute("controls", "controls")), this.video.addEventListener("error", function () {
        me.error("video error")
    }), this.video.src = window.URL.createObjectURL(this.media_source), this.video_buffers = [], this.video_buffers_count = 0, this.video_source_ready = !1;
    var codec_string = "";
    if ("h264+mp4" == coding || "mpeg4+mp4" == coding) codec_string = 'video/mp4; codecs="avc1.' + MediaSourceConstants.H264_PROFILE_CODE[profile] + MediaSourceConstants.H264_LEVEL_CODE[level] + '"'; else if ("vp8+webm" == coding) codec_string = 'video/webm;codecs="vp8"'; else {
        if ("vp9+webm" != coding) throw new Error("invalid encoding: " + coding);
        codec_string = 'video/webm;codecs="vp9"'
    }
    this.log("video codec string: " + codec_string + " for " + coding + " profile '" + profile + "', level '" + level + "'"), this.media_source.addEventListener("sourceopen", function () {
        me.log("video media source open");
        var vsb = me.media_source.addSourceBuffer(codec_string);
        vsb.mode = "sequence", me.video_source_buffer = vsb, me.debug_categories.includes("draw") && MediaSourceUtil.addSourceBufferEventDebugListeners(vsb, "video"), vsb.addEventListener("error", function (e) {
            me.error("video source buffer error")
        }), vsb.addEventListener("waiting", function () {
            me._push_video_buffers()
        }), me._push_video_buffers(), me.video_source_ready = !0
    }), this.canvas.parentElement.appendChild(this.video)
}, XpraWindow.prototype._non_video_paint = function (coding) {
    if (this.video && "-1" != this.video.style.zIndex) {
        this.debug("draw", "bringing canvas above video for ", coding, " paint event"), this.video.style.zIndex = "-1";
        var width = this.video.getAttribute("width"), height = this.video.getAttribute("height");
        this.offscreen_canvas_ctx.drawImage(this.video, 0, 0, width, height)
    }
}, XpraWindow.prototype.paint = function () {
    var item = Array.prototype.slice.call(arguments);
    this.paint_queue.push(item), this.may_paint_now()
}, XpraWindow.prototype.may_paint_now = function () {
    this.debug("draw", "may_paint_now() paint pending=", this.paint_pending, ", paint queue length=", this.paint_queue.length);
    for (var now = Utilities.monotonicTime(); (0 == this.paint_pending || now - this.paint_pending >= 2e3) && this.paint_queue.length > 0;) {
        this.paint_pending = now;
        var item = this.paint_queue.shift();
        this.do_paint.apply(this, item), now = Utilities.monotonicTime()
    }
};
var DEFAULT_BOX_COLORS = {
    png: "yellow",
    h264: "blue",
    vp8: "green",
    rgb24: "orange",
    rgb32: "red",
    jpeg: "purple",
    webp: "pink",
    "png/P": "indigo",
    "png/L": "teal",
    h265: "khaki",
    vp9: "lavender",
    mpeg4: "black",
    scroll: "brown",
    mpeg1: "olive"
};
XpraWindow.prototype.get_jsmpeg_renderer = function () {
    if (null == this.jsmpeg_renderer) {
        var options = new Object;
        this.jsmpeg_renderer = new JSMpeg.Renderer.Canvas2D(options)
    }
    return this.jsmpeg_renderer
}, XpraWindow.prototype._close_jsmpeg = function () {
    null != this.jsmpeg_renderer && this.jsmpeg_renderer.destroy(), this.jsmpeg_decoder = null
}, XpraWindow.prototype.do_paint = function (x, y, width, height, coding, img_data, packet_sequence, rowstride, options, decode_callback) {
    function paint_box(color, px, py, pw, ph) {
        me.offscreen_canvas_ctx.strokeStyle = color, me.offscreen_canvas_ctx.lineWidth = "2", me.offscreen_canvas_ctx.strokeRect(px, py, pw, ph)
    }

    function painted(skip_box) {
        if (img_data = null, me.paint_pending = 0, me.paint_debug && !skip_box) {
            paint_box(DEFAULT_BOX_COLORS[coding] || "white", x, y, width, height)
        }
        decode_callback()
    }

    function paint_error(e) {
        img_data = null, me.error("error painting", coding, e), me.paint_pending = 0, decode_callback("" + e)
    }

    this.debug("draw", "do_paint(", img_data.length, " bytes of ", "zlib" in options ? "zlib " : "", coding, " data ", width, "x", height, " at ", x, ",", y, ") focused=", this.focused);
    var me = this, enc_width = width, enc_height = height, scaled_size = options.scaled_size;
    scaled_size && (enc_width = scaled_size[0], enc_height = scaled_size[1]);
    try {
        if ("rgb32" == coding) {
            this._non_video_paint(coding);
            var img = this.offscreen_canvas_ctx.createImageData(width, height);
            if (null != options && options.zlib > 0) {
                var inflated = new Zlib.Inflate(img_data).decompress();
                img_data = inflated
            } else if (null != options && options.lz4 > 0) {
                if (img_data.subarray) var d = img_data.subarray(0, 4); else var d = img_data.slice(0, 4);
                var length = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24, inflated = new Buffer(length);
                if (img_data.subarray) var uncompressedSize = LZ4.decodeBlock(img_data.subarray(4), inflated); else var uncompressedSize = LZ4.decodeBlock(img_data.slice(4), inflated);
                img_data = inflated.slice(0, uncompressedSize)
            }
            img_data.length > img.data.length ? paint_error("data size mismatch: wanted " + img.data.length + ", got " + img_data.length + ", stride=" + rowstride) : (this.debug("draw", "got ", img_data.length, "to paint with stride", rowstride), img.data.set(img_data), this.offscreen_canvas_ctx.putImageData(img, x, y), painted()), this.may_paint_now()
        } else if ("jpeg" == coding || "png" == coding || "webp" == coding) {
            this._non_video_paint(coding);
            var j = new Image;
            j.onload = function () {
                0 == j.width || 0 == j.height ? paint_error("invalid image size: " + j.width + "x" + j.height) : (me.offscreen_canvas_ctx.drawImage(j, x, y), painted()), me.may_paint_now()
            }, j.onerror = function () {
                paint_error("failed to load into image tag:"), me.may_paint_now()
            }, j.src = "data:image/" + coding + ";base64," + Utilities.ArrayBufferToBase64(img_data)
        } else if ("mpeg1" == coding) {
            var frame = options.frame || 0;
            if (0 == frame || null == this.jsmpeg_decoder) {
                var options = new Object;
                options.streaming = !0, options.decodeFirstFrame = !1, this.jsmpeg_decoder = new JSMpeg.Decoder.MPEG1Video(options);
                var renderer = new Object;
                renderer.render = function (Y, Cr, Cb) {
                    var jsmpeg_renderer = me.get_jsmpeg_renderer();
                    jsmpeg_renderer.render(Y, Cr, Cb);
                    var canvas = jsmpeg_renderer.canvas;
                    me.offscreen_canvas_ctx.drawImage(canvas, x, y, width, height), paint_box("olive", x, y, width, height)
                }, renderer.resize = function (newWidth, newHeight) {
                    me.get_jsmpeg_renderer().resize(newWidth, newHeight)
                }, this.jsmpeg_decoder.connect(renderer)
            }
            var pts = frame;
            this.jsmpeg_decoder.write(pts, img_data);
            var decoded = this.jsmpeg_decoder.decode();
            this.debug("draw", coding, "frame", frame, "data len=", img_data.length, "decoded=", decoded), painted()
        } else if ("h264" == coding) {
            var frame = options.frame || 0;
            0 == frame && this._close_broadway(), this.broadway_decoder || this._init_broadway(enc_width, enc_height, width, height), this.broadway_paint_location = [x, y], Array.isArray(img_data) || (img_data = Array.from(img_data)), this.broadway_decoder.decode(img_data), painted()
        } else if ("h264+mp4" == coding || "vp8+webm" == coding || "mpeg4+mp4" == coding) {
            var frame = options.frame || -1;
            if (0 == frame && this._close_video(), this.video) this.video.style.zIndex = this.div.css("z-index") + 1; else {
                var profile = options.profile || "baseline", level = options.level || "3.0";
                this._init_video(width, height, coding, profile, level)
            }
            if (img_data.length > 0) {
                this.debug("draw", "video state=", MediaSourceConstants.READY_STATE[this.video.readyState], ", network state=", MediaSourceConstants.NETWORK_STATE[this.video.networkState]), this.debug("draw", "video paused=", this.video.paused, ", video buffers=", this.video_buffers.length), this.video_buffers.push(img_data), this.video.paused && this.video.play(), this._push_video_buffers();
                var delay = Math.max(10, 50 * (this.video_buffers.length - 25));
                setTimeout(function () {
                    painted(), me.may_paint_now()
                }, delay)
            }
        } else if ("scroll" == coding) {
            this._non_video_paint(coding);
            for (var i = 0, j = img_data.length; i < j; ++i) {
                var scroll_data = img_data[i];
                this.debug("draw", "scroll", i, ":", scroll_data);
                var sx = scroll_data[0], sy = scroll_data[1], sw = scroll_data[2], sh = scroll_data[3],
                    xdelta = scroll_data[4], ydelta = scroll_data[5];
                this.offscreen_canvas_ctx.drawImage(this.draw_canvas, sx, sy, sw, sh, sx + xdelta, sy + ydelta, sw, sh), this.debug_categories.includes("draw") && paint_box("brown", sx + xdelta, sy + ydelta, sw, sh)
            }
            painted(!0), this.may_paint_now()
        } else paint_error("unsupported encoding")
    } catch (e) {
        this.exc(e, "error painting", coding, "sequence no", packet_sequence), paint_error(e)
    }
}, XpraWindow.prototype.destroy = function () {
    this._close_jsmpeg(), this._close_broadway(), this._close_video(), this.div.remove()
};
