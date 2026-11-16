import { handleRequest } from "./api";
import { runSchedule } from "./schedule";
import type { Env } from "./types";

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
  scheduled(event: ScheduledEvent, env: Env, ctx: WorkerContext): Promise<void> {
    const now = Number.isFinite(event.scheduledTime) ? event.scheduledTime : Date.now();
    const done = runSchedule(env, now).then(() => undefined).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`push schedule failed: ${message}`);
    });
    ctx.waitUntil(done);
    return done;
  },
};

export default worker;
