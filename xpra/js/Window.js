"use strict";

function XpraWindow(client, canvas_state, wid, x, y, w, h, metadata, override_redirect, tray, client_properties, geometry_cb, mouse_move_cb, mouse_down_cb, mouse_up_cb, mouse_scroll_cb, set_focus_cb, window_closed_cb, htmldiv) {
    var me = this;
    this.client = client;
    this.log = function () {
        client.log.apply(client, arguments)
    };
    this.warn = function () {
        client.warn.apply(client, arguments)
    };
    this.error = function () {
        client.error.apply(client, arguments)
    };
    this.debug = function () {
        client.debug.apply(client, arguments)
    };
    this.debug_categories = client.debug_categories;
    this.canvas = canvas_state;
    this.canvas_ctx = this.canvas.getContext("2d");
    this.canvas_ctx.imageSmoothingEnabled = false;
    this.offscreen_canvas = null;
    this.offscreen_canvas_ctx = null;
    this.draw_canvas = null;
    this._init_2d_canvas();
    this.paint_queue = [];
    this.paint_pending = 0;
    this.div = jQuery("#" + String(wid));
    this.geometry_cb = null;
    this.mouse_move_cb = null;
    this.mouse_down_cb = null;
    this.mouse_up_cb = null;
    this.mouse_scroll_cb = null;
    this.window_closed_cb = null;
    this.wid = wid;
    this.metadata = {};
    this.override_redirect = override_redirect;
    this.tray = tray;
    this.has_alpha = false;
    this.client_properties = client_properties;
    this.title = null;
    this.windowtype = null;
    this.fullscreen = false;
    this.saved_geometry = null;
    this.maximized = false;
    this.focused = false;
    this.decorations = true;
    this.resizable = false;
    this.stacking_layer = 0;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.leftoffset = parseInt(jQuery(this.div).css("border-left-width"), 10);
    this.rightoffset = parseInt(jQuery(this.div).css("border-right-width"), 10);
    this.topoffset = parseInt(jQuery(this.div).css("border-top-width"), 10);
    this.bottomoffset = parseInt(jQuery(this.div).css("border-bottom-width"), 10);
    this.set_focus_cb = set_focus_cb || null;
    this.mouse_move_cb = mouse_move_cb || null;
    this.mouse_down_cb = mouse_down_cb || null;
    this.mouse_up_cb = mouse_up_cb || null;
    this.mouse_scroll_cb = mouse_scroll_cb || null;
    jQuery(this.canvas).mousedown(function (e) {
        me.on_mousedown(e)
    });
    jQuery(this.canvas).mouseup(function (e) {
        me.on_mouseup(e)
    });
    jQuery(this.canvas).mousemove(function (e) {
        me.on_mousemove(e)
    });
    this.geometry_cb = geometry_cb || null;
    this.window_closed_cb = window_closed_cb || null;
    this.update_metadata(metadata, true);
    jQuery(this.div).addClass("window");
    if (this.windowtype) {
        jQuery(this.div).addClass("window-" + this.windowtype)
    }
    if (this.client.server_is_desktop) {
        jQuery(this.div).addClass("desktop");
        this.resizable = false
    } else if (this.tray) {
        jQuery(this.div).addClass("tray")
    } else if (this.override_redirect) {
        jQuery(this.div).addClass("override-redirect")
    } else if (this.windowtype == "" || this.windowtype == "NORMAL" || this.windowtype == "DIALOG" || this.windowtype == "UTILITY") {
        this.resizable = true;
        jQuery(this.div).prepend('<div id="head' + String(wid) + '" class="windowhead"> ' + '<span class="windowicon"><img id="windowicon' + String(wid) + '" /></span> ' + '<span class="windowtitle" id="title' + String(wid) + '">' + this.title + "</span> " + '<span class="windowbuttons"> ' + '<span id="maximize' + String(wid) + '"><img src="icons/maximize.png" /></span> ' + '<span id="close' + String(wid) + '"><img src="icons/close.png" /></span> ' + "</span></div>");
        jQuery(this.div).draggable({cancel: "canvas"});
        jQuery(this.div).on("dragstart", function (ev, ui) {
            set_focus_cb(me)
        });
        jQuery(this.div).on("dragstop", function (ev, ui) {
            me.handle_moved(ui)
        });
        jQuery(this.div).resizable({helper: "ui-resizable-helper", handles: "n, e, s, w, ne, se, sw, nw"});
        jQuery(this.div).on("resizestop", function (ev, ui) {
            me.handle_resized(ui);
            set_focus_cb(me)
        });
        this.d_header = "#head" + String(wid);
        this.d_closebtn = "#close" + String(wid);
        this.d_maximizebtn = "#maximize" + String(wid);
        if (this.resizable) {
            jQuery(this.d_closebtn).click(function () {
                window_closed_cb(me)
            });
            jQuery(this.d_maximizebtn).click(function () {
                me.toggle_maximized()
            })
        } else {
            jQuery(this.d_closebtn).hide();
            jQuery(this.d_maximizebtn).hide()
        }
        this.topoffset = this.topoffset + parseInt(jQuery(this.d_header).css("height"), 10);
        jQuery(this.d_header).click(function () {
            set_focus_cb(me)
        })
    }
    jQuery(this.div).prepend('<div id="spinner' + String(wid) + '" class="spinneroverlay"><div class="spinnermiddle"><div class="spinner"></div></div></div>');
    this.spinnerdiv = jQuery("#spinner" + String(wid));
    var div = document.getElementById(wid);

    function on_mousescroll(e) {
        me.on_mousescroll(e)
    }

    // if (Utilities.isEventSupported("wheel")) {
    //     div.addEventListener("wheel", on_mousescroll, false)
    // } else if (Utilities.isEventSupported("mousewheel")) {
    //     div.addEventListener("mousewheel", on_mousescroll, false)
    // } else if (Utilities.isEventSupported("DOMMouseScroll")) {
    //     div.addEventListener("DOMMouseScroll", on_mousescroll, false)
    // }
    this.ensure_visible();
    this.updateCSSGeometry();
    this.update_metadata(metadata)
}

