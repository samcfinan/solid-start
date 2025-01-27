import compression from "compression";
import { once } from "events";
import fs from "fs";
import polka from "polka";
import sirv from "sirv";
import { createRequest } from "solid-start/node/fetch.js";
import { Readable } from "stream";

global.onunhandledrejection = (err, promise) => {
  console.error(err);
  console.error(promise);
};

export function createServer({ handler, paths, manifest }) {
  const comp = compression({
    threshold: 0,
    filter: req => {
      return !req.headers["accept"]?.startsWith("text/event-stream");
    }
  });
  const assets_handler = fs.existsSync(paths.assets)
    ? sirv(paths.assets, {
        maxAge: 31536000,
        immutable: true
      })
    : (_req, _res, next) => next();

  const render = async (req, res) => {
    try {
      const webRes = await handler({
        request: createRequest(req),
        env: {
          manifest
        }
      });

      res.statusCode = webRes.status;
      res.statusMessage = webRes.statusText;

      for (const [name, value] of webRes.headers) {
        res.setHeader(name, value);
      }

      if (webRes.body) {
        const readable = Readable.from(webRes.body);
        readable.pipe(res);
        await once(readable, "end");
      } else {
        res.end();
      }
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.statusMessage = "Internal Server Error";
      res.end();
    }
  };

  const server = polka().use("/", comp, assets_handler).use(comp, render);

  return server;
}
