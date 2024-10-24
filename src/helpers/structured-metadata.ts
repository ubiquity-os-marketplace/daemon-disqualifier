import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import { ContextPlugin } from "../types/plugin-input";

const HEADER_NAME = "Ubiquity";

export function createStructuredMetadata(className: string, logReturn: LogReturn | null) {
  let logMessage, metadata;
  if (logReturn) {
    logMessage = logReturn.logMessage;
    metadata = logReturn.metadata;
  }

  const jsonPretty = JSON.stringify(metadata, null, 2);
  const stackLine = new Error().stack?.split("\n")[2] ?? "";
  const caller = stackLine.match(/at (\S+)/)?.[1] ?? "";
  const ubiquityMetadataHeader = `<!-- ${HEADER_NAME} - ${className} - ${caller} - ${metadata?.revision}`;

  let metadataSerialized: string;
  const metadataSerializedVisible = ["```json", jsonPretty, "```"].join("\n");
  const metadataSerializedHidden = [ubiquityMetadataHeader, jsonPretty, "-->"].join("\n");

  if (logMessage?.type === "fatal") {
    // if the log message is fatal, then we want to show the metadata
    metadataSerialized = [metadataSerializedVisible, metadataSerializedHidden].join("\n");
  } else {
    // otherwise we want to hide it
    metadataSerialized = metadataSerializedHidden;
  }

  return metadataSerialized;
}

export async function getCommentsFromMetadata(context: ContextPlugin, issueNumber: number, repoOwner: string, repoName: string, className: string) {
  const { octokit } = context;
  const ubiquityMetadataHeaderPattern = new RegExp(`<!-- ${HEADER_NAME} - ${className} - \\S+ - [\\s\\S]*?-->`);
  return await octokit.paginate(
    octokit.rest.issues.listComments,
    {
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
    },
    (response) =>
      response.data.filter(
        (comment) => comment.performed_via_github_app && comment.body && comment.user?.type === "Bot" && ubiquityMetadataHeaderPattern.test(comment.body)
      )
  );
}
