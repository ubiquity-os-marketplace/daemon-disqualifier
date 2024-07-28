import { http, HttpResponse } from "msw";
import { db } from "./db";
import issueEventsGet from "./routes/get-events.json";
import issuesLabelsGet from "./routes/get-labels.json";
import issueTimeline from "./routes/get-timeline.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("http://127.0.0.1:54321/rest/v1/issues", () => {
    const repos = db.issues.getAll();
    return HttpResponse.json(repos);
  }),
  http.post("http://127.0.0.1:54321/rest/v1/issues", async ({ request }) => {
    const body = await request.json();

    if (typeof body === "object") {
      const newItem = {
        ...body,
        id: db.issues.count() + 1,
      };
      db.issues.create(newItem);
    }
    return HttpResponse.json({});
  }),
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
    return HttpResponse.json(db.repos.getAll());
  }),

  http.get("https://api.github.com/repos/:owner/:repo/issues", () => {
    return HttpResponse.json(db.issues.getAll());
  }),

  http.get("https://api.github.com/orgs/:org/repos", () => {
    return HttpResponse.json(db.repos.getAll());
  }),
];
