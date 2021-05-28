import express from "express";
import { PutRequestValidator } from "./request-validator";
import { InMemoryCache, ExpiringValue } from "./in-memory-cache";

const app = express();
const port = 5000;

const putValidator = new PutRequestValidator();
const cache = new InMemoryCache();

// add json and urlencoded parsing middleware.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.put("/:key", (req, res) => {
    if(!putValidator.IsValidPutRequest(req)){
        res.status(400).send({
            statusCode: 400,
            description: "Bad request. Must add value for key, and key expiration date."
        });
        
        return;
    }

    const key: string = req.params.key;
    const value: string = req.body.value;
    const expirationDate: string = req.body.expirationDate;

    cache.Put(key,
    { 
        value: value,
        expirationDate: parseInt(expirationDate)
    });

    res.status(201).send({
        statusCode: 201,
        description: `Created. For key ${key}, inserted value ${value}`
    });
});

app.get("/:key", (req, res) => {
    const key: string = req.params.key;
    const value: ExpiringValue | null | undefined = cache.Get(key);

    if (value === null || value === undefined){
        console.log("not present.")
        res.status(404).send({
            statusCode: 404,
            description: `The requested resource was not found. No value found for key ${key}`
        });
        
        return;
    } 

    if(value.expirationDate - Date.now() < 0){
        console.log(Date.now());
        console.log(value.expirationDate);
        console.log("expired.")
        cache.Delete(key);
        res.status(404).send({
            statusCode: 404,
            description: `The requested resource was not found. No value found for key ${key}`
        });
        
        return;
    }

    console.log("succeeded.");
    res.status(200).send({
        statusCode: 200, 
        description: `Ok. Retrieved value ${value.value} for key ${key}`,
        value: value
    });
});


// start the Express server
app.listen(port, () => {
    console.log(`cache server started at http://localhost:${port}`);
});


