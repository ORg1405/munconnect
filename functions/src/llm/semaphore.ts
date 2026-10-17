// Semáforo simples (por instância) para limitar chamadas simultâneas ao LLM.

export class SemaphoreTimeoutError extends Error {
  constructor() {
    super("Fila de chamadas ao modelo cheia");
    this.name = "SemaphoreTimeoutError";
  }
}

export class Semaphore {
  private active = 0;
  private readonly waiters: Array<{ resolve: () => void; timer: NodeJS.Timeout | null }> = [];

  constructor(private readonly max: number) {}

  get inUse(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiters.length;
  }

  async acquire(timeoutMs?: number): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return this.releaser();
    }
    await new Promise<void>((resolve, reject) => {
      const waiter = { resolve, timer: null as NodeJS.Timeout | null };
      if (timeoutMs !== undefined) {
        waiter.timer = setTimeout(() => {
          const i = this.waiters.indexOf(waiter);
          if (i >= 0) this.waiters.splice(i, 1);
          reject(new SemaphoreTimeoutError());
        }, timeoutMs);
      }
      this.waiters.push(waiter);
    });
    // A vaga foi transferida diretamente por quem liberou (active não muda).
    return this.releaser();
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) {
        if (next.timer) clearTimeout(next.timer);
        next.resolve();
      } else {
        this.active--;
      }
    };
  }
}
