"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Save,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { AdminHomeHero } from "@/types/home";

type HomeHeroEditorProps = {
  initialHero: AdminHomeHero;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

type MediaAsset = {
  id: string;
  name: string;
  altText: string;
  folder: string;
  url: string;
  thumbnailUrl: string;
};

type MediaSort = "latest" | "oldest" | "az" | "za";

type UploadAuth = {
  signature: string;
  expire: number;
  token: string;
  publicKey: string;
  uploadEndpoint: string;
};

type PersistedMedia = {
  id?: string;
  publicId?: string | null;
  url?: string;
  secureUrl?: string | null;
  altText?: string | null;
  folder?: string | null;
};

type UploadQueueItem = {
  id: string;
  file: File;
  altText: string;
  status: "ready" | "uploading" | "uploaded" | "failed";
  progress: number;
  message?: string;
};

type UploadToast = {
  tone: "success" | "warning" | "error";
  message: string;
};

const APPROVED_MEDIA_HOSTS = new Set([
  "ik.imagekit.io",
  "images.unsplash.com",
  "res.cloudinary.com",
]);
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const FOLDER_RE = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,119}$/;
const IMAGE_URL_ERROR = "Use ImageKit media or an approved image URL.";

export function HomeHeroEditor({ initialHero }: HomeHeroEditorProps) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [hero, setHero] = useState(initialHero);
  const [form, setForm] = useState({
    title: initialHero.title,
    subtitle: initialHero.subtitle,
    backgroundImage: initialHero.backgroundImage,
    backgroundAlt: initialHero.backgroundAlt,
    status: initialHero.status === "published" ? "published" : "draft",
  });
  const [urlError, setUrlError] = useState<string | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaSort, setMediaSort] = useState<MediaSort>("latest");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploadFolder, setUploadFolder] = useState("home/hero");
  const [uploadItems, setUploadItems] = useState<UploadQueueItem[]>([]);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<UploadToast | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message:
      initialHero.source === "database"
        ? "Saved homepage media."
        : "No CMS hero saved yet.",
  });
  const saving = saveState.status === "saving";
  const heroPreviewImage = isSafeImagePreviewSrc(hero.backgroundImage)
    ? hero.backgroundImage
    : null;
  const uploadableCount = uploadItems.filter(
    (item) => item.status === "ready" || item.status === "failed",
  ).length;
  const uploadQueueProgress =
    uploadItems.length === 0
      ? 0
      : Math.round(
          uploadItems.reduce((total, item) => total + item.progress, 0) /
            uploadItems.length,
        );
  const sortedMediaAssets = useMemo(() => {
    const sorted = [...mediaAssets];

    if (mediaSort === "oldest") {
      return sorted.reverse();
    }

    if (mediaSort === "az") {
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (mediaSort === "za") {
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    }

    return sorted;
  }, [mediaAssets, mediaSort]);

  useEffect(() => {
    if (!mediaOpen) {
      return;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [mediaOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isApprovedImageUrl(form.backgroundImage)) {
      setUrlError(IMAGE_URL_ERROR);
      setSaveState({ status: "error", message: IMAGE_URL_ERROR });
      return;
    }

    setSaveState({ status: "saving", message: "Saving..." });

    try {
      const response = await fetch("/api/admin/home/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { hero?: AdminHomeHero } }
        | null;
      const savedHero = result?.data?.hero;

      if (!response.ok || result?.ok !== true || !savedHero) {
        throw new Error("save-failed");
      }

      setHero(savedHero);
      setForm({
        title: savedHero.title,
        subtitle: savedHero.subtitle,
        backgroundImage: savedHero.backgroundImage,
        backgroundAlt: savedHero.backgroundAlt,
        status: savedHero.status === "published" ? "published" : "draft",
      });
      setUrlError(null);
      setSaveState({
        status: "saved",
        message:
          savedHero.status === "published"
            ? "Hero published on the homepage."
            : "Draft saved. The public homepage keeps its fallback image.",
      });
      router.refresh();
    } catch {
      setSaveState({
        status: "error",
        message: "The hero could not be saved. Check the image URL and try again.",
      });
    }
  }

  async function loadMedia(query = mediaSearch) {
    setMediaLoading(true);
    setMediaError(null);

    try {
      const params = new URLSearchParams({
        status: "published",
        limit: "48",
      });
      const trimmed = query.trim();

      if (trimmed) {
        params.set("q", trimmed);
      }

      const response = await fetch(`/api/admin/media?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { media?: MediaAsset[] } }
        | null;

      if (!response.ok || result?.ok !== true || !result.data?.media) {
        throw new Error("media-load-failed");
      }

      setMediaAssets(
        result.data.media.filter((asset) => isApprovedImageUrl(asset.url)),
      );
    } catch {
      setMediaError("Media could not be loaded.");
    } finally {
      setMediaLoading(false);
    }
  }

  function openMediaPicker() {
    setMediaOpen(true);
    if (mediaAssets.length === 0) {
      void loadMedia();
    }
  }

  function selectMedia(asset: MediaAsset) {
    setForm((current) => ({
      ...current,
      backgroundImage: asset.url,
      backgroundAlt: asset.altText || current.backgroundAlt,
    }));
    setUrlError(null);
    setMediaOpen(false);
  }

  function updateImageUrl(value: string) {
    setForm((current) => ({ ...current, backgroundImage: value }));
    setUrlError(value && !isApprovedImageUrl(value) ? IMAGE_URL_ERROR : null);
  }

  async function fetchUploadAuth(): Promise<UploadAuth> {
    const response = await fetch("/api/admin/media/upload-auth", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: UploadAuth }
      | null;

    if (!response.ok || payload?.ok !== true || !payload.data) {
      throw new Error("upload-auth-failed");
    }

    return payload.data;
  }

  const addUploadFiles = useCallback(
    (files: FileList | File[]) => {
      setMediaError(null);
      setUploadToast(null);
      const accepted: UploadQueueItem[] = [];
      const defaultAlt =
        form.backgroundAlt.trim().length >= 4
          ? form.backgroundAlt.trim()
          : "";

      for (const file of Array.from(files)) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          setMediaError(`Unsupported file type for ${file.name}.`);
          continue;
        }

        if (file.size > MAX_IMAGE_BYTES) {
          setMediaError(`${file.name} exceeds the 25 MB upload limit.`);
          continue;
        }

        accepted.push({
          id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          altText: defaultAlt,
          status: "ready",
          progress: 0,
        });
      }

      if (accepted.length > 0) {
        setUploadItems((current) => [...current, ...accepted]);
      }
    },
    [form.backgroundAlt],
  );

  function handleUploadInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addUploadFiles(event.target.files);
    }
    event.target.value = "";
  }

  function handleUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setUploadDragOver(false);

    if (event.dataTransfer.files.length > 0) {
      addUploadFiles(event.dataTransfer.files);
    }
  }

  function updateUploadItem(id: string, patch: Partial<UploadQueueItem>) {
    setUploadItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeUploadItem(id: string) {
    setUploadItems((current) => current.filter((item) => item.id !== id));
  }

  async function uploadHeroQueue() {
    setMediaError(null);
    setUploadToast(null);
    const folder = uploadFolder.trim();

    if (folder && !FOLDER_RE.test(folder)) {
      setMediaError("Folder name is invalid. Use letters, numbers, '_', '-', '/' or '.'.");
      return;
    }

    const ready = uploadItems.filter(
      (item) => item.status === "ready" || item.status === "failed",
    );

    if (ready.length === 0) {
      setMediaError("Add at least one image to the upload queue.");
      return;
    }

    for (const item of ready) {
      if (item.altText.trim().length < 4) {
        setMediaError(`${item.file.name} needs alt text (4+ characters).`);
        return;
      }
    }

    setUploading(true);

    let auth: UploadAuth;
    try {
      auth = await fetchUploadAuth();
    } catch {
      setUploading(false);
      setMediaError("Upload authorization failed. Try again.");
      return;
    }

    const uploadedAssets: MediaAsset[] = [];

    for (const item of ready) {
      updateUploadItem(item.id, {
        status: "uploading",
        progress: 1,
        message: undefined,
      });

      try {
        const body = new FormData();
        body.append("file", item.file);
        body.append("fileName", item.file.name);
        body.append("publicKey", auth.publicKey);
        body.append("signature", auth.signature);
        body.append("expire", String(auth.expire));
        body.append("token", auth.token);
        if (folder) body.append("folder", folder);
        body.append("useUniqueFileName", "true");

        const uploadResult = await uploadToImageKit(
          auth.uploadEndpoint,
          body,
          (progress) => updateUploadItem(item.id, { progress }),
        );

        if (!uploadResult.fileId) {
          throw new Error("imagekit-upload-failed");
        }

        updateUploadItem(item.id, { progress: 96 });
        const persistResponse = await fetch("/api/admin/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: uploadResult.fileId,
            altText: item.altText.trim(),
            folder: folder || undefined,
          }),
        });
        const persistResult = (await persistResponse.json().catch(() => null)) as
          | { ok?: boolean; data?: { media?: PersistedMedia } }
          | null;
        const persisted = persistResult?.data?.media;
        const url = persisted?.secureUrl ?? persisted?.url;

        if (!persistResponse.ok || persistResult?.ok !== true || !persisted?.id || !url) {
          throw new Error("media-persist-failed");
        }

        if (!isApprovedImageUrl(url)) {
          throw new Error("unsupported-upload-url");
        }

        const asset: MediaAsset = {
          id: persisted.id,
          name: persisted.publicId ?? item.file.name,
          altText: persisted.altText ?? item.altText.trim(),
          folder: persisted.folder ?? folder,
          url,
          thumbnailUrl: url,
        };

        uploadedAssets.push(asset);
        setMediaAssets((current) => [asset, ...current]);
        updateUploadItem(item.id, {
          status: "uploaded",
          progress: 100,
          message: undefined,
        });
      } catch {
        updateUploadItem(item.id, {
          status: "failed",
          progress: 0,
          message: "Upload failed.",
        });
      }
    }

    setUploading(false);

    if (uploadedAssets.length > 0) {
      const firstAsset = uploadedAssets[0];

      setForm((current) => ({
        ...current,
        backgroundImage: firstAsset.url,
        backgroundAlt: firstAsset.altText || current.backgroundAlt,
      }));
      setUrlError(null);
      setSaveState({
        status: "idle",
        message: "Uploaded image selected. Save Hero to apply it.",
      });
      router.refresh();
    }

    setUploadToast(
      uploadedAssets.length === ready.length
        ? {
            tone: "success",
            message: `Uploaded ${uploadedAssets.length} image${uploadedAssets.length === 1 ? "" : "s"}. First uploaded image is selected.`,
          }
        : uploadedAssets.length > 0
          ? {
              tone: "warning",
              message: `Uploaded ${uploadedAssets.length} of ${ready.length} images. Failed items remain in the queue.`,
            }
          : {
              tone: "error",
              message: "No images uploaded. Check the failed queue items and try again.",
            },
    );
  }

  return (
    <section className="grid gap-5 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] lg:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)]">
      <figure className="relative min-h-[320px] overflow-hidden rounded-lg bg-brand-navy">
        {heroPreviewImage ? (
          <Image
            src={heroPreviewImage}
            alt={hero.backgroundAlt}
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-brand-navy text-center text-white">
            <div className="max-w-xs px-4">
              <AlertTriangle
                aria-hidden="true"
                className="mx-auto size-8 text-brand-sand"
              />
              <p className="mt-3 text-sm font-bold">
                Saved hero image cannot be previewed. Select ImageKit media or an
                approved image URL.
              </p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-brand-navy/75 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-brand-sand">
            <ImageIcon aria-hidden="true" className="size-4" />
            Homepage Hero
          </p>
          <p className="mt-2 text-sm font-semibold text-white/78">
            {hero.title}
          </p>
        </figcaption>
      </figure>

      <form onSubmit={onSubmit} className="grid content-start gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            Hero media
          </p>
          <h2 className="mt-2 text-xl font-black">Homepage background</h2>
        </div>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Hero title
          <input
            required
            minLength={4}
            maxLength={140}
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Hero subtitle
          <textarea
            required
            minLength={8}
            maxLength={320}
            rows={3}
            value={form.subtitle}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subtitle: event.target.value,
              }))
            }
            className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Public image URL
          <input
            required
            type="url"
            value={form.backgroundImage}
            onChange={(event) => updateImageUrl(event.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
          {urlError ? (
            <span className="text-xs font-bold text-red-700 dark:text-red-200">
              {urlError}
            </span>
          ) : null}
        </label>

        <button
          type="button"
          onClick={openMediaPicker}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-4 text-sm font-black text-brand-navy transition hover:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
        >
          <ImageIcon aria-hidden="true" className="size-4" />
          Select from Media
        </button>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Image description
          <input
            required
            minLength={4}
            maxLength={240}
            value={form.backgroundAlt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                backgroundAlt: event.target.value,
              }))
            }
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Visibility
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as "draft" | "published",
              }))
            }
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <div
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-bold ${
            saveState.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : saveState.status === "saved"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown dark:border-white/10 dark:bg-white/10 dark:text-brand-sand"
          }`}
          role="status"
        >
          {saveState.status === "saved" ? (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          ) : (
            <ImageIcon aria-hidden="true" className="size-4" />
          )}
          {saveState.message}
        </div>

        <button
          disabled={saving}
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-sand dark:text-brand-navy"
        >
          {saving ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          Save Hero
        </button>
      </form>

      {mediaOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50"
        >
          <button
            type="button"
            aria-label="Close media picker backdrop"
            onClick={() => setMediaOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="absolute inset-y-0 right-0 flex h-full w-full max-w-[620px] flex-col border-l border-[#d7c5ad] bg-white text-brand-navy shadow-2xl dark:border-white/10 dark:bg-[#0d0d0d] dark:text-white">
            <header className="shrink-0 border-b border-[#d7c5ad] p-5 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
                    Media library
                  </p>
                  <h3 className="font-serif text-2xl font-black">
                    Homepage hero image
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close media picker"
                  onClick={() => setMediaOpen(false)}
                  className="grid size-9 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <section className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
                    Upload
                  </p>
                  <h4 className="mt-1 text-lg font-black">Add hero images</h4>
                  <p className="mt-1 text-xs font-semibold text-brand-brown">
                    Drop or browse multiple images. They upload one by one into
                    Media; save Hero after selecting the image to publish.
                  </p>
                </div>

                {uploadToast ? (
                  <UploadToastMessage
                    toast={uploadToast}
                    onClose={() => setUploadToast(null)}
                  />
                ) : null}

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-xs font-bold text-brand-brown">
                    Folder
                    <input
                      value={uploadFolder}
                      onChange={(event) => setUploadFolder(event.target.value)}
                      maxLength={120}
                      className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
                    />
                  </label>

                  <div
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setUploadDragOver(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setUploadDragOver(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setUploadDragOver(false);
                    }}
                    onDrop={handleUploadDrop}
                    className={`grid place-items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition ${
                      uploadDragOver
                        ? "border-brand-blue bg-brand-sky/40"
                        : "border-[#d7c5ad] bg-white dark:border-white/15 dark:bg-white/[0.04]"
                    }`}
                  >
                    <Upload aria-hidden="true" className="size-6 text-brand-blue" />
                    <p className="text-sm font-extrabold text-brand-navy dark:text-white">
                      Drop images here to queue them or
                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        className="ml-1 underline underline-offset-2 hover:text-brand-blue"
                      >
                        browse
                      </button>
                    </p>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      multiple
                      onChange={handleUploadInput}
                      className="sr-only"
                    />
                  </div>

                  {uploadItems.length > 0 ? (
                    <div className="grid gap-3 rounded-lg border border-[#d7c5ad] bg-white/75 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
                          Queue {uploadItems.length} image
                          {uploadItems.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs font-black text-brand-navy dark:text-white">
                          {uploadQueueProgress}% total
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#eadac4] dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-brand-blue transition-all"
                          style={{ width: `${uploadQueueProgress}%` }}
                        />
                      </div>
                      <ul className="grid max-h-[280px] gap-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {uploadItems.map((item) => (
                          <li
                            key={item.id}
                            className="grid min-w-0 gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-extrabold text-brand-navy dark:text-white">
                                  {item.file.name}
                                </p>
                                <p className="mt-1 text-[11px] font-bold text-brand-brown">
                                  {formatBytes(item.file.size)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeUploadItem(item.id)}
                                disabled={item.status === "uploading"}
                                className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#d7c5ad] bg-white text-brand-brown hover:text-brand-navy disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-brand-sand"
                                aria-label={`Remove ${item.file.name}`}
                              >
                                <X aria-hidden="true" className="size-3.5" />
                              </button>
                            </div>
                            <label className="grid gap-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-brown">
                              Alt text
                              <input
                                type="text"
                                value={item.altText}
                                onChange={(event) =>
                                  updateUploadItem(item.id, {
                                    altText: event.target.value,
                                  })
                                }
                                placeholder="Describe the image"
                                disabled={
                                  item.status === "uploading" ||
                                  item.status === "uploaded"
                                }
                                className="min-h-9 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white"
                              />
                            </label>
                            <div className="flex items-center justify-between gap-3">
                              <HeroUploadStatus
                                status={item.status}
                                progress={item.progress}
                                message={item.message}
                              />
                              <span className="text-[11px] font-black text-brand-brown">
                                {item.progress}%
                              </span>
                            </div>
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
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={uploading || uploadableCount === 0}
                    onClick={() => void uploadHeroQueue()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-sand dark:text-brand-navy"
                  >
                    {uploading ? (
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <Upload aria-hidden="true" className="size-4" />
                    )}
                    Upload queue {uploadableCount > 0 ? `(${uploadableCount})` : ""}
                  </button>
                </div>
              </section>

              <section className="mt-5 grid gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
                    Select
                  </p>
                  <h4 className="mt-1 text-lg font-black">Choose existing media</h4>
                </div>

                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadMedia(mediaSearch);
                  }}
                >
                  <label className="relative min-w-0">
                    <span className="sr-only">Search media</span>
                    <Search
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-brown"
                    />
                    <input
                      value={mediaSearch}
                      onChange={(event) => setMediaSearch(event.target.value)}
                      placeholder="Search media"
                      className="min-h-11 w-full rounded-lg border border-[#d7c5ad] bg-[#fffaf2] pl-10 pr-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Sort media</span>
                    <select
                      value={mediaSort}
                      onChange={(event) =>
                        setMediaSort(event.target.value as MediaSort)
                      }
                      className="min-h-11 w-full rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
                    >
                      <option value="latest">Latest</option>
                      <option value="oldest">Oldest</option>
                      <option value="az">A to Z</option>
                      <option value="za">Z to A</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-4 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
                  >
                    Search
                  </button>
                </form>

                {mediaError ? (
                  <p className="inline-flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {mediaError}
                  </p>
                ) : null}

                <div className="min-h-[320px]">
                  {mediaLoading ? (
                    <div className="grid min-h-[320px] place-items-center">
                      <Loader2 aria-hidden="true" className="size-6 animate-spin" />
                    </div>
                  ) : sortedMediaAssets.length === 0 ? (
                    <p className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-4 text-sm font-bold text-brand-brown dark:border-white/10 dark:bg-white/10">
                      No approved image media found.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {sortedMediaAssets.map((asset) => {
                        const thumbnail = isApprovedImageUrl(asset.thumbnailUrl)
                          ? asset.thumbnailUrl
                          : asset.url;

                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => selectMedia(asset)}
                            className="overflow-hidden rounded-lg border border-[#d7c5ad] bg-[#fffaf2] text-left transition hover:border-brand-blue dark:border-white/10 dark:bg-white/10"
                          >
                            <span className="relative block aspect-video bg-brand-navy/10">
                              <Image
                                src={thumbnail}
                                alt={asset.altText || asset.name}
                                fill
                                sizes="(min-width: 1024px) 290px, 50vw"
                                className="object-cover"
                              />
                            </span>
                            <span className="block p-3">
                              <span className="block truncate text-sm font-black">
                                {asset.name}
                              </span>
                              <span className="mt-1 block truncate text-xs font-bold text-brand-brown">
                                {asset.folder || "Media"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function isApprovedImageUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && APPROVED_MEDIA_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isSafeImagePreviewSrc(value: string) {
  return (value.startsWith("/") && !value.startsWith("//")) || isApprovedImageUrl(value);
}

function HeroUploadStatus({
  status,
  progress,
  message,
}: {
  status: UploadQueueItem["status"];
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
        <AlertTriangle aria-hidden="true" className="size-3.5" />
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

function UploadToastMessage({
  toast,
  onClose,
}: {
  toast: UploadToast;
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
