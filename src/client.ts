import { Stream, filter, map } from "@soffinal/stream";
import type { Action } from "./action.ts";

export type Client<ACTIONS extends Record<string, Action<any, any, any, any>>> = {
  [K in keyof ACTIONS]: Client.ActionObject<ACTIONS[K]>;
} & {
  responses: Stream<
    {
      [K in keyof ACTIONS]: ACTIONS[K] extends Action<any, any, infer DATA, infer ERROR>
        ? Client.ActionResponse<K, DATA, ERROR>
        : never;
    }[keyof ACTIONS]
  >;
  error: Stream<
    {
      [K in keyof ACTIONS]: ACTIONS[K] extends Action<any, any, any, infer ERROR>
        ? Required<Omit<Client.ActionResponse<K, any, ERROR>, "data">>
        : never;
    }[keyof ACTIONS]
  >;
  data: Stream<
    {
      [K in keyof ACTIONS]: ACTIONS[K] extends Action<any, any, infer DATA, any>
        ? Required<Omit<Client.ActionResponse<K, DATA, any>, "error">>
        : never;
    }[keyof ACTIONS]
  >;
};

export namespace Client {
  export type ActionObject<T extends Action<any, any, any, any>> = T extends Action<
    any,
    infer ARGS,
    infer DATA,
    infer ERROR
  >
    ? {
        (...args: ARGS): Promise<Action.Response<DATA, ERROR>>;
        data: Stream<DATA>;
        error: Stream<ERROR>;
      }
    : never;

  export type ActionResponse<ACTION_NAME, DATA, ERROR> = Action.Response<DATA, ERROR> & { actionName: ACTION_NAME };

  /**
   * Create a type-safe RPC client with reactive stream-based response handling.
   *
   * @template ACTIONS - Server actions type (import from server)
   * @param send - Transport function that sends requests and returns responses
   * @returns Proxy object with typed action methods and reactive streams
   *
   * @example
   * // Import server actions type
   * import type { Actions } from './server/actions';
   *
   * // Create client with transport
   * const client = Client.create<Actions>(transport);
   *
   * // Use as function with perfect type inference
   * const result = await client.addUser('John', 25);
   *
   * // Use as reactive streams
   * client.addUser.data.listen((userId) => console.log('User created:', userId));
   * client.addUser.error.listen((error) => console.error('Failed:', error));
   *
   * // Global response monitoring
   * client.responses.listen((response) => {
   *   console.log(`Action ${response.actionName}:`, response);
   * });
   *
   * @example
   * // 📦 COPY-PASTE TRANSPORT: HTTP Fetch
   * const httpTransport = (url: string) => async (request: Action.Request<any, any>) => {
   *   const response = await fetch(url, {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify(request)
   *   });
   *   return response.json();
   * };
   *
   * const client = Client.create<Actions>(httpTransport('/api/rpc'));
   *
   * @example
   * // 📦 COPY-PASTE TRANSPORT: WebSocket
   * const wsTransport = (ws: WebSocket) => (request: Action.Request<any, any>) => {
   *   return new Promise((resolve) => {
   *     const id = Math.random().toString(36);
   *     const handler = (event: MessageEvent) => {
   *       const { requestId, response } = JSON.parse(event.data);
   *       if (requestId === id) {
   *         ws.removeEventListener('message', handler);
   *         resolve(response);
   *       }
   *     };
   *     ws.addEventListener('message', handler);
   *     ws.send(JSON.stringify({ id, request }));
   *   });
   * };
   *
   * const client = Client.create<Actions>(wsTransport(websocket));
   *
   * @example
   * // 📦 COPY-PASTE TRANSPORT: Web Worker
   * const workerTransport = (worker: Worker) => (request: Action.Request<any, any>) => {
   *   return new Promise((resolve) => {
   *     const handler = (event: MessageEvent) => {
   *       worker.removeEventListener('message', handler);
   *       resolve(event.data);
   *     };
   *     worker.addEventListener('message', handler);
   *     worker.postMessage(request);
   *   });
   * };
   *
   * const client = Client.create<Actions>(workerTransport(myWorker));
   *
   * @example
   * // 📦 COPY-PASTE TRANSPORT: Service Worker
   * const serviceWorkerTransport = () => (request: Action.Request<any, any>) => {
   *   const channel = new MessageChannel();
   *   return new Promise((resolve) => {
   *     channel.port1.onmessage = (event) => resolve(event.data);
   *     navigator.serviceWorker.controller?.postMessage(request, [channel.port2]);
   *   });
   * };
   *
   * const client = Client.create<Actions>(serviceWorkerTransport());
   *
   * @example
   * // 📦 COPY-PASTE TRANSPORT: Node.js Worker Threads
   * import { Worker } from 'worker_threads';
   *
   * const workerThreadTransport = (worker: Worker) => (request: Action.Request<any, any>) => {
   *   return new Promise((resolve) => {
   *     const handler = (response: any) => {
   *       worker.off('message', handler);
   *       resolve(response);
   *     };
   *     worker.on('message', handler);
   *     worker.postMessage(request);
   *   });
   * };
   *
   * const client = Client.create<Actions>(workerThreadTransport(worker));
   *
   * @example
   * // 📦 COPY-PASTE TRANSPORT: Socket.io
   * import { io } from 'socket.io-client';
   *
   * const socketTransport = (socket: Socket) => (request: Action.Request<any, any>) => {
   *   return new Promise((resolve) => {
   *     const id = Math.random().toString(36);
   *     socket.once(`response:${id}`, resolve);
   *     socket.emit('rpc', { id, request });
   *   });
   * };
   *
   * const client = Client.create<Actions>(socketTransport(socket));
   */
  export function create<ACTIONS extends Record<string, Action<any, any, any, any>>>(
    send: (request: Action.Request<any, any>) => Action.Response<any, any> | Promise<Action.Response<any, any>>
  ): Client<ACTIONS> {
    const responses = new Stream<ActionResponse<any, any, any>>();
    const actionObjects = new Map<string, any>();

    const error = responses
      .pipe(filter({}, (_, response) => [response.error, {}]))
      .pipe(map({}, (_, { data, ...rest }) => [rest, {}]));

    const data = responses
      .pipe(filter({}, (_, response) => [!response.error, {}]))
      .pipe(map({}, (_, { error, ...rest }) => [rest, {}]));

    const proxy = new Proxy({} as any, {
      get(target, prop: string) {
        if (prop === "responses") return responses;
        if (prop === "error") return error;
        if (prop === "data") return data;

        // Get or create action object
        if (!actionObjects.has(prop)) {
          // Create success and error streams for this action
          const data = responses
            .pipe(filter({}, (_, response) => [!response.error && response.actionName === prop, {}]))
            .pipe(map({}, (_, response) => [response.data, {}]));

          const error = responses
            .pipe(filter({}, (_, response) => [response.error && response.actionName === prop, {}]))
            .pipe(map({}, (_, response) => [response.error, {}]));

          // Create callable function
          const actionFunction = async (...args: any[]) => {
            const request: Action.Request<string, any[]> = { action: prop, args };
            const response = await send(request);

            // Push response with action name
            responses.push({ ...response, actionName: prop });

            return response;
          };

          // Attach streams as properties
          actionFunction.data = data;
          actionFunction.error = error;

          actionObjects.set(prop, actionFunction);
        }

        return actionObjects.get(prop);
      },
    });

    return proxy;
  }
}
