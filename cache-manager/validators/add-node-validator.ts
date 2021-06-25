/**
 * A class to validate rest api request payload.
 */
export class AddNodeRequestValidator {
    /**
     * @constructor
     */
    constructor() {}

    public IsValidPostAddNodeRequest(req: any): boolean {
        return !this._isUndefinedOrNull(req.body.newPrimaryNode) && !this._isUndefinedOrNull(req.body.serverIp);
    }

    private _isUndefinedOrNull(param: any) {
	    return typeof param === 'undefined' || param === null;
    }
}