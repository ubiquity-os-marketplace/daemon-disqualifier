import { handleIssueOpened } from "../handlers/issue-opened";
import { EnvConfigType } from "../types/env-type";
import { PluginInputs, SupportedEvents } from "../types/plugin-inputs";

export interface Result {
  status: "ok" | "failed" | "skipped";
  content?: string;
  reason?: string;
}

const callbacks: { [k in SupportedEvents]: (inputs: PluginInputs, env: EnvConfigType) => Result } = {
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
    if (!Object.keys(target).includes(prop)) {
      console.warn(`${prop} is not supported, skipping.`);
      return { status: "skipped", reason: "unsupported_event" };
    }
    return target[prop].bind(target);
  },
});
