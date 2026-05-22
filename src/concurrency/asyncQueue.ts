/**
 * AsyncQueue is a promise-resolving non-blocking FIFO queue
 * designed for producer-consumer concurrent workflows.
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private waiters: ((value: T | undefined) => void)[] = [];
  private isClosed = false;

  /**
   * Pushes an item into the queue. If there are pending consumers waiting
   * for an item, the item is immediately dispatched to the oldest consumer.
   */
  push(item: T): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(item);
    } else {
      this.queue.push(item);
    }
  }

  /**
   * Retrieves the next item from the queue. If the queue is empty:
   * - If closed, resolves immediately with `undefined`.
   * - Otherwise, returns a promise that resolves when a new item is pushed
   *   or when the queue is closed.
   *
   * NOTE ON DESIGN CHOICE:
   * We return `T | undefined` and use `undefined` as the EOF (End-Of-File/Queue) signal.
   * Alternative approaches were considered:
   * 1. Rejecting the pending promises: Thrown exceptions for normal workflow termination
   *    is an anti-pattern (control flow via exceptions) and risks uncaught rejection crashes.
   * 2. Using a Symbol sentinel value: Provides strict ambiguity resolution if T could contain
   *    undefined. However, since T (AnimeItem) is a non-null object type, returning `undefined`
   *    avoids redundant imports and provides a simpler, idiomatic TypeScript developer experience.
   */
  async next(): Promise<T | undefined> {
    if (this.queue.length > 0) {
      return this.queue.shift();
    }
    if (this.isClosed) {
      return undefined;
    }
    return new Promise<T | undefined>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * Closes the queue. All current/future consumers waiting for elements
   * are immediately resolved with `undefined`.
   */
  close(): void {
    this.isClosed = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(undefined);
    }
  }
}
