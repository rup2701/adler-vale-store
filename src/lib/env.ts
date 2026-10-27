/** A deployed store (Vercel, or DEPLOYED=1). Deployed builds must never write uploads to local disk. */
export function isDeployed(): boolean {
  return !!process.env.VERCEL || process.env.DEPLOYED === "1";
}

export function objectStorageConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Throws when this is a deployed build without object storage. Called at server start. */
export function assertStorageConfig() {
  if (isDeployed() && !objectStorageConfigured()) {
    throw new Error(
      "Photo storage is not set up: this is a deployed build and BLOB_READ_WRITE_TOKEN is missing. Connect Vercel Blob to the project (it sets BLOB_READ_WRITE_TOKEN) and redeploy. Uploads are never written to the server's own disk.",
    );
  }
}
