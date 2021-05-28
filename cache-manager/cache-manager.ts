import fs from 'fs';
import util from 'util';

//const HashRing = require('./consistent-hashing/hash-ring.js'); 
const HashRing = require('hashring');
/**
 * A class that defines a cache manager that handles consistent hashing between servers.
 */

export class CacheManager {
    /**
     * @constructor
     */
    constructor(){
        // promisify to enable async/await.
        this._readFileAsync = util.promisify(fs.readFile);
    }

    /**
     * Loads the server ips configuration and populate the hash ring.
     * @param filePath the file path to load cache server ips from.
     */
    public async PopulateHashRingFromFileAsync(filePath: string): Promise<void> {
        const serverConfigStr: string = await this._readFileAsync(filePath, 'utf8');
        console.log(serverConfigStr);
        const serverIps: string[] = JSON.parse(serverConfigStr).serverIps;
        console.log(serverIps[0]);
        this._hashRing = new HashRing(serverIps);
    }

    /**
     * Gets the correct server to hold / insert the given key. 
     * @param key 
     * @returns 
     */
    public GetServerFromKey(key: string): string | null | undefined {
        const hashKey = this._hashRing.get(key);
        if(hashKey === undefined) return null;

        return hashKey;
    }

    /**
     * Adds the given server ip to the hash ring.
     * @param serverIp The ip of the server to add.
     */
    public AddServerToHashRing(serverIp: string): void {
        this._hashRing.add(serverIp);
    }

     /**
     * Remove the given server ip from the hash ring.
     * @param serverIp The ip of the server to remove.
     */
    public RemoveServerFromHashRing(serverIp: string): void {
        this._hashRing.remove(serverIp);
    }

    private _hashRing: any; 
    private _readFileAsync: Function;
}