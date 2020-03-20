
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

    throw new Error(`${res.status} @ ${url} : ${await res.text()}`);
}
