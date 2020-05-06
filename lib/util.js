
export class ClientError extends Error {
   constructor(message, cause = null) {
        super(message);
        if (cause != null)
            this.cause = cause;
    }

    toJson() {
        const error = {
            'error': this.message
        };

        if (this.cause) {
            if (this.cause instanceof ClientError)
                error.cause = this.cause.toJson();
            else if (this.cause instanceof Error)
                error.cause = this.cause.toString();
            else error.cause = this.cause;
        }

        return error;
    }
}

export async function _fetch(url, method = "GET", obj, token = null) {
    let header = {};
    let body = undefined;
    if (token) header.authorization = `Bearer ${token}`;
    if (obj) {
        header['content-type'] = "application/json";
        body = JSON.stringify(obj);
    }

    const res = await fetch(url, {
        method,
        headers: header,
        body: body,
    });
    if (res.ok) {
        try {
            return await res.json();
        } catch (e) {
            return;
        }
    }

    var cause;
    try {
        // Server should return an error description...
        const details = await res.json();
        cause = details.error;
    } catch (e) {
        // if not, then maybe a string?
        cause = await res.text();
    }

    throw new ClientError("'" + method + " " + url + "' failed with " + res.status + "!", cause);
}

export async function sendEsc()  {
    const pressKey = async (key, keyCode = key.toUpperCase().charCodeAt(0), 
        {altKey, ctrlKey, metaKey, timeout} = {timeout: 100}, el = document.getElementById("emulator-container").firstElementChild) => {
            el.dispatchEvent(new KeyboardEvent("keydown", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
            await new Promise(r => setTimeout(r, 100));
            el.dispatchEvent(new KeyboardEvent("keyup", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
    };
    pressKey("Esc", 27, {});
}

export async function sendCtrlAltDel() 
{
    console.log("ctrl alt del");
    const pressKey = async (key, keyCode = key.toUpperCase().charCodeAt(0), 
        {altKey, ctrlKey, metaKey, timeout} = {timeout: 100}, el = document.getElementById("emulator-container").firstElementChild) => {
        if (ctrlKey) {
            el.dispatchEvent(new KeyboardEvent("keydown", {key: "Control", keyCode: 17, bubbles: true}));
            await new Promise(r => setTimeout(r, 100));
        }
        if (altKey) {
            el.dispatchEvent(new KeyboardEvent("keydown", {key: "Alt", keyCode: 18, bubbles: true}));
            await new Promise(r => setTimeout(r, 100));
        }
        el.dispatchEvent(new KeyboardEvent("keydown", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
        await new Promise(r => setTimeout(r, 100));
        el.dispatchEvent(new KeyboardEvent("keyup", {key, keyCode, ctrlKey, altKey, metaKey, bubbles: true}));
        if (altKey) {
            await new Promise(r => setTimeout(r, 100));
            el.dispatchEvent(new KeyboardEvent("keyup", {key: "Alt", keyCode: 18, bubbles: true}));
        }
        if (ctrlKey) {
            await new Promise(r => setTimeout(r, 100));
            el.dispatchEvent(new KeyboardEvent("keyup", {key: "Control", keyCode: 17, bubbles: true}));
        }
    };
    pressKey("Delete", 46, { altKey: true, ctrlKey: true, metaKey: true })
}

/** Requests a pointer-lock on given element, if supported by the browser. */
export function requestPointerLock(target, event) {
    function lockPointer() {
        var havePointerLock = 'pointerLockElement' in document
            || 'mozPointerLockElement' in document
            || 'webkitPointerLockElement' in document;

        if (!havePointerLock) {
            var message = "Your browser does not support the PointerLock API!\n"
                + "Using relative mouse is not possible.\n\n"
                + "Mouse input will be disabled for this virtual environment.";

            console.warn(message);
            alert(message);
            return;
        }

        // Activate pointer-locking
        target.requestPointerLock = target.requestPointerLock
            || target.mozRequestPointerLock
            || target.webkitRequestPointerLock;

        target.requestPointerLock();
    };

    function enableLockEventListener() {
        target.addEventListener(event, lockPointer, false);
    };

    function disableLockEventListener() {
        target.removeEventListener(event, lockPointer, false);
    };

    function onPointerLockChange() {
        if (document.pointerLockElement === target
            || document.mozPointerLockElement === target
            || document.webkitPointerLockElement === target) {
            // Pointer was just locked
            console.debug("Pointer was locked!");
            target.isPointerLockEnabled = true;
            disableLockEventListener();
        } else {
            // Pointer was just unlocked
            console.debug("Pointer was unlocked.");
            target.isPointerLockEnabled = false;
            enableLockEventListener();
        }
    };

    function onPointerLockError(error) {
        var message = "Pointer lock failed!";
        console.warn(message);
        alert(message);
    }

    // Hook for pointer lock state change events
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);

    // Hook for pointer lock errors
    document.addEventListener('pointerlockerror', onPointerLockError, false);
    document.addEventListener('mozpointerlockerror', onPointerLockError, false);
    document.addEventListener('webkitpointerlockerror', onPointerLockError, false);

    enableLockEventListener();

    // Set flag for relative-mouse mode
    target.isRelativeMouse = true;
};
