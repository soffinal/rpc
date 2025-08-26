/**
 * Type definition for RPC actions with context, arguments, and response types.
 *
 * @template CTX - Context type required by this action (use `undefined` if no context needed)
 * @template ARGS - Array of argument types for this action
 * @template DATA - Success response data type
 * @template ERROR - Error response type
 */
export type Action<CTX, ARGS extends any[], DATA, ERROR> = (
  context: CTX,
  ...args: ARGS
) => Action.Response<DATA, ERROR> | void | Promise<Action.Response<DATA, ERROR> | void>;

export namespace Action {
  /**
   * Error types that can be returned by Action.handle when processing fails.
   */
  export type HandleError = "action-not-found" | "unknown";

  /**
   * RPC request structure with action name and arguments.
   *
   * @template ACTION - Action name as string literal
   * @template ARGS - Array of argument types
   */
  export type Request<ACTION extends string, ARGS extends any[]> = { action: ACTION; args?: ARGS };
  
  /**
   * RPC response structure as discriminated union of success or error.
   *
   * @template DATA - Success response data type
   * @template ERROR - Error response type
   */
  export type Response<DATA, ERROR> = { data: DATA; error?: never } | { data?: never; error: ERROR };

  /**
   * Create a success response with data.
   *
   * @template DATA - Type of the success data
   * @param data - The success data to return
   * @returns Success response object
   *
   * @example
   * return Action.success({ id: 123, name: 'John' });
   * return Action.success('Operation completed');
   * return Action.success([1, 2, 3]);
   */
  export function success<DATA>(data: DATA): { data: DATA } {
    return { data };
  }

  /**
   * Create an error response with error information.
   *
   * @template ERROR - Type of the error data
   * @param error - The error information to return
   * @returns Error response object
   *
   * @example
   * return Action.error('User not found');
   * return Action.error({ code: 404, message: 'Not found' });
   */
  export function error<ERROR>(error: ERROR): { error: ERROR } {
    return { error };
  }

  /**
   * Create a type-safe RPC action with context, arguments, and response types.
   *
   * @template CTX - Context type required by this action (use `undefined` if no context needed)
   * @template ARGS - Array of argument types for this action
   * @template DATA - Success response data type
   * @template ERROR - Error response type (optional, defaults to `undefined`)
   *
   * @param action - Action function that processes the request
   * @returns Typed action function for use in action registry
   *
   * @example
   * // Action without context
   * const getPublicData = Action.create((ctx: undefined, id: string) => {
   *   return Action.success({ id, name: 'Public Data' });
   * });
   *
   * @example
   * // Action with authentication context
   * const getUserProfile = Action.create((ctx: { userId: string }, profileId: string) => {
   *   if (ctx.userId !== profileId) {
   *     return Action.error('Unauthorized');
   *   }
   *   return Action.success({ id: profileId, name: 'John Doe' });
   * });
   *
   * @example
   * // Action with complex validation
   * const createUser = Action.create((ctx: { isAdmin: boolean }, name: string, age: number) => {
   *   if (!ctx.isAdmin) {
   *     return Action.error('Admin required');
   *   }
   *   if (name.length < 2) {
   *     return Action.error('Name too short');
   *   }
   *   if (age < 18) {
   *     return Action.error('Must be 18 or older');
   *   }
   *   return Action.success({ id: Math.random(), name, age });
   * });
   *
   * @example
   * // Async action with database operations
   * const saveUser = Action.create(async (ctx: { db: Database }, user: User) => {
   *   try {
   *     const savedUser = await ctx.db.users.create(user);
   *     return Action.success(savedUser);
   *   } catch (error) {
   *     return Action.error('Database error');
   *   }
   * });
   */
  export function create<CTX, ARGS extends any[], DATA, ERROR = undefined>(
    action: Action<CTX, ARGS, DATA, ERROR>
  ): Action<CTX, ARGS, DATA, ERROR> {
    return action;
  }

