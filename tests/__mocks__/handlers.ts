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

  http.get("https://api.github.com/:org/repos", () => {
    return HttpResponse.json(db.repo.getAll());
  }),

  http.get("https://api.github.com/repos/:owner/:repo/issues", () => {
    return HttpResponse.json(db.issue.getAll());
  }),

  http.get("https://api.github.com/orgs/:org/repos", () => {
    return HttpResponse.json(db.repo.getAll());
  }),
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/comments", () => {
    return HttpResponse.json(db.issueComments.getAll());
  }),
];
