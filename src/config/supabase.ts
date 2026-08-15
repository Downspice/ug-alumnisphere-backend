import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let storageClient: SupabaseClient | null = null;

export const STORAGE_BUCKETS = {
  profileImages: "profile-images",
  postMedia: "post-media",
  communityMedia: "community-media",
  eventMedia: "event-media",
  campaignMedia: "campaign-media",
  verificationDocuments: "verification-documents",
  resumes: "resumes",
} as const;

export const PRIVATE_BUCKETS = new Set<string>([
  STORAGE_BUCKETS.verificationDocuments,
  STORAGE_BUCKETS.resumes,
]);

function storageKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && storageKey());
}

export function isSupabaseConfigured(): boolean {
  return isStorageConfigured();
}

export function getStorageClient(): SupabaseClient {
  if (!isStorageConfigured()) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and a Supabase key."
    );
  }
  if (!storageClient) {
    storageClient = createClient(process.env.SUPABASE_URL as string, storageKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return storageClient;
}

export function getSupabaseAdmin(): SupabaseClient {
  return getStorageClient();
}