  /**
   * Handle RPC requests with type-safe action routing and context injection.
   *
   * @template ACTIONS - Record of action functions
   * @param request - RPC request with action name and arguments
   * @param actions - Registry of available actions
   * @param context - Context object with required contexts for actions that need them
   * @returns Promise resolving to action response or handle error
   *
   * @example
   * // Define actions
   * const actions = {
   *   getPublicData: Action.create((ctx: undefined, id: string) =>
   *     Action.success({ id, data: 'public' })
   *   ),
   *   getUserData: Action.create((ctx: { userId: string }, id: string) =>
   *     Action.success({ id, userId: ctx.userId })
   *   )
   * };
   *
   * // Handle request - TypeScript enforces required context
   * const response = await Action.handle(
   *   { action: 'getUserData', args: ['123'] },
   *   actions,
   *   { getUserDataContext: { userId: 'current-user' } }
   * );
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Express.js
   * import express from 'express';
   *
   * const app = express();
   * app.use(express.json());
   *
   * app.post('/rpc', async (req, res) => {
   *   const response = await Action.handle(req.body, actions, {
   *     getUserDataContext: { userId: req.user?.id },
   *     createUserContext: { isAdmin: req.user?.isAdmin || false }
   *   });
   *   res.json(response);
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Bun HTTP Server
   * const server = Bun.serve({
   *   port: 3000,
   *   async fetch(req) {
   *     if (req.method === 'POST' && new URL(req.url).pathname === '/rpc') {
   *       const request = await req.json();
   *       const response = await Action.handle(request, actions, {
   *         // Add your context here
   *       });
   *       return Response.json(response);
   *     }
   *     return new Response('Not Found', { status: 404 });
   *   }
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: WebSocket Server (ws)
   * import { WebSocketServer } from 'ws';
   *
   * const wss = new WebSocketServer({ port: 8080 });
   *
   * wss.on('connection', (ws) => {
   *   ws.on('message', async (data) => {
   *     const { id, request } = JSON.parse(data.toString());
   *     const response = await Action.handle(request, actions, {
   *       // Add your context here
   *     });
   *     ws.send(JSON.stringify({ requestId: id, response }));
   *   });
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Worker Thread
   * import { parentPort } from 'worker_threads';
   *
   * parentPort?.on('message', async (request) => {
   *   const response = await Action.handle(request, actions, {
   *     // Add your context here
   *   });
   *   parentPort?.postMessage(response);
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Hono
   * import { Hono } from 'hono';
   *
   * const app = new Hono();
   *
   * app.post('/rpc', async (c) => {
   *   const request = await c.req.json();
   *   const response = await Action.handle(request, actions, {
   *     // Add your context here using c.get(), etc.
   *   });
   *   return c.json(response);
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Elysia
   * import { Elysia } from 'elysia';
   *
   * const app = new Elysia()
   *   .post('/rpc', async ({ body }) => {
   *     const response = await Action.handle(body, actions, {
   *       // Add your context here
   *     });
   *     return response;
   *   });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Fastify
   * import Fastify from 'fastify';
   *
   * const fastify = Fastify();
   *
   * fastify.post('/rpc', async (request, reply) => {
   *   const response = await Action.handle(request.body, actions, {
   *     // Add your context here using request.user, etc.
   *   });
   *   return response;
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Cloudflare Workers
   * export default {
   *   async fetch(request: Request, env: Env, ctx: ExecutionContext) {
   *     if (request.method === 'POST') {
   *       const rpcRequest = await request.json();
   *       const response = await Action.handle(rpcRequest, actions, {
   *         // Add your context here using env, etc.
   *       });
   *       return Response.json(response);
   *     }
   *     return new Response('Not Found', { status: 404 });
   *   }
   * };
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Next.js API Route
   * import type { NextApiRequest, NextApiResponse } from 'next';
   *
   * export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   *   if (req.method === 'POST') {
   *     const response = await Action.handle(req.body, actions, {
   *       // Add your context here using req.session, etc.
   *     });
   *     res.json(response);
   *   } else {
   *     res.status(405).json({ error: 'Method not allowed' });
   *   }
   * }
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: SvelteKit
   * import type { RequestHandler } from './$types';
   *
   * export const POST: RequestHandler = async ({ request }) => {
   *   const body = await request.json();
   *   const response = await Action.handle(body, actions, {
   *     // Add your context here
   *   });
   *   return new Response(JSON.stringify(response));
   * };
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Remix
   * import type { ActionFunction } from '@remix-run/node';
   *
   * export const action: ActionFunction = async ({ request }) => {
   *   const body = await request.json();
   *   const response = await Action.handle(body, actions, {
   *     // Add your context here
   *   });
   *   return Response.json(response);
   * };
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Koa
   * import Koa from 'koa';
   * import Router from 'koa-router';
   *
   * const app = new Koa();
   * const router = new Router();
   *
   * router.post('/rpc', async (ctx) => {
   *   const response = await Action.handle(ctx.request.body, actions, {
   *     // Add your context here using ctx.state, etc.
   *   });
   *   ctx.body = response;
   * });
   *
   * @example
   * // 📦 COPY-PASTE INTEGRATION: Deno Fresh
   * import { Handlers } from '$fresh/server.ts';
   *
   * export const handler: Handlers = {
   *   async POST(req) {
   *     const body = await req.json();
   *     const response = await Action.handle(body, actions, {
   *       // Add your context here
   *     });
   *     return Response.json(response);
   *   }
   * };
   */
  export async function handle<ACTIONS extends Record<string, Action<any, any[], any, any>>>(
    request: any,
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
      if (!action) return error("action-not-found");

      const result = await action(context, ...request.args);

      if (!result) return success(undefined);

      return result;
    } catch {
      return error("unknown");
    }
  }
}
