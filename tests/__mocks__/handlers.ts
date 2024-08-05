import { http, HttpResponse } from "msw";
import { db } from "./db";
import issueEventsGet from "./routes/get-events.json";
import issuesLabelsGet from "./routes/get-labels.json";
import issueTimeline from "./routes/get-timeline.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/events", () => {
    return HttpResponse.json(issueEventsGet);
  }),
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/labels", () => {
    return HttpResponse.json(issuesLabelsGet);
  }),
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/timeline", () => {
    return HttpResponse.json(issueTimeline);
  }),

  http.get("https://api.github.com/:org/repos", ({ params: { org } }) => {
    return HttpResponse.json(db.repo.findMany({ where: { owner: { login: { equals: org as string } } } }));
  }),

  http.get("https://api.github.com/repos/:owner/:repo/issues", ({ params: { owner, repo } }) => {
    return HttpResponse.json(db.issue.findMany({ where: { owner: { login: { equals: owner as string } }, repo: { equals: repo as string } } }));
  }),

  http.get("https://api.github.com/orgs/:org/repos", ({ params: { org } }) => {
    return HttpResponse.json(db.repo.findMany({ where: { owner: { login: { equals: org as string } } } }));
  }),
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/comments", ({ params: { owner, repo } }) => {
    return HttpResponse.json(db.issueComments.findMany({ where: { owner: { login: { equals: owner as string } }, repo: { name: { equals: repo as string } } } }));
  }),
];
