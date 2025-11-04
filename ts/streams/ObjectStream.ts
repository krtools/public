import {PassThrough, TransformOptions} from 'node:stream';

export class ObjectStream extends PassThrough {
  private _resume?: () => unknown;

  /** Specify at least {highWaterMark} (number of objects) */
  constructor(options?: TransformOptions) {
    super({...options, objectMode: true});
  }

  _read() {
    if (this._resume) {
      this._resume();
      this._resume = undefined;
    }
  }

  /** Wait until a read occurs to allow resumption of pushing */
  async wait() {
    if (this._resume) throw new Error('already waiting');

    const {resolve, promise} = Promise.withResolvers<void>();
    this._resume = resolve;
    return promise;
  }
}
