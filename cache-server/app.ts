import express from "express";
import { PutRequestValidator } from "./request-validator";
import { InMemoryCache, ExpiringValue } from "./in-memory-cache";
import { HealthReporter } from "./health-reporter";
import { promisify } from "bluebird";
import { readFile } from "fs";
import { Maybe, MaybeType } from "./maybe"
import { Ok, Bad, NotFound, Created } from "./http-statuses";

const readFileAsync = promisify(readFile);
let healthReporter: HealthReporter;

const putValidator = new PutRequestValidator();
const cache = new InMemoryCache();

const app = express();
const port = 5000;

// add json and urlencoded parsing middleware.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.put("/:key", (req, res) => {
    if(!putValidator.IsValidPutRequest(req)){
        res.status(Bad).send({
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

    res.status(Created).send({
        description: `Created. For key ${key}, inserted value ${value}`
    });
});

app.get("/:key", (req, res) => {
    const key: string = req.params.key;
    const value: Maybe<ExpiringValue> = cache.Get(key);

    if (value.type === MaybeType.Nothing){
        res.status(NotFound).send({
            description: `The requested resource was not found. No value found for key ${key}`
        });
        
        return;
    } 

    if(value.value.expirationDate - Date.now() < 0){
        cache.Delete(key);
        res.status(NotFound).send({
            description: `The requested resource was not found. No value found for key ${key}`
        });
        
        return;
    }

    res.status(Ok).send({
        description: `Ok. Retrieved value ${value.value} for key ${key}`,
        value: value.value
    });
});

function reportHealth() {
    healthReporter.reportHealth();
}

const ipFilePath = __dirname + "/ipconfig.txt";
readFileAsync(ipFilePath).then(ip => {
    console.log(ip.toString());
    healthReporter = new HealthReporter(ip.toString());
    setInterval(reportHealth, 5000);
    // start the Express server
    app.listen(port, () => {
        console.log(`cache server started at http://localhost:${port}`);
    });
});








