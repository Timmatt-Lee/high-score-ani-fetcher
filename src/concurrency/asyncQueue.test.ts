import { describe, it, expect } from "vitest";
import { AsyncQueue } from "./asyncQueue";

describe("AsyncQueue", () => {
  it("resolves next synchronously when elements are available", async () => {
    const queue = new AsyncQueue<number>();
    queue.push(10);
    queue.push(20);

    const first = await queue.next();
    const second = await queue.next();

    expect(first).toBe(10);
    expect(second).toBe(20);
  });

  it("resolves next asynchronously when elements are pushed later", async () => {
    const queue = new AsyncQueue<string>();
    const promise = queue.next();

    queue.push("hello");
    const result = await promise;

    expect(result).toBe("hello");
  });

  it("resolves with undefined immediately if closed and empty", async () => {
    const queue = new AsyncQueue<number>();
    queue.close();

    const result = await queue.next();
    expect(result).toBeUndefined();
  });

  it("resolves active waiters with undefined when closed", async () => {
    const queue = new AsyncQueue<boolean>();
    const promise1 = queue.next();
    const promise2 = queue.next();

    queue.close();

    const res1 = await promise1;
    const res2 = await promise2;

    expect(res1).toBeUndefined();
    expect(res2).toBeUndefined();
  });

  it("resolves multiple waiters sequentially in FIFO order", async () => {
    const queue = new AsyncQueue<string>();
    const promise1 = queue.next();
    const promise2 = queue.next();

    queue.push("first");
    queue.push("second");

    expect(await promise1).toBe("first");
    expect(await promise2).toBe("second");
  });
});
