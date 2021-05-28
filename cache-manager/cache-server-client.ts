/**
 * A class that defines a client to interact with the cache servers.
 */

const fetch = require('node-fetch');

export class CacheServerClient {
    /**
     * @constructor
     */
    constructor() {}

    public async putDataAsync(serverIp: string, key: string, value: string, expirationDate: number): Promise<void> {
        const payload = {
            value: value,
            expirationDate: expirationDate
        }

        const options = {
            host: serverIp,
            port: 5000,
            path: `/${key}`,
            method: 'PUT'
        }; 

        try {
            await fetch(`http://${serverIp}:${this._cCacheServerPort}/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch(e) {
            console.log(`Exception while trying to connect with server - ${serverIp}`);
        }
    }

    public async getDataAsync(serverIp: string, key: string): Promise<string | null | undefined> {
        let value: string | null | undefined = null;

        try {
            const response = await fetch(`http://${serverIp}:${this._cCacheServerPort}/${key}`);
            console.log("No exception here");
            const data = await response.json();
            value = data.value;
        } catch(e) {
            console.log(`Exception while trying to connect with server - ${serverIp}. error = ${e}`);
        }

        return value;
    }

    private _cCacheServerPort: number = 5000;
}