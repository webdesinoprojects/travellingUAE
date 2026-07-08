"use client";

import {
  CheckCircle2,
  Code2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  ImageOff,
  Link as LinkIcon,
  Loader2,
  Plus,
  Quote,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";

import type {
  AdminHajjUmrahPageContent,
  HajjUmrahHeroImage,
} from "@/types/hajj-umrah";

type HajjUmrahPageEditorProps = {
  initialContent: AdminHajjUmrahPageContent;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type UploadAuth = {
  signature: string;
  expire: number;
  token: string;
  publicKey: string;
  uploadEndpoint: string;
};

type PersistedMedia = {
  url?: string;
  secureUrl?: string;
  altText?: string | null;
};

type MediaAsset = {
  id: string;
  name: string;
  altText: string;
  folder: string;
  provider: string;
  url: string;
  thumbnailUrl: string;
  status: string;
};

type PickerTarget =
  | { kind: "hero"; index: number }
  | { kind: "markdown" };

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const APPROVED_MEDIA_HOSTS = new Set([
  "ik.imagekit.io",
  "images.unsplash.com",
  "res.cloudinary.com",
]);
const IMAGE_URL_ERROR = "Use ImageKit media or an approved image URL.";

export function HajjUmrahPageEditor({
  initialContent,
}: HajjUmrahPageEditorProps) {
  const router = useRouter();
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState(initialContent);
  const [heroImages, setHeroImages] = useState<HajjUmrahHeroImage[]>(
    normalizeHeroImages(initialContent),
  );
  const [contentMarkdown, setContentMarkdown] = useState(
    initialContent.contentMarkdown,
  );
  const [introParagraphs, setIntroParagraphs] = useState(
    initialContent.introParagraphs,
  );
  const [benefits, setBenefits] = useState(initialContent.benefits);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [message, setMessage] = useState(
    initialContent.source === "database"
      ? "Saved content is live on the public Hajj & Umrah page."
      : "Fallback content is being shown until this page is saved.",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setMessage("Saving Hajj & Umrah page content...");

    try {
      for (const image of heroImages) {
        if (!isApprovedImageUrl(image.url)) {
          throw new Error("unsupported-hero-url");
        }
      }

      const response = await fetch("/api/admin/hajj-umrah/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...content,
          heroImages,
          contentMarkdown,
          introParagraphs,
          benefits,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { content?: AdminHajjUmrahPageContent };
          }
        | null;

      if (!response.ok || payload?.ok !== true || !payload.data?.content) {
        throw new Error("save-failed");
      }

      const saved = payload.data.content;
      setContent(saved);
      setHeroImages(normalizeHeroImages(saved));
      setContentMarkdown(saved.contentMarkdown);
      setIntroParagraphs(saved.introParagraphs);
      setBenefits(saved.benefits);
      setSaveState("saved");
      setMessage("Hajj & Umrah page content saved.");
      setUrlError(null);
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error && error.message === "unsupported-hero-url"
          ? IMAGE_URL_ERROR
          : "Could not save. Check required text, ImageKit URLs, benefits, and SEO fields.",
      );
    }
  }

  function updateField<K extends keyof AdminHajjUmrahPageContent>(
    field: K,
    value: AdminHajjUmrahPageContent[K],
  ) {
    setContent((current) => ({ ...current, [field]: value }));
  }

  function updateHeroImage(index: number, patch: Partial<HajjUmrahHeroImage>) {
    setHeroImages((current) =>
      current.map((image, imageIndex) =>
        imageIndex === index ? { ...image, ...patch } : image,
      ),
    );
  }

  function handleHeroUrlChange(index: number, value: string) {
    updateHeroImage(index, { url: value });
    setUrlError(value && !isApprovedImageUrl(value) ? IMAGE_URL_ERROR : null);
  }

  function removeHeroImage(index: number) {
    setHeroImages((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((_, imageIndex) => imageIndex !== index);
    });
  }

  function addHeroImage() {
    if (heroImages.length >= 3) {
      return;
    }

    setHeroImages((current) => [
      ...current,
      { url: "", alt: "Hajj and Umrah pilgrimage image" },
    ]);
  }

  async function handleHeroUpload(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setSaveState("error");
      setMessage("Use JPEG, PNG, WEBP, AVIF, or GIF for hero images.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setSaveState("error");
      setMessage("Hero image must be 25 MB or smaller.");
      return;
    }

    const alt = heroImages[index]?.alt.trim();

    if (!alt || alt.length < 4) {
      setSaveState("error");
      setMessage("Add descriptive alt text before uploading the hero image.");
      return;
    }

    setUploadingIndex(index);
    setSaveState("idle");
    setMessage("Uploading hero image to ImageKit...");

    try {
      const auth = await fetchUploadAuth();
      const media = await uploadImageKitFile(file, auth, alt);
      const url = media.secureUrl ?? media.url;

      if (!url || !isApprovedImageUrl(url)) {
        throw new Error("missing-media-url");
      }

      updateHeroImage(index, {
        url,
        alt: media.altText?.trim() || alt,
      });
      setUrlError(null);
      setMessage(
        "Hero image uploaded to Media. Save the page to apply it, or reselect it from Media after refresh.",
      );
    } catch {
      setSaveState("error");
      setMessage("ImageKit upload failed. Check media configuration and retry.");
    } finally {
      setUploadingIndex(null);
    }
  }

  function insertMarkdown(snippet: string, selectStart = 0, selectEnd = 0) {
    const textarea = markdownRef.current;

    if (!textarea) {
      setContentMarkdown((current) => `${current}\n\n${snippet}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${contentMarkdown.slice(0, start)}${snippet}${contentMarkdown.slice(end)}`;
    setContentMarkdown(next);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + selectStart,
        start + snippet.length - selectEnd,
      );
    });
  }

  function insertMarkdownImage(url: string, alt: string) {
    if (!isApprovedImageUrl(url)) {
      setUrlError(IMAGE_URL_ERROR);
      setSaveState("error");
      setMessage(IMAGE_URL_ERROR);
      return;
    }

    insertMarkdown(`![${alt || "Hajj and Umrah image"}](${url})`);
    setUrlError(null);
  }

  function handleManualMarkdownImage() {
    const url = window.prompt("Paste an ImageKit, Unsplash, or Cloudinary image URL.");

    if (!url) {
      return;
    }

    if (!isApprovedImageUrl(url)) {
      setUrlError(IMAGE_URL_ERROR);
      setSaveState("error");
      setMessage(IMAGE_URL_ERROR);
      return;
    }

    const alt = window.prompt("Alt text for this image.")?.trim();
    insertMarkdownImage(url.trim(), alt || "Hajj and Umrah image");
  }

  function handleSelectMedia(asset: MediaAsset) {
    const url = asset.url || asset.thumbnailUrl;
    const alt = asset.altText || asset.name || "Hajj and Umrah image";

    if (!isApprovedImageUrl(url)) {
      setUrlError(IMAGE_URL_ERROR);
      setSaveState("error");
      setMessage(IMAGE_URL_ERROR);
      return;
    }

    if (pickerTarget?.kind === "hero") {
      updateHeroImage(pickerTarget.index, { url, alt });
    } else {
      insertMarkdownImage(url, alt);
    }

    setPickerTarget(null);
    setUrlError(null);
    setMessage("Media selected. Save the page to apply it.");
  }

  return (
    <>
      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
        <section className="rounded-lg border border-[#d7c5ad] bg-brand-navy p-5 text-white shadow-[0_22px_70px_rgb(7_23_57/0.16)] dark:border-white/10">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-sand">
                Hajj & Umrah CMS
              </p>
              <h1 className="mt-3 font-serif text-3xl font-black tracking-tight sm:text-4xl">
                Hajj & Umrah Page
              </h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#c2e8ff] sm:text-base">
                Edit the public page hero, rich body content, benefits, form intro,
                and SEO.
              </p>
            </div>
            <StatusMessage state={saveState} message={message} />
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
          <SectionTitle
            title="Hero"
            description="Upload up to three ImageKit hero images. Uploaded images are saved to Media. Select an image and save the page to apply it."
          />
          <div className="grid gap-3">
            {heroImages.map((image, index) => {
              const imageError =
                image.url && !isApprovedImageUrl(image.url)
                  ? IMAGE_URL_ERROR
                  : undefined;

              return (
                <div
                  key={`hero-image-${index}`}
                  className="grid gap-3 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04] lg:grid-cols-[180px_minmax(0,1fr)_auto]"
                >
                  <SafeImagePreview
                    alt={image.alt || "Hajj and Umrah hero image"}
                    src={image.url}
                    sizes="180px"
                  />

                  <div className="grid min-w-0 gap-3">
                    <TextField
                      label={`Image ${index + 1} URL`}
                      value={image.url}
                      error={imageError}
                      onChange={(value) => handleHeroUrlChange(index, value)}
                      required
                    />
                    <TextField
                      label={`Image ${index + 1} alt text`}
                      value={image.alt}
                      onChange={(value) => updateHeroImage(index, { alt: value })}
                      required
                    />
                  </div>

                  <div className="flex flex-wrap items-start gap-2 lg:flex-col">
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-black text-brand-navy transition hover:bg-[#fffaf2] dark:border-white/15 dark:bg-white/10 dark:text-white">
                      {uploadingIndex === index ? (
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <Upload aria-hidden="true" className="size-4" />
                      )}
                      Upload
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                        disabled={uploadingIndex !== null}
                        onChange={(event) => void handleHeroUpload(index, event)}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setPickerTarget({ kind: "hero", index })}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-black text-brand-navy transition hover:bg-[#fffaf2] dark:border-white/15 dark:bg-white/10 dark:text-white"
                    >
                      <ImageIcon aria-hidden="true" className="size-4" />
                      Select
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHeroImage(index)}
                      disabled={heroImages.length <= 1}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d7c5ad] px-3 text-sm font-black text-brand-brown transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addHeroImage}
            disabled={heroImages.length >= 3}
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm font-black text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add hero image
          </button>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="Hero title"
              value={content.heroTitle}
              onChange={(value) => updateField("heroTitle", value)}
              required
            />
            <TextField
              label="Breadcrumb label"
              value={content.breadcrumbLabel}
              onChange={(value) => updateField("breadcrumbLabel", value)}
            />
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
          <SectionTitle
            title="Page Content"
            description="Use the toolbar for title, heading, link, code block, image, and quote formatting."
          />
          <TextField
            label="Page heading"
            value={content.pageHeading}
            onChange={(value) => updateField("pageHeading", value)}
            required
          />
          <RichMarkdownEditor
            textareaRef={markdownRef}
            value={contentMarkdown}
            error={urlError ?? undefined}
            onChange={setContentMarkdown}
            onInsert={insertMarkdown}
            onInsertImageUrl={handleManualMarkdownImage}
            onSelectMedia={() => setPickerTarget({ kind: "markdown" })}
          />
          <TextList
            addLabel="Add benefit"
            items={benefits}
            label="Key benefits"
            rows={1}
            onChange={setBenefits}
          />
          <TextArea
            label="Closing CTA text"
            value={content.closingCtaText}
            rows={3}
            onChange={(value) => updateField("closingCtaText", value)}
            required
          />
        </section>

        <section className="grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
          <SectionTitle title="Form Copy" />
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="Form title"
              value={content.formTitle}
              onChange={(value) => updateField("formTitle", value)}
              required
            />
            <TextField
              label="Form intro"
              value={content.formIntro}
              onChange={(value) => updateField("formIntro", value)}
              required
            />
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
          <SectionTitle title="SEO" />
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="SEO title"
              value={content.seoTitle}
              onChange={(value) => updateField("seoTitle", value)}
              required
            />
            <TextField
              label="SEO description"
              value={content.seoDescription}
              onChange={(value) => updateField("seoDescription", value)}
              required
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saveState === "saving" || uploadingIndex !== null}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-sand dark:text-brand-navy"
          >
            {saveState === "saving" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            Save page
          </button>
        </div>
      </form>

      {pickerTarget ? (
        <MediaPickerDrawer
          onClose={() => setPickerTarget(null)}
          onSelect={handleSelectMedia}
        />
      ) : null}
    </>
  );
}

async function fetchUploadAuth(): Promise<UploadAuth> {
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

  if (payload?.ok !== true || !payload.data) {
    throw new Error("upload-auth-failed");
  }

  return payload.data;
}

async function uploadImageKitFile(
  file: File,
  auth: UploadAuth,
  altText: string,
): Promise<PersistedMedia> {
  const body = new FormData();
  body.append("file", file);
  body.append("fileName", file.name);
  body.append("publicKey", auth.publicKey);
  body.append("signature", auth.signature);
  body.append("expire", String(auth.expire));
  body.append("token", auth.token);
  body.append("folder", "hajj-umrah");
  body.append("useUniqueFileName", "true");

  const upload = await fetch(auth.uploadEndpoint, {
    method: "POST",
    body,
  });

  if (!upload.ok) {
    throw new Error("imagekit-upload-failed");
  }

  const uploadPayload = (await upload.json()) as { fileId?: string } | null;

  if (!uploadPayload?.fileId) {
    throw new Error("imagekit-upload-incomplete");
  }

  const persist = await fetch("/api/admin/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId: uploadPayload.fileId,
      altText,
      folder: "hajj-umrah",
    }),
  });

  if (!persist.ok) {
    throw new Error("persist-media-failed");
  }

  const persistPayload = (await persist.json()) as
    | { ok?: boolean; data?: { media?: PersistedMedia } }
    | null;

  if (persistPayload?.ok !== true || !persistPayload.data?.media) {
    throw new Error("persist-media-failed");
  }

  return persistPayload.data.media;
}

