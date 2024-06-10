import { http, HttpResponse } from "msw";
import { db } from "./db";
import issueEventsGet from "./routes/get-events.json";
import issuesLabelsGet from "./routes/get-labels.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("http://127.0.0.1:54321/rest/v1/repositories", () => {
    const repos = db.repositories.getAll();
    return HttpResponse.json(repos);
  }),
  http.post("http://127.0.0.1:54321/rest/v1/repositories", async ({ request }) => {
    const body = await request.json();

    if (typeof body === "object") {
      const newItem = {
        ...body,
        id: db.repositories.count() + 1,
      };
      db.repositories.create(newItem);
    }
    return HttpResponse.json({});
  }),
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/events", () => {
    return HttpResponse.json(issueEventsGet);
  }),
  http.get("https://api.github.com/repos/:owner/:repo/issues/:id/labels", () => {
    return HttpResponse.json(issuesLabelsGet);
  }),
];
