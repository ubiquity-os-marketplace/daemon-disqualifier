import { Value } from "@sinclair/typebox/value";
import { ConfigurationHandler, isGithubPlugin } from "@ubiquity-os/plugin-sdk/configuration";
import manifest from "../../manifest.json" with { type: "json" };
import { ContextPlugin, PluginSettings, pluginSettingsSchema } from "../types/plugin-input";

type ManifestPlugin = Parameters<ConfigurationHandler["getManifest"]>[0];

function getDistRef(ref: string) {
  return ref.startsWith("dist/") ? ref : `dist/${ref}`;
}

export class CronConfigurationHandler extends ConfigurationHandler {
  override async getManifest(plugin: ManifestPlugin) {
    if (!isGithubPlugin(plugin) || !plugin.ref || plugin.ref.startsWith("dist/")) {
      return super.getManifest(plugin);
    }

    const distManifest = await super.getManifest({ ...plugin, ref: getDistRef(plugin.ref) });
    if (distManifest) {
      return distManifest;
    }

    return super.getManifest(plugin);
  }
}

export async function resolveCronRepoConfig(
  octokit: ContextPlugin["octokit"],
  logger: ContextPlugin["logger"],
  owner: string,
  repo: string
): Promise<PluginSettings | null> {
  try {
    const handler = new CronConfigurationHandler(logger, octokit);
    const parsedConfig = await handler.getSelfConfiguration(manifest, { owner, repo });
    if (!parsedConfig) {
      return null;
    }

    const withDefaults = Value.Default(pluginSettingsSchema, parsedConfig);
    return Value.Decode(pluginSettingsSchema, withDefaults);
  } catch (err) {
    logger.error("Failed to resolve repository configuration.", { owner, repo, err });
    return null;
  }
}
