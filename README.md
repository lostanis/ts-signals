# ts-signal

A lightweight, strongly-typed signal / event system for TypeScript with **mandatory context binding, one-time handlers, and grouped removal by owner.**

Designed for **OOP-style lifecycle-driven code**, not for reactive streams or global event buses.


## Installation

```bash
npm install ts-signals
```


## Why ts-signal?

ts-signal exists to solve a specific problem:

_Managing event subscriptions in object-oriented code without losing track of ownership, lifecycle, or cleanup._

### Intended use cases

* Game engines (PixiJS, Phaser, custom engines)
* UI systems with explicit object lifecycles
* Entity / component architectures
* Systems where __objects own their subscriptions__

### Explicit non-goals

This library is __not__ intended to replace:
* RxJS (no streams, operators, async composition)
* Node.js EventEmitter (no string-based events)
* Global pub/sub or message buses
* React-style functional event handling

If you need functional, stateless, or reactive patterns — use a different tool.


## Core design principles

* __Context is mandatory__
    * Every handler is bound to an owner object
    * The same context is used as this and as a lifecycle key
* __Ownership over convenience__
    * Subscriptions are grouped by owner, not anonymous callbacks
* __Synchronous and predictable__
    * Handlers are executed synchronously, in subscription order
* __Explicit cleanup__
    * No automatic garbage collection of handlers
    * You must remove handlers or contexts explicitly

This is a deliberate trade-off in favor of clarity and control.


## Basic usage

```ts
import { Signal } from 'ts-signals';

class GameScene {
  onScore = new Signal<number>();

  setup(player: Player) {
    this.onScore.add(player.onScoreChanged, player);
  }

  teardown(player: Player) {
    // Remove one specific handler
    this.onScore.remove(player.onScoreChanged, player);

    // Or remove all handlers registered by player at once
    this.onScore.removeContext(player);
  }
}
```

## One-time handler

```ts
const onReady = new Signal<void>();

onReady.addOnce(scene.init, scene);
onReady.emit(); // scene.init fires once, then removed
onReady.emit(); // no output
```

## Unsubscribe via returned function

```ts
const off = signal.add(player.onDamage, player);

// later...
off(); // equivalent to signal.remove(player.onDamage, player)
```

## Using the handler type

```ts
import { Signal, SignalHandler } from 'ts-signals';

const onScore = new Signal<number>();

const handler: SignalHandler<number> = function (this: Player, score: number) {
  console.log(`${this.name} scored: ${score}`);
};

onScore.add(handler, player);
onScore.emit(42);
onScore.remove(handler, player);
```


## API

### `new Signal<T>()`

Creates a new signal.
* T — type of data passed to handlers
* Defaults to void


### `signal.add(handler, context): () => void`

Subscribe a handler.
* handler — (data: T) => void
* context — owner object

Used as:
* this binding when calling the handler
* grouping key for removeContext()
* Returns an unsubscribe function

Throws if handler is not a function.


### `signal.addOnce(handler, context): () => void`

Subscribe a handler that fires only once and is then removed.

Throws if handler is not a function.


### `signal.emit(data: T): void`

Emit the signal.
* Regular handlers fire first, followed by one-time handlers
* Handlers are executed synchronously
* Execution order:
  * insertion order per context
  * no guaranteed ordering across different contexts
* Exceptions are not caught internally


### `signal.remove(handler, context): void`

Remove a specific handler.
The same context must be provided.


### `signal.removeContext(context): void`

Remove all handlers registered under a context.

This is the primary cleanup mechanism and should be called when an object is destroyed.


### `signal.removeAll(): void`

Remove all handlers (regular and one-time).


### `signal.has(handler, context): boolean`

Returns `true` if the given handler is currently subscribed under the given context (regular or one-time).

```ts
signal.add(player.onDamage, player);
signal.has(player.onDamage, player); // true
signal.remove(player.onDamage, player);
signal.has(player.onDamage, player); // false
```


### `signal.hasContext(context): boolean`

Returns `true` if there are any handlers (regular or one-time) registered under the given context.

```ts
signal.add(player.onDamage, player);
signal.hasContext(player); // true
signal.removeContext(player);
signal.hasContext(player); // false
```


### `signal.contexts(): Iterable<object>`

Returns an iterable of all unique context objects that currently have at least one registered handler. The returned snapshot is not live.

```ts
signal.add(player.onDamage, player);
signal.add(enemy.onDamage, enemy);
for (const ctx of signal.contexts()) { ... } // player, enemy
```


### `signal.listenerCount(): number`

Returns the total number of active handlers (regular + one-time).
Useful for debugging and leak detection.


### `signal.listenerCountFor(context): number`

Returns the number of handlers (regular + one-time) registered under a specific context.

```ts
signal.add(player.onDamage, player);
signal.addOnce(player.onReady, player);
signal.listenerCountFor(player); // 2
```


## Memory & lifecycle model

`ts-signal` uses strong references to contexts. This enables:
* explicit ownership
* predictable cleanup
* debugging and introspection

As a result, handlers are __not automatically garbage-collected.__
Objects that subscribe to signals are expected to explicitly remove their handlers or call `removeContext()` as part of their lifecycle.

This mirrors the behavior of DOM events and other ownership-based systems and is a deliberate trade-off in favor of control and debuggability.


License

MIT
