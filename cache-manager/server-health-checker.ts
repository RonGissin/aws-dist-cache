/**
 * A class to check server health reports from DynamoDB.
 */

 const { DynamoDB } = require('@aws-sdk/client-dynamodb');
 const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
 import { Maybe, MaybeType } from './maybe';
 
 const REGION = 'us-east-2';

 export class ServerHealthChecker {
    
    private dbclient: any;
    private tableName: any;

    /**
     * @constructor
     */
    constructor() {
        this.dbclient = new DynamoDB({ region: REGION });
		this.tableName = 'CacheServers';
    }

    public async getServersAliveAsync(serverPool: string[]): Promise<string[]> {
        if (serverPool === undefined) return [];
        
        const serversAlive: string[] = [];

        serverPool.forEach(async serverIp => {
            const serverItem: any = await this._getServer(serverIp);
            if (Date.now() - serverItem.reportTime < 10000) {
                serversAlive.push(serverIp);
            }
        });

        return serversAlive;
    }

    private async _getServer(serverIp: string) {
	    const params = {
			TableName: this.tableName,
			Key: marshall({
				id: serverIp
			})
		};

		let item: any = {};

		try {
			item = await this.dbclient.getItem(params);
		} catch (e) {
			console.log(e);
		}

		return item.Item === undefined ? null : unmarshall(item.Item);
    }
}