const fetch = require('node-fetch');

export class IMDSClient {
    private ec2: any;
    private getEc2Promisified: any;
    /**
     * @constructor
     */
    constructor() {}

    public async getEC2Ip(): Promise<string> {
        let ip;

        try {
            const res = await fetch("http://169.254.169.254/latest/meta-data/public-ipv4");
            console.log("response ==== " + res);
            ip = await res.text();
        } catch(e) {
            console.log(e);
            return "0";
        }

        return ip;
    }
}