export function prepareAndLoadXpra(xpraUrl, xpraConf) {
    /*
     search for xpra path, in order to include it to filePath
     */
    var scripts = document.getElementsByTagName("script");
    for (var prop in scripts) {
        var searchingAim = "eaas-client.js";
        if (typeof (scripts[prop].src) != "undefined" && scripts[prop].src.indexOf(searchingAim) != -1) {
            var eaasClientPath = scripts[prop].src;
        }
    }
    if (typeof eaasClientPath == "undefined") {
        xpraPath = "xpra/";
    } else {
        var xpraPath = eaasClientPath.substring(0, eaasClientPath.indexOf(searchingAim)) + "xpra/";
    }
    let vm = this;
    jQuery.when(
        jQuery.getScript(xpraPath + '/js/lib/zlib.js'),

        jQuery.getScript(xpraPath + '/js/lib/aurora/aurora.js'),
        jQuery.getScript(xpraPath + '/js/lib/lz4.js'),
        jQuery.getScript(xpraPath + '/js/lib/jquery-ui.js'),
        jQuery.getScript(xpraPath + '/js/lib/jquery.ba-throttle-debounce.js'),
        jQuery.Deferred(function (deferred) {
            jQuery(deferred.resolve);
        })).done(function () {
        jQuery.when(
            jQuery.getScript(xpraPath + '/js/lib/bencode.js'),
            jQuery.getScript(xpraPath + '/js/lib/forge.js'),
            jQuery.getScript(xpraPath + '/js/lib/wsworker_check.js'),
            jQuery.getScript(xpraPath + '/js/lib/broadway/Decoder.js'),
            jQuery.getScript(xpraPath + '/js/lib/aurora/aurora-xpra.js'),
            jQuery.getScript(xpraPath + '/eaas-xpra.js'),
            jQuery.getScript(xpraPath + '/js/Keycodes.js'),
            jQuery.getScript(xpraPath + '/js/Utilities.js'),
            jQuery.getScript(xpraPath + '/js/Notifications.js'),
            jQuery.getScript(xpraPath + '/js/MediaSourceUtil.js'),
            jQuery.getScript(xpraPath + '/js/Window.js'),
            jQuery.getScript(xpraPath + '/js/Protocol.js'),
            jQuery.getScript(xpraPath + '/js/Client.js'),

            jQuery.Deferred(function (deferred) {
                jQuery(deferred.resolve);
            })).done(function () {
            vm.xpraClient = loadXpra(xpraUrl, xpraPath, xpraConf, vm);
        })
    })
};