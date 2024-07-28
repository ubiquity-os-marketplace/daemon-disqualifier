import { handleIssueAssigned } from "../handlers/issue-assigned";
import { handleIssueClosed } from "../handlers/issue-closed";
import { handleIssueUnassigned } from "../handlers/issue-unassigned";
import { Context } from "../types/context";
import { SupportedEvents } from "../types/plugin-inputs";

export interface Result {
  status: "ok" | "failed" | "skipped";
  content?: string;
  reason?: string;
}

const callbacks: { [k in SupportedEvents]: (context: Context) => Result | Promise<Result> } = {
  "issues.closed": handleIssueClosed,
  "issues.assigned": handleIssueAssigned,
  "issues.unassigned": handleIssueUnassigned,
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
