import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, requireAuthAllowQuery } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Guarded by requireAuth so only the logged-in band can upload.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      if (!contentType.startsWith("audio/")) {
        res.status(400).json({ error: "Only audio files can be uploaded" });
        return;
      }
      if (size > MAX_AUDIO_BYTES) {
        res.status(400).json({ error: "Audio file too large (max 50 MB)" });
        return;
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR. Supports HTTP Range requests
 * (206 Partial Content) so browser <audio>/<video> elements can seek/scrub
 * uploaded media. Object paths are random UUIDs. Auth is required (via header
 * or `?token=` query param) so private uploads are not publicly accessible.
 */
router.get(
  "/storage/objects/*path",
  requireAuthAllowQuery,
  async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const [metadata] = await objectFile.getMetadata();
    const totalSize = Number(metadata.size ?? 0);
    const contentType =
      (metadata.contentType as string) || "application/octet-stream";

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const rangeHeader = req.headers.range;
    if (rangeHeader && totalSize > 0) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= totalSize) end = totalSize - 1;

        if (start > end || start >= totalSize) {
          res
            .status(416)
            .setHeader("Content-Range", `bytes */${totalSize}`)
            .end();
          return;
        }

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
        res.setHeader("Content-Length", String(end - start + 1));

        const stream = objectFile.createReadStream({ start, end });
        stream.on("error", (err) => {
          req.log.error({ err }, "Error streaming ranged object");
          if (!res.headersSent) res.sendStatus(500);
          else res.destroy();
        });
        stream.pipe(res);
        return;
      }
    }

    if (totalSize > 0) res.setHeader("Content-Length", String(totalSize));
    res.status(200);
    const stream = objectFile.createReadStream();
    stream.on("error", (err) => {
      req.log.error({ err }, "Error streaming object");
      if (!res.headersSent) res.sendStatus(500);
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
