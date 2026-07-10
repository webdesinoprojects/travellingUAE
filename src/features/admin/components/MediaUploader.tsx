"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

type MediaUploaderProps = {
  onClose: () => void;
};

type UploadAuth = {
  signature: string;
  expire: number;
  token: string;
  publicKey: string;
  uploadEndpoint: string;
};

type PendingItem = {
  id: string;
  file: File;
  altText: string;
  status: "ready" | "uploading" | "uploaded" | "failed";
  progress: number;
  message?: string;
};

type ToastState = {
  tone: "success" | "warning" | "error";
  message: string;
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_BYTES = 25 * 1024 * 1024;
const FOLDER_RE = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,119}$/;

export function MediaUploader({ onClose }: MediaUploaderProps) {
  const router = useRouter();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [folder, setFolder] = useState("api-smoke");
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const uploadableCount = items.filter(
    (item) => item.status === "ready" || item.status === "failed",
  ).length;
  const queueProgress =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce((total, item) => total + item.progress, 0) / items.length,
        );

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, submitting]);

  const addFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    setToast(null);
    const accepted: PendingItem[] = [];
    const list = Array.from(files);
    for (const file of list) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError(`Unsupported file type for ${file.name}.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} exceeds the 25 MB upload limit.`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        altText: "",
        status: "ready",
        progress: 0,
      });
    }
    if (accepted.length === 0) return;
    setItems((current) => [...current, ...accepted]);
  }, []);

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  function updateItem(id: string, patch: Partial<PendingItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function fetchAuth(): Promise<UploadAuth> {
    const response = await fetch("/api/admin/media/upload-auth", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("upload-auth-failed");
    }
    const payload = (await response.json()) as
      | { ok?: boolean; data?: UploadAuth }
      | null;
    if (!payload || payload.ok !== true || !payload.data) {
      throw new Error("upload-auth-failed");
    }
    return payload.data;
  }

  async function uploadOne(
    item: PendingItem,
    auth: UploadAuth,
    folderValue: string,
    onProgress: (progress: number) => void,
  ) {
    const body = new FormData();
    body.append("file", item.file);
    body.append("fileName", item.file.name);
    body.append("publicKey", auth.publicKey);
    body.append("signature", auth.signature);
    body.append("expire", String(auth.expire));
    body.append("token", auth.token);
    if (folderValue) body.append("folder", folderValue);
    body.append("useUniqueFileName", "true");

    const result = await uploadToImageKit(auth.uploadEndpoint, body, onProgress);
    if (!result?.fileId) {
      throw new Error("imagekit-upload-incomplete");
    }

    onProgress(96);
    const persist = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: result.fileId,
        altText: item.altText.trim(),
        folder: folderValue || undefined,
      }),
    });
    if (!persist.ok) {
      throw new Error("persist-failed");
    }
    onProgress(100);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setToast(null);

    const folderValue = folder.trim();
    if (folderValue && !FOLDER_RE.test(folderValue)) {
      setError("Folder name is invalid. Use letters, numbers, '_', '-', '/' or '.'.");
      return;
    }
    const ready = items.filter((item) => item.status === "ready" || item.status === "failed");
    if (ready.length === 0) {
      setError("Add at least one image and an alt text before uploading.");
      return;
    }
    for (const item of ready) {
      if (item.altText.trim().length < 4) {
        setError(`${item.file.name} needs alt text (4+ characters).`);
        return;
      }
    }

    setSubmitting(true);
    let auth: UploadAuth;
    try {
      auth = await fetchAuth();
    } catch {
      setSubmitting(false);
      setError("Upload authorization failed. Try again.");
      return;
    }

    let succeeded = 0;
    for (const item of ready) {
      updateItem(item.id, {
        status: "uploading",
        progress: 1,
        message: undefined,
      });
      try {
        await uploadOne(item, auth, folderValue, (progress) =>
          updateItem(item.id, { progress }),
        );
        updateItem(item.id, { status: "uploaded", progress: 100 });
        succeeded += 1;
      } catch {
        updateItem(item.id, {
          status: "failed",
          progress: 0,
          message: "Upload failed.",
        });
      }
    }

    setSubmitting(false);
    if (succeeded > 0) router.refresh();
    setToast(
      succeeded === ready.length
        ? {
            tone: "success",
            message: `Uploaded ${succeeded} image${succeeded === 1 ? "" : "s"} to Media.`,
          }
        : succeeded > 0
          ? {
              tone: "warning",
              message: `Uploaded ${succeeded} of ${ready.length} images. Failed items remain in the queue.`,
            }
          : {
              tone: "error",
              message: "No images uploaded. Check the failed queue items and try again.",
            },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
    >
      <div className="relative grid max-h-[92vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-lg border border-[#d7c5ad] bg-white p-5 text-brand-navy shadow-2xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 dark:bg-[#0d0d0d] dark:text-white">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
              Media upload
            </p>
            <h2 id={titleId} className="font-serif text-2xl font-black">
              Add images
            </h2>
            <p className="mt-1 max-w-prose text-xs font-semibold text-brand-brown">
              JPEG, PNG, WEBP, AVIF or GIF. Up to 25 MB each. Alt text is required
              for every image.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close uploader"
            className="grid size-9 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {toast ? (
            <ToastMessage toast={toast} onClose={() => setToast(null)} />
          ) : null}

          <label className="grid gap-1 text-xs font-extrabold uppercase tracking-widest text-brand-brown">
            Folder
            <input
              type="text"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              placeholder="e.g. trips/dubai"
              className="min-h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60"
            />
            <span className="text-[11px] font-semibold normal-case tracking-normal text-brand-brown">
              The verified ImageKit filePath must match this folder server-side.
              Leave blank to use ImageKit defaults.
            </span>
          </label>

          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragOver(false);
            }}
            onDrop={handleDrop}
            className={`grid place-items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition ${
              dragOver
                ? "border-brand-blue bg-brand-sky/40"
                : "border-[#d7c5ad] bg-[#fffaf2] dark:border-white/15 dark:bg-white/[0.04]"
            }`}
          >
            <Upload aria-hidden="true" className="size-6 text-brand-blue" />
            <p className="text-sm font-extrabold text-brand-navy dark:text-white">
              Drop images here to queue them or
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ml-1 underline underline-offset-2 hover:text-brand-blue"
              >
                browse
              </button>
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              multiple
              onChange={handleFileInput}
              className="sr-only"
            />
          </div>

          {error ? (
            <p className="inline-flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {items.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-[#d7c5ad] bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
                  Queue {items.length} image{items.length === 1 ? "" : "s"}
                </p>
                <p className="text-xs font-black text-brand-navy dark:text-white">
                  {queueProgress}% total
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#eadac4] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-blue transition-all"
                  style={{ width: `${queueProgress}%` }}
                />
              </div>
              <ul className="grid max-h-[320px] gap-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="grid min-w-0 gap-2 rounded-lg border border-border-soft bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-extrabold text-brand-navy dark:text-white">
                        {item.file.name}
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-brand-brown">
                        {formatBytes(item.file.size)}
                      </p>
                    </div>
                    <label className="grid min-w-0 gap-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-brown">
                      Alt text
                      <input
                        type="text"
                        value={item.altText}
                        onChange={(event) =>
                          updateItem(item.id, { altText: event.target.value })
                        }
                        placeholder="Describe the image for screen readers"
                        disabled={
                          item.status === "uploading" || item.status === "uploaded"
                        }
                        className="min-h-9 w-full rounded-lg border border-border-soft bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60"
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={item.status}
                        progress={item.progress}
                        message={item.message}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={item.status === "uploading"}
                        className="grid size-8 place-items-center rounded-lg border border-border-soft bg-white text-brand-brown hover:text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-brand-sand"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <X aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-1 sm:col-span-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#eadac4] dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.status === "failed"
                              ? "bg-rose-500"
                              : item.status === "uploaded"
                                ? "bg-emerald-500"
                                : "bg-brand-blue"
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <p className="text-right text-[11px] font-black text-brand-brown">
                        {item.progress}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex min-h-10 items-center rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-brown disabled:opacity-50 dark:bg-white/10 dark:text-brand-sand"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || uploadableCount === 0}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-black text-white hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
            >
              {submitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
              Upload queue {uploadableCount > 0 ? `(${uploadableCount})` : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  progress,
  message,
}: {
  status: PendingItem["status"];
  progress: number;
  message?: string;
}) {
  if (status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-blue">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        {progress}%
      </span>
    );
  }
  if (status === "uploaded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600">
        <CheckCircle2 aria-hidden="true" className="size-3.5" />
        Saved
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-600"
        title={message}
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        Retry
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-brown">
      Ready
    </span>
  );
}

function ToastMessage({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  const isSuccess = toast.tone === "success";
  const isWarning = toast.tone === "warning";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm font-bold shadow-xl ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isWarning
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-1 grid size-5 shrink-0 place-items-center rounded-full hover:bg-black/10"
        aria-label="Dismiss upload message"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </div>
  );
}

function uploadToImageKit(
  endpoint: string,
  body: FormData,
  onProgress: (progress: number) => void,
): Promise<{ fileId?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress(50);
        return;
      }

      onProgress(
        Math.min(95, Math.max(1, Math.round((event.loaded / event.total) * 95))),
      );
    };
    xhr.onerror = () => reject(new Error("imagekit-upload-failed"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("imagekit-upload-failed"));
        return;
      }

      try {
        resolve(JSON.parse(xhr.responseText) as { fileId?: string });
      } catch {
        reject(new Error("imagekit-upload-invalid-response"));
      }
    };
    xhr.send(body);
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
