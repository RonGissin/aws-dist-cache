/**
 * A class that defines an in memory cache client. 
 */
export class InMemoryCache {
    /**
     * @constructor
     */
    constructor() {
        this._data = new Map<string, ExpiringValue>();
    }

    public Put(key: string, value: ExpiringValue): void {
        this._data.set(key, value);
    }

    public Get(key: string): ExpiringValue | null | undefined {
        if (!this._data.has(key)){
            return null;
        }

        return this._data.get(key);
    }

    public Delete(key: string): void {
        if (this._data.has(key)){
            this._data.delete(key);
        }
    }

    private _data: Map<string, ExpiringValue>;
}

export interface ExpiringValue {
    value: string,
    expirationDate: number
}