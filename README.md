# @soffinal/rpc

[![npm version](https://badge.fury.io/js/@soffinal%2Frpc.svg)](https://badge.fury.io/js/@soffinal%2Frpc)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Universal Type-Safe RPC with Reactive Streams**

A groundbreaking RPC library that provides perfect type inference, universal transport support, and reactive stream-based response handling. Built for any boundary: HTTP, WebSocket, Workers, or any message-passing interface.

## Features

- 🎯 **Perfect Type Inference** - Zero configuration, complete IntelliSense
- 🌐 **Universal Transport** - HTTP, WebSocket, Workers, any message-passing boundary
- 📡 **Reactive Streams** - Stream-based response handling with per-action filtering
- 🔒 **Context-Aware** - Type-safe context injection per action
- 📚 **Documentation-as-Distribution** - Copy-paste transport integrations embedded in JSDoc, no separate packages needed. Hover over `Action.handle()` and `Client.create()` in your IDE to see all available integrations
- ⚡ **Zero Dependencies** - Lightweight with optional stream integration
- 🛠️ **Framework Agnostic** - Works with any server framework
- 📘 **Full TypeScript** - End-to-end type safety

## Quick Start

### Installation

```bash
npm install @soffinal/rpc
# or
bun add @soffinal/rpc
```

**Optional: Advanced Stream Transformations**

For advanced stream operations like `filter`, `map`, `merge`, and other reactive primitives:

```bash
npm install @soffinal/stream
# or
bun add @soffinal/stream
```

### Server Setup

```typescript
import { Action } from "@soffinal/rpc";

// Actions are simple functions that return Action.Response ( {data} | {error} )
function addUser(ctx: undefined, name: string, age: number) {
  if (name.length < 2) {
    return { error: "Name too short" as const };
  }
  if (age < 18) {
    return { error: "Must be 18 or older" as const };
  }
  return { data: { id: Math.random(), name, age } };
}

function getUserProfile(ctx: { userId: string }, profileId: string) {
  if (ctx.userId !== profileId) {
    return { error: "Unauthorized" as const };
  }
  return { data: { id: profileId, name: "John Doe" } };
}

// Or use Action.create helper for convenience
const addUser = Action.create((ctx: undefined, name: string, age: number) => {
  if (name.length < 2) {
    return Action.error("Name too short" as const);
  }
  if (age < 18) {
    return Action.error("Must be 18 or older" as const);
  }
  return Action.success({ id: Math.random(), name, age });
});

// Create action registry
const actions = { addUser, getUserProfile };
export type Actions = typeof actions;

// HTTP Server (Bun example)
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    // ... do the logic to get the contexts if needed

    const response = await Action.handle(await req.json(), actions, {
      getUserProfileContext: { userId: "current-user" },
    });
    return Response.json(response);
  },
});
```

### Client Setup

```typescript
import { Client } from "@soffinal/rpc";
import type { Actions } from "./server";

// Create client with HTTP transport
const client = Client.create<Actions>(async (request) => {
  const response = await fetch("http://localhost:3000/rpc", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return response.json();
});

// Use as functions with perfect type inference
const user = await client.addUser("John", 25);
//    ^ { data: { id: number, name: string, age: number } } | { error: "Name too short" | "Must be 18 or older" }

// Use as reactive streams
client.addUser.data.listen((user) => {
  //                         ^ { id: number, name: string, age: number }
  console.log("User created:", user);
});

client.addUser.error.listen((error) => {
  //                          ^ "Name too short" | "Must be 18 or older"
  console.error("Failed to create user:", error);
});

// Global response monitoring
client.responses.listen((response) => {
  //                      ^ { actionName: "addUser", data?: { id: number, name: string, age: number }, error?: "Name too short" | "Must be 18 or older" } | { actionName: "getUserProfile", data?: { id: string, name: string }, error?: "Unauthorized" }
  console.log(`Action ${response.actionName}:`, response);
});
```

## Core Concepts

### Actions

Actions are type-safe functions that define your RPC endpoints:

```typescript
// Raw action function
const myAction = (context: MyContext, arg1: string, arg2: number): Action.Response<MyData, MyError> => {
  // Your logic here
  if (success) {
    return { data: myData };
  } else {
    return { error: myError };
  }
};

// Or use Action.create helper
const myAction = Action.create((context: MyContext, arg1: string, arg2: number) => {
  // Your logic here
  if (success) {
    return Action.success(myData);
  } else {
    return Action.error(myError);
  }
});
```

### Context-Aware Type System

Actions can require specific context, enforced at compile time:

```typescript
// Action requiring authentication context
const authenticatedAction = Action.create((ctx: { userId: string }, data: any) => {
  return Action.success(`User ${ctx.userId} processed ${data}`);
});

// TypeScript enforces required context
await Action.handle(request, actions, {
  authenticatedActionContext: { userId: "user123" }, // Required!
});
```

### Reactive Streams

Every action becomes both a function and a reactive stream:

```typescript
// Call as function
const result = await client.myAction(arg1, arg2);

// Listen as stream
client.myAction.data.listen((data) => console.log("Success:", data));
//                          ^ MyData
client.myAction.error.listen((error) => console.log("Error:", error));
//                           ^ MyError

// Global streams
client.responses.listen((response) => {
  if (response.actionName === "myAction") {
    //  ^ TypeScript narrows to myAction response type
    // Handle specific action responses
  }
});
```

**Advanced Stream Transformations**

For complex reactive patterns, install `@soffinal/stream` for additional primitives:

```typescript
import { filter, map, merge } from "@soffinal/stream";

// Transform and filter responses
client.addUser.data
  .pipe(filter({}, (_, user) => [user.age > 21, {}]))
  //                   ^ { id: number, name: string, age: number }
  .pipe(map({}, (_, user) => [`Welcome ${user.name}!`, {}]))
  .listen((message) => console.log(message));
//       ^ string

// Centralized error handling with filtering
client.error
  .pipe(filter({}, (_, response) => [response.actionName === "addUser", {}]))
  .listen(({ error }) => showUserError(error));

// Merge multiple action streams
const allUserActions = client.addUser.data.pipe(merge(client.updateUser.data, client.deleteUser.data));
```

## Transport Integrations

The library includes copy-paste ready integrations for popular frameworks. **Hover over `Action.handle()` and `Client.create()` in your IDE** to see all available integrations:

### HTTP Frameworks

**Express.js:**

```typescript
app.post("/rpc", async (req, res) => {
  const response = await Action.handle(req.body, actions, {
    // Your context here
  });
  res.json(response);
});
```

**Next.js API Routes:**

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const response = await Action.handle(req.body, actions, {
      // Your context here
    });
    res.json(response);
  }
}
```

### WebSocket

**ws Library:**

```typescript
wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const { id, request } = JSON.parse(data.toString());
    const response = await Action.handle(request, actions, {});
    ws.send(JSON.stringify({ requestId: id, response }));
  });
});
```

### Workers

**Web Worker:**

```typescript
// Client
const client = Client.create<Actions>((request) => {
  return new Promise((resolve) => {
    const handler = (event) => {
      worker.removeEventListener("message", handler);
      resolve(event.data);
    };
    worker.addEventListener("message", handler);
    worker.postMessage(request);
  });
});

