/**
 * A class that defines a client to interact with the cache servers.
 */

const fetch = require('node-fetch');
import { Maybe, Nothing, Just } from './maybe';

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

    public async getDataAsync(serverIp: string, key: string): Promise<Maybe<string>> {
        let value: Maybe<string> = Nothing();

        try {
            const response: any = await fetch(`http://${serverIp}:${this._cCacheServerPort}/${key}`);
            if (response.ok) {
                const data: any = await response.json();
                value = Just(data.value.value);
            }
        } catch(e) {
            console.log(`Exception while trying to connect with server - ${serverIp}. error = ${e}`);
        }

        return value;
    }

    private _cCacheServerPort: number = 5000;
}