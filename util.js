
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
