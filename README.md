<!-- PROJECT LOGO -->
<br />

<p align="center">
  <h3 align="center">aws-dist-cache</h3>

  <p align="center">
    An in memory implementation of distributed cache (consistent hashing) built using AWS.
    <br />
  </p>
</p>


<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary><h2 style="display: inline-block">Table of Contents</h2></summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#setup-for-development">Setup for Development</a></li>
        <li><a href="#setup-for-deployment">Setup for Deployment</a></li>
      </ul>
    </li>
    <li><a href="#deployment">Deployment</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributors">Contributors</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

This project implements a distributed cache system that is deployed to and run on `AWS`.

The implementation uses two distinct "server pools", each one hosts a scalable amount of servers, which persist the same key-value pairs
in an *in-memory* manner.

The `cache-server` project hosts the code for a single server which runs as part of a *pool*.
The `cache-manager` project hosts the code for the server which acts as a public gateway, exposing the necessary endpoints
to allow external interaction with the cache (more on this gateway later).

The `cache-manager` uses the `node-hashring` library of @3rd-Eden to consistently distribute the key-value pairs between server pools.

**The implementation holds the following traits:**

* It is resillient to a server crash (server pools host more than one server).
* Adding servers is allowed and supported. When a new node is added, it is simply appended to an existing server pool.


### Built With

* [Node.js (nodejs.org)](https://nodejs.org/en/)
* [TypeScript](https://www.typescriptlang.org/)
* [node-hashring](https://github.com/3rd-Eden/node-hashring)



<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

This is an example of how to list things you need to use the software and how to install them.
* node - Install from [here](https://nodejs.org/en/).
 make sure you get latest npm version.

### Setup for Development

<u>**This step is needed only if you intend develop / run the solution locally**</u>

1. Clone the repo
   ```sh
   git clone https://github.com/RonGissin/aws-dist-cache.git
   ```
2. Install TypeScript globally
   ```sh
   npm install typescript -g
   ```
3. cd into cache-manager directory 
   ```sh
   cd cache-manager
   ```
4. Install NPM packages
   ```sh
   npm install
   ```
5. cd into cache-server directory 
   ```sh
   cd cache-server
   ```
6. Install NPM packages
   ```sh
   npm install
   ```
6. While inside cache-server or cache-manager dirs, run the following to start the server.
   ```sh
   npm run build
   npm run start
   ```
### Setup for Deployment

<u>**This step is needed only if you intend to deploy the solution to AWS EC2 instances**</u>

1. Install **jq** (needed for deployment script json de/serialization)
   ```sh
   chocolatey install jq
   ```
2. Confirm you have the **AWS CLI** installed, otherwise - download [here](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-windows.html).
   ```sh
   aws --version
   ```
3. Configure the cli according to your credentials 
   ```sh
   aws configure
   ```

**Now you are good to go !**
Run `./setup.sh` in order to deploy the solution to your AWS environment. 
See [Deployment](#deployment) to learn more about the different deployment scripts.


<!-- DEPLOYMENT EXAMPLES -->
## Deployment
In this section we explain how to deploy the solution to an AWS environment using the provided bash scripts.

### Deployment Scripts

1. `./setup.sh` - This is the main bootstrap script that deploys and runs the solution on top of AWS.
   Here is a summary of what it does:
   * Creates a dynamoDB table named **"CacheServers"**.
   * Deploys an EC2 instance and configures it to run the `cache-manager` project.
   * Deploys 4 EC2 instances, each running the `cache-server` project.
     The servers are distributed to two distinct pools, 2 servers in each pool.
     *The script connects the cache servers to the gateway servers using the /addNode endpoint (see in code).*
   * **NOTE:** The script creates the necessary pem files, as well as deploy the instances with the required roles, 
     to allow for credential security during deployment.
2. `./node-deploy.sh` - This script deploys a new EC2 instance as a `cache-server` and appends it to an existing pool.
   * **NOTE:** This script has one **required** parameter which is the ip of the gateway server (the one running the `cache-manager` proj)
   * **ANOTHER NOTE:** When adding a new node, the system automatically appends it to the smallest pool out of the two pools
     in order to provide better distribution.

## Usage

In this section we explain the different endpoints that the cache gateway server exposes.

### Endpoints

#### 1. Get value by key
```http
   GET /{key}
```



#### 2. Put key value pair
```http
   PUT /{key}
```

Must contain following fields in json payload
```json
   {
   	"value": <value: string>,
   	"expirationDate": <date: number>
   }
```



#### 3. Add new node to server pool
**This endpoint should not be accessed directly to avoid misconfiguration,**
**It is accessed programmatically in the `./node-deploy.sh` script after configuring the EC2 correctly.**
**Please refrain from using this endpoint directly unless you have built a different extending solution.**

```http
   POST /addNode
```

Must contain following fields in json payload
```json
   {
   	"newPrimaryNode": <isNewPrimaryNode: bool>,
   	"serverIp": <newServerIp: string>
   }
```




<!-- ACKNOWLEDGEMENTS -->
## Contributors

* [RonGissin (Ron Gissin) (github.com)](https://github.com/RonGissin)
* [noamisachar (Noam Isachar) (github.com)](https://github.com/NoamIsachar)

