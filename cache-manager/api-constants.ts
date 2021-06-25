export const CInvalidAddNodeBadRequest = "Bad request. Must add serverIp field.";
export const CAddedPrimaryServerOk = "Ok. Added primary server to new pool.";
export const CAddedServerToExistingPoolOk = "Ok. Added new server to an existing server pool.";
export const CServerPoolEmptyBadRequest = "Bad request. There are no primary nodes in the cluster. If you wish to add one, please set the newPrimaryNode flag to true.";
export const CInvalidPutBadRequest = "Bad request. Must add value for key, and key expiration date.";
export const CEmptyHashRingInternalSerErr = "There are currently no cache servers connected to any server pool. Please use POST /addNode to connect a new server.";
export const CPutOk = "Created. A new key value pair has been saved in the cache.";
export const CGetNotFound = "The requested resource was not found for the provided key.";
export const CGetOk = "Ok. Successfully retrieved value for provided key, from cache server.";