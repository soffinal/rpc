/**
 * @soffinal/rpc - Universal Type-Safe RPC with Reactive Streams
 *
 * A groundbreaking RPC library that provides perfect type inference,
 * universal transport support, and reactive stream-based response handling.
 *
 * @example
 * ```typescript
 * // Server
 * import { Action } from '@soffinal/rpc';
 *
 * const addUser = Action.create((ctx: undefined, name: string, age: number) => {
 *   if (age < 18) return Action.error('Must be 18 or older');
 *   return Action.success({ id: Math.random(), name, age });
 * });
 *
 * const actions = { addUser };
 * export type Actions = typeof actions
 *
 * // Client
 * import { Client } from '@soffinal/rpc';
 * import type { Actions } from './server';
 *
 * const client = Client.create<Actions>(httpTransport);
 * const user = await client.addUser('John', 25);
 * ```
 */

export * from "./action.ts";
export * from "./client.ts";