// Worker
self.onmessage = async (event) => {
  const response = await Action.handle(event.data, actions, {});
  self.postMessage(response);
};
```

**Node.js Worker Threads:**

```typescript
import { parentPort } from "worker_threads";

parentPort?.on("message", async (request) => {
  const response = await Action.handle(request, actions, {});
  parentPort?.postMessage(response);
});
```

## Advanced Examples

### Database Integration

```typescript
const createPost = Action.create(async (ctx: { db: Database; userId: string }, title: string, content: string) => {
  try {
    const post = await ctx.db.posts.create({
      title,
      content,
      authorId: ctx.userId,
    });
    return Action.success(post);
  } catch (error) {
    return Action.error("Database error");
  }
});
```

### Validation with Zod

```typescript
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
});

const createUser = Action.create((ctx: undefined, userData: unknown) => {
  const result = userSchema.safeParse(userData);
  if (!result.success) {
    return Action.error(result.error.issues);
  }

  return Action.success({ id: Math.random(), ...result.data });
});
```

## API Reference

### Action Namespace

- `Action.create<CTX, ARGS, DATA, ERROR>(fn)` - Create typed action
- `Action.handle(request, actions, context)` - Handle RPC requests
- `Action.success<DATA>(data)` - Create success response
- `Action.error<ERROR>(error)` - Create error response

### Client Namespace

- `Client.create<ACTIONS>(transport)` - Create typed client
- `client.actionName(...args)` - Call action as function
- `client.actionName.data` - Success stream for action
- `client.actionName.error` - Error stream for action
- `client.responses` - All responses stream
- `client.data` - All success responses stream
- `client.error` - All error responses stream

## Runtime Support

- **Node.js** 16+
- **Bun** 1.0+
- **Deno** 1.0+
- **Modern browsers** with ES2020+
- **Cloudflare Workers**
- **Vercel Edge Runtime**

## License

MIT © [Soffinal](https://github.com/soffinal)

## Contact

- **Author**: Soffinal
- **Email**: smari.sofiane@gmail.com
- **GitHub**: [@soffinal](https://github.com/soffinal)

---

<div align="center">
  <strong>Universal Type-Safe RPC for the Modern Web</strong>
</div>
