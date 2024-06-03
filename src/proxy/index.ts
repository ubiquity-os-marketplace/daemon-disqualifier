import { handleIssueOpened } from "../handlers/issue-opened";
import { Context } from "../types/context";
import { EnvConfigType } from "../types/env-type";
import { SupportedEvents } from "../types/plugin-inputs";

export interface Result {
  status: "ok" | "failed" | "skipped";
  content?: string;
  reason?: string;
}

const callbacks: { [k in SupportedEvents]: (context: Context, env: EnvConfigType) => Result | Promise<Result> } = {
  issues() {
    return { status: "ok" };
  },
  pull_request() {
    return { status: "ok" };
  },
  "issues.opened": handleIssueOpened,
};

export const proxyCallbacks = new Proxy(callbacks, {
  get(target, prop: SupportedEvents) {
    if (!(prop in target)) {
      console.warn(`${prop} is not supported, skipping.`);
      return async () => ({ status: "skipped", reason: "unsupported_event" });
    }
    return target[prop].bind(target);
  },
});
