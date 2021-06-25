import express from "express";
import { PutRequestValidator } from "./validators/request-validator";
import { AddNodeRequestValidator } from "./validators/add-node-validator";
import { ServerHashRingHandler } from "./hash-ring-handler";
import { CacheServerClient } from "./cache-server-client";
import { ServerHealthChecker } from "./server-health-checker";
import { Maybe, MaybeType, Nothing, Just } from "./maybe";
import { Ok, Bad, InternalServerErr, Created, NotFound } from "./http-statuses";
import { 
    CAddedPrimaryServerOk,
    CAddedServerToExistingPoolOk,
    CEmptyHashRingInternalSerErr,
    CGetNotFound,
    CGetOk,
    CInvalidAddNodeBadRequest,
    CInvalidPutBadRequest,
    CPutOk,
    CServerPoolEmptyBadRequest }
from "./api-constants";

/**
 * CacheManager - runs a server that acts as the gateway for cache related requests (GET/PUT) 
 * as well as requests to add nodes to the server pool (POST).
 */

const app = express();
const port = 5000;

const putValidator = new PutRequestValidator();
const addNodeValidator = new AddNodeRequestValidator();
const hashRingHandler = new ServerHashRingHandler();
const serversClient = new CacheServerClient();
const serverHealthChecker = new ServerHealthChecker();
const primaryToNodeListMap = new Map<string, string[]>();

// add json and urlencoded parsing middleware.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/addNode", async (req, res) => {
    if(!addNodeValidator.IsValidPostAddNodeRequest(req)){
        res.status(Bad).send({
            description: CInvalidAddNodeBadRequest
        });
        
        return;
    }

    const isNewPrimaryNode: boolean = req.body.newPrimaryNode;
    const serverIp: string = req.body.serverIp;

    if (isNewPrimaryNode) {
        primaryToNodeListMap.set(serverIp, [serverIp]);

        hashRingHandler.AddServer(serverIp);
        res.status(Ok).send({
            description: CAddedPrimaryServerOk,
            primaryServerIp: serverIp
        });

        return; 
    }

    // add server to smallest existing pool.
    const smallestPoolId: Maybe<string> = await tryGetSmallestPoolIdAsync();

    if (smallestPoolId.type === MaybeType.Nothing) {
        res.status(Bad).send({
            description: CServerPoolEmptyBadRequest
        });

        return;
    }

    primaryToNodeListMap.get(smallestPoolId.value)!.push(serverIp);

    res.status(Ok).send({
        description: CAddedServerToExistingPoolOk,
        addedServerIp: serverIp,
        primaryServerIp: smallestPoolId.value
    });
});

app.put("/:key", async (req, res) => {
    if(!putValidator.IsValidPutRequest(req)){
        res.status(Bad).send({
            description: CInvalidPutBadRequest
        });
        
        return;
    }

    const key: string = req.params.key;
    const value: string = req.body.value;
    const expirationDate: number = req.body.expirationDate;

    // get cache server.
    const serverIp: Maybe<string> = hashRingHandler.GetServerFromKey(key);

    if(serverIp.type === MaybeType.Nothing){
        res.status(InternalServerErr).send({
            description: CEmptyHashRingInternalSerErr
        });

        return;
    }

    let serverPool: string[] = primaryToNodeListMap.get(serverIp.value)!;
    const serversAlive: string[] = await serverHealthChecker.getServersAliveAsync(serverPool);
    serverPool = serverPool.filter(server => serversAlive.includes(server));
    primaryToNodeListMap.set(serverIp.value, serverPool);
    
    let promises: Promise<void>[] = [];
    
    for (const server of primaryToNodeListMap.get(serverIp.value)!) {
        promises.push(serversClient.putDataAsync(server, key, value, expirationDate));
    }
    
    await Promise.all(promises);

    res.status(Created).send({
        description: CPutOk,
        key: key,
        value: value
    });
});

app.get("/:key", async (req, res) => {
    const key: string = req.params.key;
    const serverIp: Maybe<string> = hashRingHandler.GetServerFromKey(key);

    if(serverIp.type === MaybeType.Nothing){
        res.status(InternalServerErr).send({
            description: CEmptyHashRingInternalSerErr
        });

        return;
    }

    let serverPool: string[] = primaryToNodeListMap.get(serverIp.value)!;
    const serversAlive: string[] = await serverHealthChecker.getServersAliveAsync(serverPool);
    serverPool = serverPool.filter(server => serversAlive.includes(server));
    primaryToNodeListMap.set(serverIp.value, serverPool);

    //const chosenServerIp: string = serverPool[Math.floor(Math.random() * serverPool.length)];
    shufflePool(serverPool);

    let value: Maybe<string> = Nothing();
    let chosenServerIp: string = "";

    for (const serverIp of serverPool) {
        value = await serversClient.getDataAsync(serverIp, key);
        if (value.type === MaybeType.Just) {
            chosenServerIp = serverIp;
            break;
        }
    }

    if (value.type === MaybeType.Nothing){
        res.status(NotFound).send({
            description: CGetNotFound,
            key: key
        });
        
        return;
    } 

    res.status(Ok).send({
        description: CGetOk,
        respondingServerIp: chosenServerIp, 
        key: key,
        value: value.value
    });
});

async function tryGetSmallestPoolIdAsync(): Promise<Maybe<string>> {
    let smallestPoolId: Maybe<string> = Nothing();
    let smallestPoolSize: number = Number.MAX_VALUE;
    let poolSize: number;

    for (let keyToNodes of Array.from(primaryToNodeListMap.entries())) {
        poolSize = (await serverHealthChecker.getServersAliveAsync(keyToNodes[1])).length;

        if (poolSize < smallestPoolSize) {
            smallestPoolSize = poolSize;
            smallestPoolId = Just(keyToNodes[0]);
        }
    }

    return smallestPoolId;
}

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shufflePool(serverPool: string[]): void {
    for (let i = serverPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [serverPool[i], serverPool[j]] = [serverPool[j], serverPool[i]];
    }
}

// start the Express server
app.listen(port, () => {
    console.log(`cache manager running and listening to port ${port}`);
});


