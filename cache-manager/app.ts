import express from "express";
import { PutRequestValidator } from "./request-validator";
import { AddNodeRequestValidator } from "./add-node-validator";
import { CacheManager } from "./cache-manager";
import { CacheServerClient } from "./cache-server-client";

const app = express();
const port = 5000;

const putValidator = new PutRequestValidator();
const addNodeValidator = new AddNodeRequestValidator();
const cacheManager = new CacheManager();
const serversClient = new CacheServerClient();

// add json and urlencoded parsing middleware.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/addNode", (req, res) => {
    if(!addNodeValidator.IsValidPostAddNodeRequest(req)){
        res.status(400).send({
            statusCode: 400,
            description: "Bad request. Must add serverIp field."
        });
        
        return;
    }

    const serverIp = req.body.serverIp;
    cacheManager.AddServerToHashRing(serverIp);

    res.status(200).send({
        statusCode: 200,
        description: `Ok. Added server with ip ${serverIp} to pool.`
    });
});

app.put("/:key", async (req, res) => {
    if(!putValidator.IsValidPutRequest(req)){
        res.status(400).send({
            statusCode: 400,
            description: "Bad request. Must add value for key, and key expiration date."
        });
        
        return;
    }

    const key: string = req.params.key;
    const value: string = req.body.value;
    const expirationDate: number = req.body.expirationDate;

    // get cache server.
    const serverIp: string | null | undefined = cacheManager.GetServerFromKey(key);

    if(serverIp === undefined || serverIp === null){
        res.status(500).send({
            statusCode: 500,
            description: "Internal Server Error. Consistent hashing broke."
        });

        return;
    }

    await serversClient.putDataAsync(serverIp, key, value, expirationDate);
    
    res.status(201).send({
        statusCode: 201,
        description: `Created. For key ${key}, inserted value ${value}`
    });
});

app.get("/:key", async (req, res) => {
    const key: string = req.params.key;
    const serverIp: string | null | undefined = cacheManager.GetServerFromKey(key);

    if(serverIp === undefined || serverIp == null){
        res.status(500).send({
            statusCode: 500,
            description: "Internal Server Error. Consistent hashing broke."
        });

        return;
    }

    const value = await serversClient.getDataAsync(serverIp, key);

    if (value === null || value === undefined){
        console.log("not present.")
        res.status(404).send({
            statusCode: 404,
            description: `The requested resource was not found. No value found for key ${key}`
        });
        
        return;
    } 

    console.log("succeeded.");
    res.status(200).send({
        statusCode: 200, 
        description: `Ok. Retrieved value ${value} for key ${key}`,
        value: value
    });
});


// start the Express server
app.listen(port, () => {
    console.log(`cache server started at http://localhost:${port}`);
});


