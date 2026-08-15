import { randomUUID } from "node:crypto";
import {
  getStorageClient,
  isStorageConfigured,
  PRIVATE_BUCKETS,
  STORAGE_BUCKETS,
} from "../config/supabase.js";
import {
  FILE_PURPOSES,
  FilePurpose,
  IStoredFile,
  StoredFile,
} from "../models/StoredFile.js";
import { badUserInput, forbidden, internalError, notFound } from "./errors.js";
import mongoose from "mongoose";
import { assertValidObjectId } from "./errors.js";

export const PURPOSE_RULES: Record<
  FilePurpose,
  {
    bucket: string;
    visibility: "public" | "private";
    maxBytes: number;
    mimeTypes: string[];
  }
> = {
  avatar: {
    bucket: STORAGE_BUCKETS.profileImages,
    visibility: "public",
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  post: {
    bucket: STORAGE_BUCKETS.postMedia,
    visibility: "public",
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  verification: {
    bucket: STORAGE_BUCKETS.verificationDocuments,
    visibility: "private",
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  },
  resume: {
    bucket: STORAGE_BUCKETS.resumes,
    visibility: "private",
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  event: {
    bucket: STORAGE_BUCKETS.eventMedia,
    visibility: "public",
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  campaign: {
    bucket: STORAGE_BUCKETS.campaignMedia,
    visibility: "public",
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  community: {
    bucket: STORAGE_BUCKETS.communityMedia,
    visibility: "public",
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
};

const BUCKET_SPECS = [
  { id: STORAGE_BUCKETS.profileImages, public: true, fileSizeLimit: 2 * 1024 * 1024 },
  { id: STORAGE_BUCKETS.postMedia, public: true, fileSizeLimit: 5 * 1024 * 1024 },
  { id: STORAGE_BUCKETS.communityMedia, public: true, fileSizeLimit: 5 * 1024 * 1024 },
  { id: STORAGE_BUCKETS.eventMedia, public: true, fileSizeLimit: 5 * 1024 * 1024 },
  { id: STORAGE_BUCKETS.campaignMedia, public: true, fileSizeLimit: 5 * 1024 * 1024 },
  {
    id: STORAGE_BUCKETS.verificationDocuments,
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
  },
  { id: STORAGE_BUCKETS.resumes, public: false, fileSizeLimit: 8 * 1024 * 1024 },
];

export function parsePurpose(value: string | undefined): FilePurpose {
  if (!value || !FILE_PURPOSES.includes(value as FilePurpose)) {
    badUserInput(
      "Upload purpose must be avatar, post, verification, resume, event, campaign, or community."
    );
  }
  return value as FilePurpose;
}

export function validateUploadFile(
  purpose: FilePurpose,
  file: { mimetype: string; size: number; originalname: string }
) {
  const rules = PURPOSE_RULES[purpose];
  if (!rules.mimeTypes.includes(file.mimetype)) {
    badUserInput(`This file type is not allowed for ${purpose} uploads.`);
  }
  if (file.size < 1 || file.size > rules.maxBytes) {
    badUserInput(
      `File must be between 1 byte and ${Math.round(rules.maxBytes / 1024 / 1024)}MB.`
    );
  }
  if (!file.originalname?.trim()) {
    badUserInput("A file name is required.");
  }
  return rules;
}

function extensionFor(mimeType: string, originalName: string) {
  const fromName = originalName.includes(".")
    ? originalName.split(".").pop()?.toLowerCase()
    : "";
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[mimeType] ?? "bin";
}

export async function ensureStorageBuckets() {
  if (!isStorageConfigured()) return;
  const client = getStorageClient();
  for (const spec of BUCKET_SPECS) {
    const existing = await client.storage.getBucket(spec.id);
    if (existing.data) continue;
    const created = await client.storage.createBucket(spec.id, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      console.warn(
        `[storage] Could not create bucket ${spec.id}: ${created.error.message}`
      );
      if (/row-level security/i.test(created.error.message)) {
        console.warn(
          "[storage] The publishable/anon key cannot create buckets. Add SUPABASE_SERVICE_ROLE_KEY to backend/.env, or create the buckets in the Supabase dashboard."
        );
      }
    }
  }
}

export async function storeUpload(input: {
  ownerId: string;
  purpose: FilePurpose;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  size: number;
}): Promise<IStoredFile> {
  if (!isStorageConfigured()) {
    internalError("File storage is not configured. Set SUPABASE_URL and a Supabase key.");
  }
  const rules = validateUploadFile(input.purpose, {
    mimetype: input.mimeType,
    size: input.size,
    originalname: input.originalName,
  });
  const ext = extensionFor(input.mimeType, input.originalName);
  const path = `${input.ownerId}/${randomUUID()}.${ext}`;
  const client = getStorageClient();
  const uploaded = await client.storage.from(rules.bucket).upload(path, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (uploaded.error) {
    const detail = uploaded.error.message || "Supabase rejected the upload.";
    if (/row-level security|not found|bucket/i.test(detail)) {
      internalError(
        "File storage buckets are not ready. Add SUPABASE_SERVICE_ROLE_KEY or create the AlumniSphere buckets in Supabase.",
        uploaded.error
      );
    }
    internalError("Failed to store the file in Supabase.", uploaded.error);
  }
  const publicUrl =
    rules.visibility === "public"
      ? client.storage.from(rules.bucket).getPublicUrl(path).data.publicUrl
      : "";
  try {
    return await StoredFile.create({
      ownerId: input.ownerId,
      purpose: input.purpose,
      bucket: rules.bucket,
      path,
      originalName: input.originalName.trim().slice(0, 180),
      mimeType: input.mimeType,
      size: input.size,
      visibility: rules.visibility,
      publicUrl,
    });
  } catch (error) {
    internalError("File was stored but metadata could not be saved.", error);
  }
}

export async function claimStoredFile(
  fileId: string,
  ownerId: string,
  purpose: FilePurpose
) {
  assertValidObjectId(fileId, "File ID", mongoose);
  const file = await StoredFile.findById(fileId);
  if (!file) notFound("Uploaded file not found. Upload it again.");
  if (file.ownerId.toString() !== ownerId)
    forbidden("This file belongs to another account.");
  if (file.purpose !== purpose) badUserInput(`This file cannot be used as a ${purpose}.`);
  if (!file.claimed) {
    file.claimed = true;
    await file.save();
  }
  return file;
}

export async function resolveDownloadUrl(file: IStoredFile) {
  if (file.visibility === "public" && file.publicUrl) return file.publicUrl;
  if (!isStorageConfigured()) return "";
  const client = getStorageClient();
  const signed = await client.storage
    .from(file.bucket)
    .createSignedUrl(file.path, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) {
    if (file.publicUrl) return file.publicUrl;
    internalError("Could not create a download link.", signed.error);
  }
  return signed.data.signedUrl;
}

export function coverFieldsFromFile(file: IStoredFile | null) {
  if (!file) return {};
  return {
    coverImageUrl: file.publicUrl || `/files/${file._id.toString()}`,
    coverImagePath: file.path,
    coverFileId: file._id,
  };
}

export function isPrivateBucket(bucket: string) {
  return PRIVATE_BUCKETS.has(bucket);
}

export { isStorageConfigured };