XpraWindow.prototype._init_2d_canvas = function () {
    this.offscreen_canvas = document.createElement("canvas");
    this.updateCanvasGeometry();
    this.offscreen_canvas_ctx = this.offscreen_canvas.getContext("2d");
    this.offscreen_canvas_ctx.imageSmoothingEnabled = false
};
XpraWindow.prototype.swap_buffers = function () {
    this.draw_canvas = this.offscreen_canvas;
    this._init_2d_canvas();
    this.offscreen_canvas_ctx.drawImage(this.draw_canvas, 0, 0)
};
XpraWindow.prototype.set_spinner = function (state) {
    if (state) {
        this.spinnerdiv.hide()
    } else {
        this.spinnerdiv.css("display", "table")
    }
};
XpraWindow.prototype.ensure_visible = function () {
    var oldx = this.x;
    var oldy = this.y;
    var min_visible = 10;
    var desktop_size = this.client._get_desktop_size();
    var ww = desktop_size[0];
    var wh = desktop_size[1];
    if (oldx + this.w <= min_visible) {
        this.x = min_visible - this.w + this.leftoffset
    } else if (oldx >= ww - min_visible) {
        this.x = Math.min(oldx, ww - min_visible)
    }
    if (oldy <= min_visible) {
        this.y = 0 + this.topoffset
    } else if (oldy >= wh - min_visible) {
        this.y = Math.min(oldy, wh - min_visible)
    }
    if (oldx != this.x || oldy != this.y) {
        this.updateCSSGeometry();
        return false
    }
    return true
};
XpraWindow.prototype.updateCanvasGeometry = function () {
    if (this.canvas.width != this.w) {
        this.canvas.width = this.w
    }
    if (this.canvas.height != this.h) {
        this.canvas.height = this.h
    }
    if (this.offscreen_canvas.width != this.w) {
        this.offscreen_canvas.width = this.w
    }
    if (this.offscreen_canvas.height != this.h) {
        this.offscreen_canvas.height = this.h
    }
};
XpraWindow.prototype.updateCSSGeometry = function () {
    this.updateCanvasGeometry();
    if (this.client.server_is_desktop) {
        jQuery(this.div).position({of: jQuery("#screen")});
        return
    }
    this.outerH = this.h + this.topoffset + this.bottomoffset;
    this.outerW = this.w + this.leftoffset + this.rightoffset;
    jQuery(this.div).css("width", this.outerW);
    jQuery(this.div).css("height", this.outerH);
    this.outerX = this.x - this.leftoffset;
    this.outerY = this.y - this.topoffset;
    jQuery(this.div).css("left", this.outerX);
    jQuery(this.div).css("top", this.outerY)
};
XpraWindow.prototype.updateFocus = function () {
    if (this.focused) {
        jQuery(this.div).addClass("windowinfocus")
    } else {
        jQuery(this.div).removeClass("windowinfocus")
    }
};
XpraWindow.prototype.on_mousemove = function (e) {
    this.mouse_move_cb(this.client, e, this);
    e.preventDefault();
    return false
};
XpraWindow.prototype.on_mousedown = function (e) {
    this.mouse_down_cb(this.client, e, this);
    e.preventDefault();
    return false
};
XpraWindow.prototype.on_mouseup = function (e) {
    this.mouse_up_cb(this.client, e, this);
    e.preventDefault();
    return false
};
XpraWindow.prototype.on_mousescroll = function (e) {
    this.mouse_scroll_cb(this.client, e, this);
    e.preventDefault();
    return false
};
XpraWindow.prototype.toString = function () {
    return "Window(" + this.wid + ")"
};
XpraWindow.prototype.update_zindex = function () {
    var z = 5e3 + this.stacking_layer;
    if (this.tray) {
        z = 0
    } else if (this.override_redirect || this.client.server_is_desktop) {
        z = 15e3
    } else if (this.windowtype == "DROPDOWN" || this.windowtype == "TOOLTIP" || this.windowtype == "POPUP_MENU" || this.windowtype == "MENU" || this.windowtype == "COMBO") {
        z = 2e4
    } else if (this.windowtype == "UTILITY" || this.windowtype == "DIALOG") {
        z = 15e3
    }
    var above = this.metadata["above"];
    if (above) {
        z += 5e3
    } else {
        var below = this.metadata["below"];
        if (below) {
            z -= 5e3
        }
    }
    if (this.focused) {
        z += 2500
    }
    jQuery(this.div).css("z-index", z)
};
XpraWindow.prototype.update_metadata = function (metadata, safe) {
    this.debug("main", "update_metadata(", metadata, ")");
    for (var attrname in metadata) {
        this.metadata[attrname] = metadata[attrname]
    }
    if (safe) {
        this.set_metadata_safe(metadata)
    } else {
        this.set_metadata(metadata)
    }
    this.update_zindex()
};
XpraWindow.prototype.set_metadata_safe = function (metadata) {
    if ("title" in metadata) {
        this.title = metadata["title"];
        jQuery("#title" + this.wid).html(decodeURIComponent(escape(this.title)))
    }
    if ("has-alpha" in metadata) {
        this.has_alpha = metadata["has-alpha"]
    }
    if ("window-type" in metadata) {
        this.windowtype = metadata["window-type"][0]
    }
    if ("decorations" in metadata) {
        this.decorations = metadata["decorations"];
        this._set_decorated(this.decorations);
        this.updateCSSGeometry();
        this.handle_resized();
        this.apply_size_constraints()
    }
    if ("opacity" in metadata) {
        var opacity = metadata["opacity"];
        if (opacity < 0) {
            opacity = 1
        } else {
            opacity = opacity / 4294967296
        }
        jQuery(this.div).css("opacity", "" + opacity)
    }
    var attrs = ["modal", "above", "below"];
    for (var i = 0; i < attrs.length; i++) {
        var attr = attrs[i];
        if (attr in metadata) {
            var value = metadata[attr];
            if (value) {
                jQuery(this.div).addClass(attr)
            } else {
                jQuery(this.div).removeClass(attr)
            }
        }
    }
    if (this.resizable && "size-constraints" in metadata) {
        this.apply_size_constraints()
    }
    if ("class-instance" in metadata) {
        var wm_class = metadata["class-instance"];
        var classes = jQuery(this.div).prop("classList");
        if (classes) {
            for (var i = 0; i < classes.length; i++) {
                var tclass = "" + classes[i];
                if (tclass.indexOf("wmclass-") === 0 && wm_class && wm_class.indexOf(tclass) < 0) {
                    jQuery(this.div).removeClass(tclass)
                }
            }
        }
        if (wm_class) {
            for (var i = 0; i < wm_class.length; i++) {
                var tclass = wm_class[i].replace(/[^0-9a-zA-Z]/g, "");
                if (tclass && !jQuery(this.div).hasClass(tclass)) {
                    jQuery(this.div).addClass("wmclass-" + tclass)
                }
            }
        }
    }
};
XpraWindow.prototype.apply_size_constraints = function () {
    var size_constraints = this.metadata["size-constraints"];
    if (!this.resizable) {
        return
    }
    if (this.maximized) {
        jQuery(this.div).draggable("disable")
    } else {
        jQuery(this.div).draggable("enable")
    }
    var hdec = 0, wdec = 0;
    if (this.decorations) {
        hdec = jQuery("#head" + this.wid).outerHeight(true)
    }
    var min_size = null, max_size = null;
    if (size_constraints) {
        min_size = size_constraints["minimum-size"];
        max_size = size_constraints["maximum-size"]
    }
    var minw = null, minh = null;
    if (min_size) {
        minw = min_size[0] + wdec;
        minh = min_size[1] + hdec
    }
    var maxw = null, maxh = null;
    if (max_size) {
        maxw = max_size[0] + wdec;
        maxh = max_size[1] + hdec
    }
    if (minw > 0 && minw == maxw && minh > 0 && minh == maxh) {
        jQuery(this.d_maximizebtn).hide();
        jQuery(this.div).resizable("disable")
    } else {
        jQuery(this.d_maximizebtn).show();
        if (!this.maximized) {
            jQuery(this.div).resizable("enable")
        } else {
            jQuery(this.div).resizable("disable")
        }
    }
    if (!this.maximized) {
        jQuery(this.div).resizable("option", "minWidth", minw);
        jQuery(this.div).resizable("option", "minHeight", minh);
        jQuery(this.div).resizable("option", "maxWidth", maxw);
        jQuery(this.div).resizable("option", "maxHeight", maxh)
    }
};
XpraWindow.prototype.set_metadata = function (metadata) {
    this.set_metadata_safe(metadata);
    if ("fullscreen" in metadata) {
        this.set_fullscreen(metadata["fullscreen"] == 1)
    }
    if ("maximized" in metadata) {
        this.set_maximized(metadata["maximized"] == 1)
    }
};
XpraWindow.prototype.save_geometry = function () {
    this.saved_geometry = {x: this.x, y: this.y, w: this.w, h: this.h}
};
XpraWindow.prototype.restore_geometry = function () {
    if (this.saved_geometry == null) {
        return
    }
    this.x = this.saved_geometry["x"];
    this.y = this.saved_geometry["y"];
    this.w = this.saved_geometry["w"];
    this.h = this.saved_geometry["h"];
    this.saved_geometry = null;
    this.handle_resized();
    this.set_focus_cb(this)
};
XpraWindow.prototype.set_maximized = function (maximized) {
    if (this.maximized == maximized) {
        return
    }
    this.max_save_restore(maximized);
    this.maximized = maximized;
    this.handle_resized();
    this.set_focus_cb(this);
    this.apply_size_constraints()
};
XpraWindow.prototype.toggle_maximized = function () {
    this.set_maximized(!this.maximized)
};
XpraWindow.prototype.set_fullscreen = function (fullscreen) {
    if (this.fullscreen == fullscreen) {
        return
    }
    if (this.resizable) {
        if (fullscreen) {
            this._set_decorated(false)
        } else {
            this._set_decorated(this.decorations)
        }
    }
    this.max_save_restore(fullscreen);
    this.fullscreen = fullscreen;
    this.updateCSSGeometry();
    this.handle_resized();
    this.set_focus_cb(this)
};
XpraWindow.prototype._set_decorated = function (decorated) {
    this.topoffset = parseInt(jQuery(this.div).css("border-top-width"), 10);
    if (decorated) {
        jQuery("#head" + this.wid).show();
        jQuery(this.div).removeClass("undecorated");
        jQuery(this.div).addClass("window");
        if (this.d_header) {
            this.topoffset = this.topoffset + parseInt(jQuery(this.d_header).css("height"), 10)
        }
    } else {
        jQuery("#head" + this.wid).hide();
        jQuery(this.div).removeClass("window");
        jQuery(this.div).addClass("undecorated")
    }
};
XpraWindow.prototype.max_save_restore = function (use_all_space) {
    if (use_all_space) {
        this.save_geometry();
        this.fill_screen()
    } else {
        this.restore_geometry()
    }
};
XpraWindow.prototype.fill_screen = function () {
    var screen_size = this.client._get_desktop_size();
    this.x = 0 + this.leftoffset;
    this.y = 0 + this.topoffset;
    this.w = screen_size[0] - this.leftoffset - this.rightoffset;
    this.h = screen_size[1] - this.topoffset - this.bottomoffset
};
XpraWindow.prototype.handle_resized = function (e) {
    if (e) {
        this.x = this.x + Math.round(e.position.left - e.originalPosition.left);
        this.y = this.y + Math.round(e.position.top - e.originalPosition.top);
        this.w = Math.round(e.size.width) - this.leftoffset - this.rightoffset;
        this.h = Math.round(e.size.height) - this.topoffset - this.bottomoffset
    }
    this.updateCSSGeometry();
    this.geometry_cb(this)
};
XpraWindow.prototype.handle_moved = function (e) {
    this.x = Math.round(e.position.left) + this.leftoffset;
    this.y = Math.round(e.position.top) + this.topoffset;
    this.ensure_visible();
    this.geometry_cb(this)
};
XpraWindow.prototype.screen_resized = function () {
    console.log("screen resized");
    if (this.client.server_is_desktop) {
        this.match_screen_size();
        this.handle_resized()
    }
    if (this.fullscreen || this.maximized) {
        this.fill_screen();
        this.handle_resized()
    }
    this.ensure_visible()
};
XpraWindow.prototype.match_screen_size = function () {
    var maxw = this.client.desktop_width;
    var maxh = this.client.desktop_height;
    var neww = 0, newh = 0;
    if (this.client.server_resize_exact) {
        neww = maxw;
        newh = maxh;
        console.log("resizing to exact size:", neww, newh)
    } else {
        if (this.client.server_screen_sizes.length == 0) {
            return
        }
        var best = 0;
        var w = 0, h = 0;
        var screen_sizes = this.client.server_screen_sizes;
        var screen_size;
        for (var i = 0; i < screen_sizes.length; i++) {
            screen_size = screen_sizes[i];
            w = screen_size[0];
            h = screen_size[1];
            if (w <= maxw && h <= maxh && w * h > best) {
                best = w * h;
                neww = w;
                newh = h
            }
        }
        if (neww == 0 && newh == 0) {
            best = 0;
            for (var i = 0; i < screen_sizes.length; i++) {
                screen_size = screen_sizes[i];
                w = screen_size[0];
                h = screen_size[1];
                if (best == 0 || w * h < best) {
                    best = w * h;
                    neww = w;
                    newh = h
                }
            }
        }
        console.log("best screen size:", neww, newh)
    }
    this.resize(neww, newh)
};
XpraWindow.prototype.move_resize = function (x, y, w, h) {
    if (!(this.w == w) || !(this.h == h) || !(this.x == x) || !(this.y == y)) {
        this.w = w;
        this.h = h;
        this.x = x;
        this.y = y;
        if (!this.ensure_visible()) {
            this.geometry_cb(this)
        }
        this.updateCSSGeometry()
    }
};
XpraWindow.prototype.move = function (x, y) {
    this.move_resize(x, y, this.w, this.h)
};
XpraWindow.prototype.resize = function (w, h) {
    this.move_resize(this.x, this.y, w, h)
};
XpraWindow.prototype.initiate_moveresize = function (mousedown_event, x_root, y_root, direction, button, source_indication) {
    var dir_str = MOVERESIZE_DIRECTION_STRING[direction];
    this.log("initiate_moveresize", dir_str, [x_root, y_root, direction, button, source_indication]);
    if (direction == MOVERESIZE_MOVE && mousedown_event) {
        var e = mousedown_event;
        e.type = "mousedown.draggable";
        e.target = this.div[0];
        this.div.trigger(e)
    } else if (direction == MOVERESIZE_CANCEL) {
        jQuery(this.div).draggable("disable");
        jQuery(this.div).draggable("enable")
    } else if (direction in MOVERESIZE_DIRECTION_JS_NAME) {
        var js_dir = MOVERESIZE_DIRECTION_JS_NAME[direction];
        var resize_widget = jQuery(this.div).find(".ui-resizable-handle.ui-resizable-" + js_dir).first();
        if (resize_widget) {
            var pageX = resize_widget.offset().left;
            var pageY = resize_widget.offset().top;
            resize_widget.trigger("mouseover");
            resize_widget.trigger({type: "mousedown", which: 1, pageX: pageX, pageY: pageY})
        }
    }
};
XpraWindow.prototype.get_internal_geometry = function () {
    return {x: this.x, y: this.y, w: this.w, h: this.h}
};
XpraWindow.prototype.handle_mouse_click = function (button, pressed, mx, my, modifiers, buttons) {
    this.debug("mouse", "got mouse click at ", mx, my);
    this.mouse_click_cb(this, button, pressed, mx, my, modifiers, buttons)
};
XpraWindow.prototype.update_icon = function (width, height, encoding, img_data) {
    var src = "/favicon.png";
    if (encoding == "png") {
        $("#title" + String(this.wid)).css("left", 32);
        src = "data:image/" + encoding + ";base64," + Utilities.ArrayBufferToBase64(img_data)
    }
    jQuery("#windowicon" + String(this.wid)).attr("src", src);
    return src
};
XpraWindow.prototype.reset_cursor = function () {
    jQuery("#" + String(this.wid)).css("cursor", "default")
};
XpraWindow.prototype.set_cursor = function (encoding, w, h, xhot, yhot, img_data) {
    if (encoding == "png") {
        var cursor_url = "url('data:image/" + encoding + ";base64," + window.btoa(img_data) + "')";
        jQuery("#" + String(this.wid)).css("cursor", cursor_url + ", default");
        jQuery("#" + String(this.wid)).css("cursor", cursor_url + " " + xhot + " " + yhot + ", auto")
    }
};
XpraWindow.prototype.draw = function () {
    if (this.has_alpha || this.tray) {
        this.canvas_ctx.clearRect(0, 0, this.draw_canvas.width, this.draw_canvas.height)
    }
    this.canvas_ctx.drawImage(this.draw_canvas, 0, 0)
};
XpraWindow.prototype._init_broadway = function (enc_width, enc_height, width, height) {
    var me = this;
    this.broadway_decoder = new Decoder({rgb: true, size: {width: enc_width, height: enc_height}});
    this.log("broadway decoder initialized");
    this.broadway_paint_location = [0, 0];
    this.broadway_decoder.onPictureDecoded = function (buffer, p_width, p_height, infos) {
        me.debug("draw", "broadway picture decoded: ", buffer.length, "bytes, size ", p_width, "x", p_height + ", paint location: ", me.broadway_paint_location, "with infos=", infos);
        if (!me.broadway_decoder) {
            return
        }
        var img = me.offscreen_canvas_ctx.createImageData(p_width, p_height);
        img.data.set(buffer);
        var x = me.broadway_paint_location[0];
        var y = me.broadway_paint_location[1];
        me.offscreen_canvas_ctx.putImageData(img, x, y);
        if (enc_width != width || enc_height != height) {
            me.offscreen_canvas_ctx.drawImage(me.offscreen_canvas, x, y, p_width, p_height, x, y, width, height)
        }
    }
};
XpraWindow.prototype._close_broadway = function () {
    this.broadway_decoder = null
};
XpraWindow.prototype._close_video = function () {
    this.debug("draw", "close_video: video_source_buffer=", this.video_source_buffer, ", media_source=", this.media_source, ", video=", this.video);
    this.video_source_ready = false;
    if (this.video) {
        if (this.media_source) {
            try {
                if (this.video_source_buffer) {
                    this.media_source.removeSourceBuffer(this.video_source_buffer)
                }
                this.media_source.endOfStream()
            } catch (e) {
                this.warn("video media source EOS error: " + e)
            }
            this.video_source_buffer = null;
            this.media_source = null
        }
        this.video.remove();
        this.video = null
    }
};
XpraWindow.prototype._push_video_buffers = function () {
    this.debug("draw", "_push_video_buffers()");
    var vsb = this.video_source_buffer;
    var vb = this.video_buffers;
    if (!vb || !vsb || !this.video_source_ready) {
        return
    }
    if (vb.length == 0 && this.video_buffers_count == 0) {
        return
    }
    while (vb.length > 0 && !vsb.updating) {
        var buffers = vb.splice(0, 20);
        var buffer = [].concat.apply([], buffers);
        vsb.appendBuffer(new Uint8Array(buffer).buffer);
        this.video_buffers_count += buffers.length
    }
    if (vb.length > 0) {
        setTimeout(this._push_video_buffers, 25)
    }
};
XpraWindow.prototype._init_video = function (width, height, coding, profile, level) {
    var me = this;
    this.media_source = MediaSourceUtil.getMediaSource();
    this.video = document.createElement("video");
    this.video.setAttribute("autoplay", true);
    this.video.setAttribute("muted", true);
    this.video.setAttribute("width", width);
    this.video.setAttribute("height", height);
    this.video.style.pointerEvents = "all";
    this.video.style.position = "absolute";
    this.video.style.zIndex = this.div.css("z-index") + 1;
    this.video.style.left = "" + this.leftoffset + "px";
    this.video.style.top = "" + this.topoffset + "px";
    if (this.debug_categories.includes("audio")) {
        MediaSourceUtil.addMediaElementEventDebugListeners(this.video, "video");
        this.video.setAttribute("controls", "controls")
    }
    this.video.addEventListener("error", function () {
        me.error("video error")
    });
    this.video.src = window.URL.createObjectURL(this.media_source);
    this.video_buffers = [];
    this.video_buffers_count = 0;
    this.video_source_ready = false;
    var codec_string = "";
    if (coding == "h264+mp4" || coding == "mpeg4+mp4") {
        codec_string = 'video/mp4; codecs="avc1.' + MediaSourceConstants.H264_PROFILE_CODE[profile] + MediaSourceConstants.H264_LEVEL_CODE[level] + '"'
    } else if (coding == "vp8+webm") {
        codec_string = 'video/webm;codecs="vp8"'
    } else if (coding == "vp9+webm") {
        codec_string = 'video/webm;codecs="vp9"'
    } else {
        throw Exception("invalid encoding: " + coding)
    }
    this.log("video codec string: " + codec_string + " for " + coding + " profile '" + profile + "', level '" + level + "'");
    this.media_source.addEventListener("sourceopen", function () {
        me.log("video media source open");
        var vsb = me.media_source.addSourceBuffer(codec_string);
        vsb.mode = "sequence";
        me.video_source_buffer = vsb;
        if (me.debug_categories.includes("draw")) {
            MediaSourceUtil.addSourceBufferEventDebugListeners(vsb, "video")
        }
        vsb.addEventListener("error", function (e) {
            me.error("video source buffer error")
        });
        vsb.addEventListener("waiting", function () {
            me._push_video_buffers()
        });
        me._push_video_buffers();
        me.video_source_ready = true
    });
    this.canvas.parentElement.appendChild(this.video)
};
XpraWindow.prototype._non_video_paint = function (coding) {
    if (this.video && this.video.style.zIndex != "-1") {
        this.debug("draw", "bringing canvas above video for ", coding, " paint event");
        this.video.style.zIndex = "-1";
        var width = this.video.getAttribute("width");
        var height = this.video.getAttribute("height");
        this.offscreen_canvas_ctx.drawImage(this.video, 0, 0, width, height)
    }
};
XpraWindow.prototype.paint = function paint() {
    var item = Array.prototype.slice.call(arguments);
    this.paint_queue.push(item);
    this.may_paint_now()
};
XpraWindow.prototype.may_paint_now = function paint() {
    this.debug("draw", "may_paint_now() paint pending=", this.paint_pending, ", paint queue length=", this.paint_queue.length);
    var now = Utilities.monotonicTime();
    while ((this.paint_pending == 0 || now - this.paint_pending >= 2e3) && this.paint_queue.length > 0) {
        this.paint_pending = now;
        var item = this.paint_queue.shift();
        this.do_paint.apply(this, item);
        now = Utilities.monotonicTime()
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
    scroll: "brown"
};
XpraWindow.prototype.do_paint = function paint(x, y, width, height, coding, img_data, packet_sequence, rowstride, options, decode_callback) {
    this.debug("draw", "do_paint(", img_data.length, " bytes of ", "zlib" in options ? "zlib " : "", coding, " data ", width, "x", height, " at ", x, ",", y, ") focused=", this.focused);
    var me = this;
    var enc_width = width;
    var enc_height = height;
    var scaled_size = options["scaled_size"];
    if (scaled_size) {
        enc_width = scaled_size[0];
        enc_height = scaled_size[1]
    }

    function paint_box(color, px, py, pw, ph) {
        me.offscreen_canvas_ctx.strokeStyle = color;
        me.offscreen_canvas_ctx.lineWidth = "2";
        me.offscreen_canvas_ctx.strokeRect(px, py, pw, ph)
    }

    function painted(skip_box) {
        me.paint_pending = 0;
        if (me.paint_debug && !skip_box) {
            var color = DEFAULT_BOX_COLORS[coding] || "white";
            paint_box(color, x, y, width, height)
        }
        decode_callback()
    }

    function paint_error(e) {
        me.error("error painting", coding, e);
        me.paint_pending = 0;
        decode_callback("" + e)
    }

    try {
        if (coding == "rgb32") {
            this._non_video_paint(coding);
            var img = this.offscreen_canvas_ctx.createImageData(width, height);
            if (options != null && options["zlib"] > 0) {
                var inflated = new Zlib.Inflate(img_data).decompress();
                img_data = inflated
            } else if (options != null && options["lz4"] > 0) {
                if (img_data.subarray) {
                    var d = img_data.subarray(0, 4)
                } else {
                    var d = img_data.slice(0, 4)
                }
                var length = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24;
                var inflated = new Buffer(length);
                if (img_data.subarray) {
                    var uncompressedSize = LZ4.decodeBlock(img_data.subarray(4), inflated)
                } else {
                    var uncompressedSize = LZ4.decodeBlock(img_data.slice(4), inflated)
                }
                img_data = inflated.slice(0, uncompressedSize)
            }
            if (img_data.length > img.data.length) {
                paint_error("data size mismatch: wanted " + img.data.length + ", got " + img_data.length + ", stride=" + rowstride)
            } else {
                this.debug("draw", "got ", img_data.length, "to paint with stride", rowstride);
                img.data.set(img_data);
                this.offscreen_canvas_ctx.putImageData(img, x, y);
                painted()
            }
            this.may_paint_now()
        } else if (coding == "jpeg" || coding == "png" || coding == "webp") {
            this._non_video_paint(coding);
            var j = new Image;
            j.onload = function () {
                if (j.width == 0 || j.height == 0) {
                    paint_error("invalid image size: " + j.width + "x" + j.height)
                } else {
                    me.offscreen_canvas_ctx.drawImage(j, x, y);
                    painted()
                }
                me.may_paint_now()
            };
            j.onerror = function () {
                paint_error("failed to load into image tag:", coding);
                me.may_paint_now()
            };
            j.src = "data:image/" + coding + ";base64," + Utilities.ArrayBufferToBase64(img_data)
        } else if (coding == "h264") {
            var frame = options["frame"] || 0;
            if (frame == 0) {
                this._close_broadway()
            }
            if (!this.broadway_decoder) {
                this._init_broadway(enc_width, enc_height, width, height)
            }
            this.broadway_paint_location = [x, y];
            if (!Array.isArray(img_data)) {
                img_data = Array.from(img_data)
            }
            this.broadway_decoder.decode(img_data);
            painted()
        } else if (coding == "h264+mp4" || coding == "vp8+webm" || coding == "mpeg4+mp4") {
            var frame = options["frame"] || -1;
            if (frame == 0) {
                this._close_video()
            }
            if (!this.video) {
                var profile = options["profile"] || "baseline";
                var level = options["level"] || "3.0";
                this._init_video(width, height, coding, profile, level)
            } else {
                this.video.style.zIndex = this.div.css("z-index") + 1
            }
            if (img_data.length > 0) {
                this.debug("draw", "video state=", MediaSourceConstants.READY_STATE[this.video.readyState], ", network state=", MediaSourceConstants.NETWORK_STATE[this.video.networkState]);
                this.debug("draw", "video paused=", this.video.paused, ", video buffers=", this.video_buffers.length);
                this.video_buffers.push(img_data);
                if (this.video.paused) {
                    this.video.play()
                }
                this._push_video_buffers();
                var delay = Math.max(10, 50 * (this.video_buffers.length - 25));
                setTimeout(function () {
                    painted();
                    me.may_paint_now()
                }, delay)
            }
        } else if (coding == "scroll") {
            this._non_video_paint(coding);
            for (var i = 0, j = img_data.length; i < j; ++i) {
                var scroll_data = img_data[i];
                this.debug("draw", "scroll", i, ":", scroll_data);
                var sx = scroll_data[0], sy = scroll_data[1], sw = scroll_data[2], sh = scroll_data[3],
                    xdelta = scroll_data[4], ydelta = scroll_data[5];
                this.offscreen_canvas_ctx.drawImage(this.draw_canvas, sx, sy, sw, sh, sx + xdelta, sy + ydelta, sw, sh);
                if (this.debug_categories.includes("draw")) {
                    paint_box("brown", sx + xdelta, sy + ydelta, sw, sh)
                }
            }
            painted(true);
            this.may_paint_now()
        } else {
            paint_error("unsupported encoding")
        }
    } catch (e) {
        paint_error(e)
    }
};
XpraWindow.prototype.destroy = function destroy() {
    this._close_broadway();
    this._close_video();
    this.div.remove()
};