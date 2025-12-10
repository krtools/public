import {wrap} from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import {Worker} from 'worker_threads';
import {ComlinkPool, BaseComlinkPoolOptions} from './ComlinkPool';

export interface NodeComlinkPoolOptions<T> extends BaseComlinkPoolOptions<T, Worker> {
  getWorker: () => Worker;
}

/** Convenience ComlinkPool specialized for node workers */
export class NodeComlinkPool<T> extends ComlinkPool<T, Worker> {
  constructor(options: NodeComlinkPoolOptions<T>) {
    const {getWorker, ...rest} = options;
    super({
      ...rest,
      adapter: {
        createEndpoint: () => options.getWorker(),
        terminate: (w) => w.terminate(),
        wrap: (ep) => wrap(nodeEndpoint(ep))
      }
    });
  }
}
