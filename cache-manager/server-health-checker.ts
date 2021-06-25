/**
 * A class to check server health reports from DynamoDB.
 */

 const { DynamoDB } = require('@aws-sdk/client-dynamodb');
 const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
 
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

        for (const serverIp of serverPool) {
            const serverItem: any = await this._getServer(serverIp);
            if (Date.now() - serverItem.reportTime < 40000) {
                serversAlive.push(serverIp);
            }
        }

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