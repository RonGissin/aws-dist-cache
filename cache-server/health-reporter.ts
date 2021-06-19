/**
 * A class to check server health reports from DynamoDB.
 */

 const { DynamoDB } = require('@aws-sdk/client-dynamodb');
 const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
 
 const REGION = 'us-east-2';

 export class HealthReporter {
    
    private dbclient: any;
    private tableName: any;
    private serverIp: string;

    /**
     * @constructor
     */
    constructor(serverIp: string) {
        this.dbclient = new DynamoDB({ region: REGION });
		this.tableName = 'CacheServers';
        this.serverIp = serverIp;
    }

    public async reportHealth(): Promise<void> {
        const params = {
			TableName: this.tableName,
			Item: marshall({
				id: this.serverIp,
				reportTime: Date.now()
			})
		};

		try {
			await this.dbclient.putItem(params);
		} catch (e) {
			console.log(e);
		}
    }
}