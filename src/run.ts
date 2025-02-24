import { watchUserActivity } from "./handlers/watch-user-activity";
import { ContextPlugin } from "./types/plugin-input";

async function populateTopUpThresholds(context: ContextPlugin) {
  const { config, octokit, logger } = context;

  if (!config.availableDeadlineExtensions.enabled || Object.keys(config.availableDeadlineExtensions.amounts).length) {
    return;
  }
  if (!context.payload.repository.owner?.login) {
    throw logger.fatal("Missing owner login from payload", { context: context.payload });
  }

  const data = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
    owner: context.payload.repository.owner?.login,
    repo: context.payload.repository.name,
  });

  if (!data.length) {
    logger.debug("No labels have been found, won't populate top ups.", { data });
    return;
  }

  const priorityLabels = data
    .map((label) => {
      const match = label.name.match(/^Priority:\s*(\d+).*$/i);
      if (match) {
        return {
          name: label.name,
          value: parseInt(match[1], 10),
        };
      }
      return null;
    })
    .filter((label) => label !== null);

  if (!priorityLabels.length) {
    logger.debug("No priority labels have been found, won't populate top ups.", { data });
    return;
  }

  const highestPriority = Math.max(...priorityLabels.map((label) => label.value)) + 1;
  config.availableDeadlineExtensions.amounts = priorityLabels.reduce((acc, curr) => {
    return { ...acc, [curr.name]: Math.max(1, highestPriority - curr.value) };
  }, {});
  logger.debug("Populated top up amounts", { topUps: config.availableDeadlineExtensions.amounts });
}

export async function run(context: ContextPlugin) {
  context.logger.debug("Will run with the following configuration:", { configuration: context.config });
  await populateTopUpThresholds(context);
  return watchUserActivity(context);
}
