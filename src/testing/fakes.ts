import type { Clock, IdGenerator, RandomSource } from "../ports";

export class FakeClock implements Clock {
  private current: number;
  private callbacks = new Set<() => void>();

  constructor(now = 0) {
    this.current = now;
  }

  now(): number {
    return this.current;
  }

  every(_intervalMs: number, callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  advanceBy(milliseconds: number): void {
    this.current += milliseconds;
    for (const callback of this.callbacks) callback();
  }
}

export class PredictableIdGenerator implements IdGenerator {
  private count = 0;

  next(prefix: string): string {
    this.count += 1;
    return `${prefix}-${this.count}`;
  }
}

export class SeededRandom implements RandomSource {
  private seed: number;

  constructor(seed = 42) {
    this.seed = seed >>> 0;
  }

  private next(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x1_0000_0000;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(this.next() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  every(intervalMs: number, callback: () => void): () => void {
    const handle = window.setInterval(callback, intervalMs);
    return () => window.clearInterval(handle);
  }
}

export class SystemIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
}

export class SystemRandom implements RandomSource {
  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }
}

