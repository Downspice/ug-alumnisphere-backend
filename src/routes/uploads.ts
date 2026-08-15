import type { Request, Response } from "express";
import multer from "multer";
import { resolveUserFromToken } from "../utils/auth.js";
import {
  ensureStorageBuckets,
  isStorageConfigured,
  parsePurpose,
  resolveDownloadUrl,
  storeUpload,
} from "../utils/storage.js";
import { StoredFile } from "../models/StoredFile.js";
import { Job } from "../models/Job.js";
import { JobApplication } from "../models/JobApplication.js";
import mongoose from "mongoose";
import { normalizeRole } from "../utils/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

function bearer(req: Request) {
  const header = req.headers.authorization;
  if (typeof header === "string") return header;
  const query = req.query.token;
  return typeof query === "string" ? `Bearer ${query}` : undefined;
}

function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({
    error: { code, message, timestamp: new Date().toISOString() },
  });
}

export function registerUploadRoutes(app: import("express").Application) {
  app.get("/storage/status", (_req: Request, res: Response) => {
    res.json({
      configured: isStorageConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/uploads", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const user = await resolveUserFromToken(bearer(req));
      if (!user) {
        fail(res, 401, "UNAUTHENTICATED", "Sign in to upload a file.");
        return;
      }
      if (!req.file) {
        fail(res, 400, "BAD_USER_INPUT", "Attach a file field named file.");
        return;
      }
      await ensureStorageBuckets();
      const purpose = parsePurpose(typeof req.body?.purpose === "string" ? req.body.purpose : undefined);
      const stored = await storeUpload({
        ownerId: user._id.toString(),
        purpose,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
        size: req.file.size,
      });
      res.status(201).json({
        id: stored._id.toString(),
        purpose: stored.purpose,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        visibility: stored.visibility,
        url: stored.publicUrl || `/files/${stored._id.toString()}`,
      });
    } catch (error) {
      const code = (error as { extensions?: { code?: string } }).extensions?.code;
      const message = error instanceof Error ? error.message : "Upload failed.";
      if (code === "BAD_USER_INPUT") {
        fail(res, 400, code, message);
        return;
      }
      console.error("[uploads]", error);
      fail(res, 500, code || "INTERNAL_SERVER_ERROR", message);
    }
  });

  app.get("/files/:id", async (req: Request, res: Response) => {
    try {
      const user = await resolveUserFromToken(bearer(req));
      if (!user) {
        fail(res, 401, "UNAUTHENTICATED", "Sign in to open this file.");
        return;
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        fail(res, 400, "BAD_USER_INPUT", "Invalid file ID.");
        return;
      }
      const file = await StoredFile.findById(id);
      if (!file) {
        fail(res, 404, "NOT_FOUND", "File not found.");
        return;
      }
      const isOwner = file.ownerId.toString() === user._id.toString();
      const isAdmin = normalizeRole(user.role) === "admin";
      let canOpen = isOwner || isAdmin || file.visibility === "public";
      if (!canOpen && file.purpose === "resume") {
        const application = await JobApplication.findOne({ resumeFileId: file._id });
        if (application) {
          const job = await Job.findById(application.jobId);
          canOpen = job?.postedById.toString() === user._id.toString();
        }
      }
      if (!canOpen) {
        fail(res, 403, "FORBIDDEN", "You cannot open this file.");
        return;
      }
      const url = await resolveDownloadUrl(file);
      res.redirect(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open file.";
      fail(res, 500, "INTERNAL_SERVER_ERROR", message);
    }
  });
}
