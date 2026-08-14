import type { IncomingMessage, ServerResponse } from "http";
import app, { initServer } from "../src/index.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await initServer();
  return app(req, res);
}
