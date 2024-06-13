import { Value } from "@sinclair/typebox/value";
import { ValidationException } from "typebox-validators";
import { Context } from "../types/context";
import { Database } from "../types/database";
import envConfigSchema, { envConfigValidator } from "../types/env-type";
import { parseGitHubUrl } from "./github-url";

export async function getEnv() {
  if (!envConfigValidator.test(process.env)) {
    for (const error of envConfigValidator.errors(process.env)) {
      console.error(error);
    }
    return Promise.reject(new ValidationException("The environment is invalid."));
  }
  return Promise.resolve(Value.Decode(envConfigSchema, process.env));
}

export async function getGithubIssue(context: Context, issue: Database["public"]["Tables"]["issues"]["Row"]) {
  const { repo, owner, issue_number } = parseGitHubUrl(issue.url);

  try {
    const { data } = await context.octokit.issues.get({
      owner,
      repo,
      issue_number,
    });
    return data;
  } catch (e) {
    context.logger.error(`Could not get GitHub issue ${issue.url}`);
    return null;
  }
}