function MediaPickerDrawer({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          status: "published",
          limit: "48",
        });

        if (query.trim()) {
          params.set("q", query.trim());
        }

        const response = await fetch(`/api/admin/media?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { media?: unknown[] } }
          | null;

        if (!response.ok || payload?.ok !== true || !payload.data?.media) {
          throw new Error("media-load-failed");
        }

        if (!cancelled) {
          setAssets(payload.data.media.map(toMediaAsset).filter(isMediaAsset));
        }
      } catch {
        if (!cancelled) {
          setError("Media could not be loaded.");
          setAssets([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(() => void load(), 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/55">
      <aside className="ml-auto grid h-full w-full max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden border-l border-[#d7c5ad] bg-[#fffaf2] p-4 text-brand-navy shadow-2xl dark:border-white/10 dark:bg-[#070707] dark:text-white sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
              Media selector
            </p>
            <h2 className="mt-2 font-serif text-2xl font-black">
              Select uploaded image
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-brown">
              Uploaded images are saved to Media. Select an image and save the page
              to apply it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
            aria-label="Close media selector"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#d7c5ad] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10">
          <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all media"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
          />
        </label>

        <div className="min-h-0 overflow-y-auto pr-1">
          {loading ? (
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#d7c5ad]">
              <span className="inline-flex items-center gap-2 text-sm font-black text-brand-brown">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Loading media
              </span>
            </div>
          ) : error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : assets.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#d7c5ad] p-6 text-center">
              <div>
                <ImageOff aria-hidden="true" className="mx-auto mb-3 size-8 text-brand-brown" />
                <p className="text-sm font-black text-brand-brown">
                  No published media found.
                </p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  className="grid gap-3 rounded-lg border border-[#d7c5ad] bg-white p-3 dark:border-white/10 dark:bg-white/[0.06]"
                >
                  <SafeImagePreview
                    alt={asset.altText || asset.name}
                    src={asset.thumbnailUrl || asset.url}
                    sizes="(max-width: 768px) 100vw, 320px"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-brand-navy dark:text-white">
                      {asset.name}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-brand-brown">
                      {asset.altText || "No alt text"}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-brand-brown">
                      {asset.folder || asset.provider || "Media"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(asset)}
                    disabled={!isApprovedImageUrl(asset.url)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-navy px-3 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
                  >
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    Select
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function SafeImagePreview({
  alt,
  sizes,
  src,
}: {
  alt: string;
  sizes: string;
  src: string;
}) {
  const safe = isApprovedImageUrl(src);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#d7c5ad] bg-white dark:border-white/10 dark:bg-black/30">
      {safe ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center p-3 text-center text-brand-brown">
          <div>
            <ImageOff aria-hidden="true" className="mx-auto mb-2 size-7" />
            <p className="text-xs font-black">
              {src ? IMAGE_URL_ERROR : "No image selected"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeHeroImages(
  content: AdminHajjUmrahPageContent,
): HajjUmrahHeroImage[] {
  const images = content.heroImages.length
    ? content.heroImages
    : [{ url: content.heroImageUrl, alt: content.heroImageAlt }];

  return images.slice(0, 3).map((image) => ({
    url: image.url,
    alt: image.alt,
  }));
}

function StatusMessage({
  message,
  state,
}: {
  message: string;
  state: SaveState;
}) {
  return (
    <div
      role="status"
      className={[
        "inline-flex max-w-lg items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold",
        state === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : state === "saved"
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-white/15 bg-white/10 text-brand-sand",
      ].join(" ")}
    >
      {state === "saving" ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : state === "saved" ? (
        <CheckCircle2 aria-hidden="true" className="size-4" />
      ) : null}
      {message}
    </div>
  );
}

function SectionTitle({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-black">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm font-semibold leading-6 text-brand-brown">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function RichMarkdownEditor({
  error,
  onChange,
  onInsert,
  onInsertImageUrl,
  onSelectMedia,
  textareaRef,
  value,
}: {
  error?: string;
  onChange: (value: string) => void;
  onInsert: (snippet: string, selectStart?: number, selectEnd?: number) => void;
  onInsertImageUrl: () => void;
  onSelectMedia: () => void;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-2 dark:border-white/10 dark:bg-white/[0.04]">
        <EditorButton
          label="Title"
          icon={<Heading1 aria-hidden="true" className="size-4" />}
          onClick={() => onInsert("# Section title", 2)}
        />
        <EditorButton
          label="Heading"
          icon={<Heading2 aria-hidden="true" className="size-4" />}
          onClick={() => onInsert("## Heading", 3)}
        />
        <EditorButton
          label="Link"
          icon={<LinkIcon aria-hidden="true" className="size-4" />}
          onClick={() => onInsert("[link text](https://example.com)", 1, 22)}
        />
        <EditorButton
          label="Image URL"
          icon={<ImageIcon aria-hidden="true" className="size-4" />}
          onClick={onInsertImageUrl}
        />
        <EditorButton
          label="Select media"
          icon={<ImageIcon aria-hidden="true" className="size-4" />}
          onClick={onSelectMedia}
        />
        <EditorButton
          label="Quote"
          icon={<Quote aria-hidden="true" className="size-4" />}
          onClick={() => onInsert("> Quote text", 2)}
        />
        <EditorButton
          label="Code"
          icon={<Code2 aria-hidden="true" className="size-4" />}
          onClick={() => onInsert("```\ncode block\n```", 4, 4)}
        />
      </div>
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
        Body editor
        <textarea
          ref={textareaRef}
          value={value}
          required
          rows={12}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[320px] rounded-lg border border-[#d7c5ad] bg-white px-3 py-3 font-mono text-sm font-semibold leading-6 normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
        />
      </label>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EditorButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d7c5ad] bg-white px-3 text-xs font-black text-brand-navy transition hover:bg-brand-sand/30 dark:border-white/15 dark:bg-white/10 dark:text-white"
    >
      {icon}
      {label}
    </button>
  );
}

function TextField({
  error,
  label,
  onChange,
  required = false,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <input
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue aria-[invalid=true]:border-rose-400 dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
      {error ? (
        <span className="text-xs font-bold normal-case tracking-normal text-rose-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  onChange,
  required = false,
  rows,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  rows: number;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <textarea
        value={value}
        required={required}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-[#d7c5ad] bg-white px-3 py-2 text-sm font-semibold leading-6 normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function TextList({
  addLabel,
  items,
  label,
  onChange,
  rows,
}: {
  addLabel: string;
  items: string[];
  label: string;
  onChange: (items: string[]) => void;
  rows: number;
}) {
  function updateItem(index: number, value: string) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      onChange([""]);
      return;
    }

    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
        {label}
      </p>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={`${label}-${index}`}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <textarea
              value={item}
              rows={rows}
              onChange={(event) => updateItem(index, event.target.value)}
              className="rounded-lg border border-[#d7c5ad] bg-white px-3 py-2 text-sm font-semibold leading-6 text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d7c5ad] px-3 text-sm font-black text-brand-brown transition hover:bg-white dark:border-white/15"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm font-black text-brand-navy transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
      >
        <Plus aria-hidden="true" className="size-4" />
        {addLabel}
      </button>
    </div>
  );
}

function toMediaAsset(value: unknown): MediaAsset | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const url = typeof row.url === "string" ? row.url : "";

  if (!id || !url) {
    return null;
  }

  return {
    id,
    name: typeof row.name === "string" ? row.name : "Media asset",
    altText: typeof row.altText === "string" ? row.altText : "",
    folder: typeof row.folder === "string" ? row.folder : "",
    provider: typeof row.provider === "string" ? row.provider : "",
    url,
    thumbnailUrl:
      typeof row.thumbnailUrl === "string" ? row.thumbnailUrl : url,
    status: typeof row.status === "string" ? row.status : "published",
  };
}

function isMediaAsset(value: MediaAsset | null): value is MediaAsset {
  return value !== null;
}

function isApprovedImageUrl(value: string) {
  if (!value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && APPROVED_MEDIA_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
