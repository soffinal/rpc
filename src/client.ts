import { Stream, filter, map } from "@soffinal/stream";
import type { Request, Response, Action, Actions } from "./action.ts";

type ActionObject<T extends Action<any, any, any, any>> = T extends Action<any, infer ARGS, infer DATA, infer ERROR>
  ? {
      (...args: ARGS): Promise<Response<DATA, ERROR>>;
      data: Stream<DATA>;
      error: Stream<ERROR>;
    }
  : never;

type ResponseWithAction<DATA, ERROR> = Response<DATA, ERROR> & { actionName: string };
type ClientActions<ACTIONS extends Record<string, Action<any, any[], any, any>>> = {
  [K in keyof ACTIONS]: ActionObject<ACTIONS[K]>;
} & {
  responses: Stream<ResponseWithAction<any, any>>;
  error: Stream<{ actionName: string; error: any }>;
  data: Stream<{ actionName: string; data: any }>;
};

export interface Transport {
  send(request: Request<any, any>): Promise<Response<any, any>>;
}

export function createClient<ACTIONS extends Record<string, Action<any, any[], any, any>>>(
  transport: Transport
): ClientActions<ACTIONS> {
  const responses = new Stream<ResponseWithAction<any, any>>();
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
          const request: Request<string, any[]> = { action: prop, args };
          const response = await transport.send(request);

          // Push response with action name
          responses.push({ ...response, actionName: prop });

          const { data, error } = response;
          if (!error) {
            return data;
          } else {
            throw new Error(error);
          }
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

const client = createClient<Actions>(undefined as never);

client.data.listen((v) => {});
//                  ^?
