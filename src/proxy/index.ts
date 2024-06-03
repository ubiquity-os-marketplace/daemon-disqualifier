import { SupportedEvents } from "../parser/payload";
import { EnvConfigType } from "../types/env-type";

export interface Result {
  status: "ok" | "failed" | "skipped";
  content?: string;
  reason?: string;
}

const callbacks: { [k in SupportedEvents]: (env: EnvConfigType) => Result } = {
  issues() {
    return { status: "ok" };
  },
  pull_request() {
    return { status: "ok" };
  },
  "issues.opened"() {
    console.log("issue created");
    return { status: "ok" };
  },
};

export const proxyCallbacks = new Proxy(callbacks, {
  get(target, prop: SupportedEvents): string {
    if (!Object.keys(target).includes(prop)) {
      console.warn(`${prop} is not supported, skipping.`);
      return JSON.stringify({ status: "skipped", reason: "unsupported_event" });
    }
    return JSON.stringify(target[prop].bind(target));
  },
});
