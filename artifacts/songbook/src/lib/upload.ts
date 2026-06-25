import { useState, useCallback } from "react";

export interface UploadResult {
  uploadURL: string;
  objectPath: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("songbook_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Two-step presigned upload: request a signed URL from the API (auth-guarded),
 * then PUT the file straight to object storage with progress reporting.
 */
export function useAudioUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);
      try {
        const res = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        });
        if (!res.ok) throw new Error("Could not start upload");
        const data = (await res.json()) as UploadResult;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", data.uploadURL);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error("Upload failed"));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

        setProgress(100);
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  return { upload, isUploading, progress, error };
}
