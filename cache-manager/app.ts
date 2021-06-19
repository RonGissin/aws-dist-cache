import express from "express";
import { PutRequestValidator } from "./request-validator";
import { AddNodeRequestValidator } from "./add-node-validator";
import { CacheManager } from "./cache-manager";
import { CacheServerClient } from "./cache-server-client";
import { ServerHealthChecker } from "./server-health-checker";
import { Maybe, MaybeType, Nothing, Just } from "./maybe";
import { Ok, Bad, InternalServerErr, Created, NotFound } from "./http-statuses";

const app = express();
const port = 5000;

const putValidator = new PutRequestValidator();
const addNodeValidator = new AddNodeRequestValidator();
const cacheManager = new CacheManager();
const serversClient = new CacheServerClient();
const serverHealthChecker = new ServerHealthChecker();
const primaryToNodeListMap = new Map<string, string[]>();

// add json and urlencoded parsing middleware.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/addNode", async (req, res) => {
    if(!addNodeValidator.IsValidPostAddNodeRequest(req)){
        res.status(Bad).send({
            description: "Bad request. Must add serverIp field."
        });
        
        return;
    }

    const isNewPrimaryNode: boolean = req.body.newPrimaryNode;
    const serverIp: string = req.body.serverIp;

    if (isNewPrimaryNode) {
        primaryToNodeListMap.set(serverIp, []);

        cacheManager.AddServerToHashRing(serverIp);
        res.status(Ok).send({
            description: `Ok. Added primary server with ip ${serverIp} to pool.`
        });

        return; 
    }

    // add server to smallest existing pool.
    const smallestPoolId = await tryGetSmallestPoolIdAsync();

    if (smallestPoolId.type === MaybeType.Nothing) {
        res.status(Bad).send({
            description: "Bad request. There are no primary nodes in the cluster. If you wish to add one, please set the newPrimaryNode flag to true."
        });

        return;
    }

    primaryToNodeListMap.get(smallestPoolId.value)!.push(serverIp);

    res.status(Ok).send({
        description: `Ok. Added server with ip ${serverIp} to existing pool with primary ip ${smallestPoolId}.`
    });
});

app.put("/:key", async (req, res) => {
    if(!putValidator.IsValidPutRequest(req)){
        res.status(Bad).send({
            description: "Bad request. Must add value for key, and key expiration date."
        });
        
        return;
    }

    const key: string = req.params.key;
    const value: string = req.body.value;
    const expirationDate: number = req.body.expirationDate;

    // get cache server.
    const serverIp: Maybe<string> = cacheManager.GetServerFromKey(key);

    if(serverIp.type === MaybeType.Nothing){
        res.status(InternalServerErr).send({
            description: "Internal Server Error. Consistent hashing broken."
        });

        return;
    }

    let serverPool: string[] = primaryToNodeListMap.get(serverIp.value)!;
    const serversAlive: string[] = await serverHealthChecker.getServersAliveAsync(serverPool);
    serverPool = serverPool.filter(server => serversAlive.includes(server));
    primaryToNodeListMap.set(serverIp.value, serverPool);
    
    let promises: Promise<void>[] = [];
    primaryToNodeListMap.get(serverIp.value)!.forEach(server => {
        promises.push(serversClient.putDataAsync(server, key, value, expirationDate));
    });

    await Promise.all(promises);

    res.status(Created).send({
        description: `Created. For key ${key}, inserted value ${value}`
    });
});

app.get("/:key", async (req, res) => {
    const key: string = req.params.key;
    const serverIp: Maybe<string> = cacheManager.GetServerFromKey(key);

    if(serverIp.type === MaybeType.Nothing){
        res.status(InternalServerErr).send({
            description: "Internal Server Error. Consistent hashing broken."
        });

        return;
    }

    let serverPool: string[] = primaryToNodeListMap.get(serverIp.value)!;
    const serversAlive: string[] = await serverHealthChecker.getServersAliveAsync(serverPool);
    serverPool = serverPool.filter(server => serversAlive.includes(server));
    primaryToNodeListMap.set(serverIp.value, serverPool);

    const chosenServerIp: string = serverPool[Math.floor(Math.random() * serverPool.length)];

    const value: Maybe<string> = await serversClient.getDataAsync(chosenServerIp, key);

    if (value.type === MaybeType.Nothing){
        console.log("not present.")
        res.status(NotFound).send({
            description: `The requested resource was not found. No value found for key ${key}`
        });
        
        return;
    } 

    console.log("succeeded.");
    res.status(Ok).send({
        description: `Ok. Retrieved value ${value} for key ${key}`,
        value: value
    });
});

async function tryGetSmallestPoolIdAsync(): Promise<Maybe<string>> {
    let smallestPoolId: Maybe<string> = Nothing();
    let smallestPoolSize: number;
    let poolSize: number;

    primaryToNodeListMap.forEach(async (nodes: string[], key: string) => {
        poolSize = (await serverHealthChecker.getServersAliveAsync(nodes)).length;

        if (poolSize < smallestPoolSize) {
            smallestPoolSize = poolSize;
            smallestPoolId = Just(key);
        }
    });

    return smallestPoolId;
}

// start the Express server
app.listen(port, () => {
    console.log(`cache server started at http://localhost:${port}`);
});


