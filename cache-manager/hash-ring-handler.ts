import { Maybe, Nothing, Just } from './maybe';
const HashRing = require('hashring');

/**
 * A class that defines a handler that handles consistent hashing between servers.
 */

export class ServerHashRingHandler {
    /**
     * @constructor
     */
    constructor(){
        this._hashRing = new HashRing();
    }

    /**
     * Gets the correct server to hold / insert the given key. 
     * @param key 
     * @returns 
     */
    public GetServerFromKey(key: string): Maybe<string> {
        const hashKey: string = this._hashRing.get(key);
        if(hashKey === undefined) return Nothing();

        return Just(hashKey);
    }

    /**
     * Adds the given server ip to the hash ring.
     * @param serverIp The ip of the server to add.
     */
    public AddServer(serverIp: string): void {
        this._hashRing.add(serverIp);
    }

     /**
     * Remove the given server ip from the hash ring.
     * @param serverIp The ip of the server to remove.
     */
    public RemoveServer(serverIp: string): void {
        this._hashRing.remove(serverIp);
    }

    private _hashRing: any;
}