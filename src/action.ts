export type HandleError = "action-not-found" | "unknown";

export type Request<ACTION extends string, ARGS extends any[]> = { action: ACTION; args?: ARGS };
export type Response<DATA, ERROR> = { data: DATA; error?: never } | { data?: never; error: ERROR };
export type Action<CTX, ARGS extends any[], DATA, ERROR> = (
  context: CTX,
  ...args: ARGS
) => Response<DATA, ERROR> | Promise<Response<DATA, ERROR>>;

export type Create<CTX> = <ARGS extends any[], DATA, ERROR>(
  action: Action<CTX, ARGS, DATA, ERROR>
) => Action<CTX, ARGS, DATA, ERROR>;

export function init<CTX>(): Create<CTX> {
  return function create<ARGS extends any[], DATA, ERROR>(
    action: Action<CTX, ARGS, DATA, ERROR>
  ): Action<CTX, ARGS, DATA, ERROR> {
    return action;
  };
}
export function success<DATA>(data: DATA): { data: DATA } {
  return { data };
}
export function error<ERROR>(error: ERROR): { error: ERROR } {
  return { error };
}

function create<CTX, ARGS extends any[], DATA, ERROR = undefined>(
  action: Action<CTX, ARGS, DATA, ERROR>
): Action<CTX, ARGS, DATA, ERROR> {
  return action;
}

export async function handle<ACTIONS extends Record<string, Action<any, any[], any, any>>>(
  request: Request<any, any>,
  actions: ACTIONS,
  context: Omit<
    {
      [K in keyof ACTIONS as ACTIONS[K] extends Action<infer CTX, any[], any, any>
        ? CTX extends undefined | never | null
          ? never
          : `${K & string}Context`
        : never]: ACTIONS[K] extends Action<infer CTX, any[], any, any> ? CTX : never;
    },
    never
  >
): Promise<Response<any, HandleError>> {
  const action = actions[request.action];
  try {
    return action ? await action(context, ...request.args) : error("action-not-found");
  } catch {
    return error("unknown");
  }
}

//////////////////////// TEST ///////////////////////
const s = create((ctx: {}, name: string, age: number) => ({ data: "" }));

export function addUser(context: { auth: boolean }, name: string, age: number): Response<number, Error> {
  if (age > 20) return success(1);

  return error(new Error());
}
export function deleteUser(context: null, id: number): Response<number, "user not found"> {
  if (id > 20) return success(id);

  return error("user not found");
}

const actions = { addUser, deleteUser };

export type Actions = typeof actions;

handle({ action: "", args: [] }, actions, { addUserContext: { auth: true } });
