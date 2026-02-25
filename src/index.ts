export type SignalHandler<T> = (data: T) => void;

export class Signal<T = void> {
	private _handlers: Map<object, Set<SignalHandler<T>>> = new Map();
	private _oneTimeHandlers: Map<object, Set<SignalHandler<T>>> = new Map();

	/**
	 * Subscribe a handler to this signal.
	 *
	 * @param handler - Function to call when the signal is emitted.
	 * @param context - The owner object of the handler. Used as the `this` binding and as a key for grouped removal via `removeContext()`.
	 * @returns An unsubscribe function that removes the handler when called.
	 *
	 * @example
	 * class Player {
	 *   onDamage(amount: number) { ... }
	 * }
	 * const player = new Player();
	 * const off = signal.add(player.onDamage, player);
	 * off(); // unsubscribe
	 */
	public add(handler: SignalHandler<T>, context: object): () => void {
		if (typeof handler !== "function") {
			throw new Error(`Handler must be a function`)
		}

		this._addHandler(this._handlers, handler, context);
		
		return () => this.remove(handler, context);
	}

	/**
	 * Subscribe a handler that fires only once, then automatically unsubscribes.
	 *
	 * @param handler - Function to call on the next emission.
	 * @param context - The owner object of the handler. Used as the `this` binding and as a key for grouped removal via `removeContext()`.
	 * @returns An unsubscribe function that removes the handler when called.
	 *
	 * @example
	 * signal.addOnce(player.onReady, player);
	 * signal.emit(data); // handler fires once, then removed
	 */
	public addOnce(handler: SignalHandler<T>, context: object): () => void {
		if (typeof handler !== "function") {
			throw new Error(`Handler must be a function`)
		}

		this._addHandler(this._oneTimeHandlers, handler, context);

		return () => this.remove(handler, context);
	}

	/**
	 * Emit the signal, calling all subscribed handlers with the provided data.
	 * Regular handlers fire first, followed by one-time handlers.
	 *
	 * @param data - The value to pass to each handler.
	 *
	 * @example
	 * signal.emit(42);
	 */
	public emit(data: T): void {
		// this._handlers.forEach((set, key) => {
		// 	set.forEach((handler) => {
		// 		handler.call(key, data);
		// 	});
		// });

        const entries = Array.from(this._handlers.entries());

        for (const [ctx, set] of entries) {
            for (const handler of Array.from(set)) {
                handler.call(ctx, data);
            }
        }

		// Swap out the Map before iterating so that any addOnce calls made
		// during emission are preserved for the next emit, not cleared here.
		const oneTime = this._oneTimeHandlers;

		this._oneTimeHandlers = new Map();
		oneTime.forEach((set, key) => {
			set.forEach((handler) => {
				handler.call(key, data);
			});
		});
	}

	/**
	 * Unsubscribe a specific handler from this signal.
	 *
	 * @param handler - The handler function to remove.
	 * @param context - The context originally passed to `add` or `addOnce`.
	 *
	 * @example
	 * signal.remove(player.onDamage, player);
	 */
	public remove(handler: SignalHandler<T>, context: object): void {
		this._removeHandler(this._handlers, handler, context);
		this._removeHandler(this._oneTimeHandlers, handler, context);
	}

	/**
	 * Remove all handlers registered under a given context object.
	 * Useful for cleaning up all subscriptions owned by a component or object
	 * when it is destroyed.
	 *
	 * @param context - The owner object whose handlers should all be removed.
	 *
	 * @example
	 * signal.add(player.onDamage, player);
	 * signal.add(player.onHeal, player);
	 * signal.removeContext(player); // removes both at once
	 */
	public removeContext(context: object): void {
		this._handlers.delete(context);
		this._oneTimeHandlers.delete(context);
	}

	/**
	 * Remove all subscribed handlers, including one-time handlers.
	 *
	 * @example
	 * signal.removeAll();
	 */
	public removeAll(): void {
		this._handlers.clear();
		this._oneTimeHandlers.clear();
	}

	/**
	 * Returns the total number of active handlers (regular + one-time).
	 * Useful for debugging and detecting memory leaks.
	 *
	 * @example
	 * signal.add(handler, ctx);
	 * signal.listenerCount(); // 1
	 */
	public listenerCount(): number {
		let count = 0;
		this._handlers.forEach((set) => (count += set.size));
		this._oneTimeHandlers.forEach((set) => (count += set.size));
		return count;
	}

	/**
	 * Returns `true` if there are any handlers registered under the given context.
	 *
	 * @param context - The owner object to check.
	 *
	 * @example
	 * signal.add(player.onDamage, player);
	 * signal.hasContext(player); // true
	 * signal.removeContext(player);
	 * signal.hasContext(player); // false
	 */
    public hasContext(context: object): boolean {
		return this._handlers.has(context) || this._oneTimeHandlers.has(context);
	}

	/**
	 * Returns an iterable of all unique context objects that currently have at least one registered handler.
	 * The returned snapshot is not live — it does not update as handlers are added or removed.
	 *
	 * @example
	 * signal.add(player.onDamage, player);
	 * signal.add(enemy.onDamage, enemy);
	 * for (const ctx of signal.contexts()) { ... } // player, enemy
	 */
    public contexts(): Iterable<object> {
		return new Set([
			...this._handlers.keys(),
			...this._oneTimeHandlers.keys()
		])
		
	}

	/**
	 * Returns `true` if the given handler is currently subscribed under the given context,
	 * either as a regular or one-time handler.
	 *
	 * @param handler - The handler function to look up.
	 * @param context - The context the handler was registered under.
	 *
	 * @example
	 * signal.add(player.onDamage, player);
	 * signal.has(player.onDamage, player); // true
	 * signal.remove(player.onDamage, player);
	 * signal.has(player.onDamage, player); // false
	 */
    public has(handler: SignalHandler<T>, context: object): boolean {
		return this._handlers.get(context)?.has(handler) || this._oneTimeHandlers.get(context)?.has(handler) || false;
	}

	/**
	 * Returns the number of handlers (regular + one-time) registered under a specific context.
	 *
	 * @param context - The owner object to count handlers for.
	 *
	 * @example
	 * signal.add(player.onDamage, player);
	 * signal.addOnce(player.onReady, player);
	 * signal.listenerCountFor(player); // 2
	 */
    public listenerCountFor(context: object): number {
		const handlersSize = this._handlers.get(context)?.size ?? 0;
		const oneTimeSize = this._oneTimeHandlers.get(context)?.size ?? 0;

		return handlersSize + oneTimeSize;
	}

	private _addHandler(target: Map<object, Set<SignalHandler<T>>>, handler: SignalHandler<T>, context: object): void {
		if (!target.has(context)) {
			target.set(context, new Set());
		}
		target.get(context)!.add(handler);
	}

	private _removeHandler(target: Map<object, Set<SignalHandler<T>>>, handler: SignalHandler<T>, context: object): void {
		if (target.has(context)) {
			target.get(context)!.delete(handler);

			if (target.get(context)!.size === 0) {
				target.delete(context);
			}
		}
	}
}
