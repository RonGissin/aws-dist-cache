const fetch = require('node-fetch');
const metadata = require('node-ec2-metadata');

export class IMDSClient {
    /**
     * @constructor
     */
    constructor() {}

    public async getEC2Ip(): Promise<string> {
        let ip;

        try {
            ip = await metadata.getMetadataForInstance('public-ipv4');
        } catch (e) {
            console.log(e);
        }

        return ip;

        // try {
        //     const res = await fetch("http://169.254.169.254/latest/meta-data/public-ipv4");
        //     console.log("response ==== " + JSON.stringify(res));
        //     ip = await res.text();
        // } catch(e) {
        //     console.log(e);
        //     return "0";
        // }

        // return ip;
    }
}