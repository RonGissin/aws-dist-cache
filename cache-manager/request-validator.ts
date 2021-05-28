/**
 * A class to validate rest api request payload.
 */
export class PutRequestValidator {
    /**
     * @constructor
     */
    constructor() {}

    public IsValidPutRequest(req: any): boolean {
        return !this._isUndefinedOrNull(req.body.value) && !this._isUndefinedOrNull(req.body.expirationDate);
    }

    private _isUndefinedOrNull(param: any) {
	    return typeof param === 'undefined' || param === null;
    }
}