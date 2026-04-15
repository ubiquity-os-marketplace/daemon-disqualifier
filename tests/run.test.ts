import { describe, expect, it, mock, spyOn } from "bun:test";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { run } from "../src/run";
import { ContextPlugin } from "../src/types/plugin-input";

describe("run", () => {
  it("closes adapters after webhook execution", async () => {
    const close = mock(() => Promise.resolve());

    spyOn(await import("../src/adapters/index"), "createAdapters").mockResolvedValue({
      issueStore: {} as never,
      close,
    });

    spyOn(await import("../src/handlers/watch-user-activity"), "watchUserActivity").mockResolvedValue({ message: "OK" });

    const context = {
      logger: new Logs("debug"),
      config: {
        availableDeadlineExtensions: {
          enabled: false,
          amounts: {},
        },
      },
      payload: {
        repository: {
          name: "daemon-disqualifier",
          owner: { login: "ubiquity-os-marketplace" },
        },
      },
      octokit: {},
    } as unknown as ContextPlugin;

    await expect(run(context)).resolves.toEqual({ message: "OK" });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
