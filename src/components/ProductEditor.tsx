import SafeImage from "./SafeImage";
import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  ImagePlus,
  Plus,
  Box,
  ArrowLeft,
  ArrowRight,
  X,
  Eye,
  Save,
  LoaderCircle,
  LockKeyhole,
  CheckCircle2,
  Circle,
  Upload,
  ChevronDown,
  Crop,
} from "lucide-react";
import type { Product, Category, ProductImage } from "../lib/types";
import { uploadImage, validateProduct, cleanupAbandonedImages, type ProductModelChange } from "../lib/catalog";
import Modal from "./Modal";
import AvailabilityPicker from "./AvailabilityPicker";
import EditorCategoryPicker from "./EditorCategoryPicker";
import ProductModelEditor from "./ProductModelEditor";
import PublicCatalog from "./PublicCatalog";
import ProductPrice from "./ProductPrice";
import { nextProductId } from "../lib/product-ids";
import { cmToUnit, unitToCm, unitMax, type DimensionUnit } from "../lib/dimensions";
import DimensionUnitPicker from "./DimensionUnitPicker";
import PhotoCropEditor from "./PhotoCropEditor";
import AlbumLibrary from "./AlbumLibrary";
import { albumPhotoToProductImage, type AlbumPhoto } from "../lib/album";
import { photoCropStyle } from "../lib/photo-crop";
import { splitSpecifications } from "../lib/specification-groups";

export type CatalogEditorNavigation = "overview" | "products" | "categories" | "users" | "activity" | "catalog";
export default function ProductEditor({
  product,
  categories,
  existingProducts,
  isNewProduct,
  orderingEnabled = false,
  modelEditingEnabled = false,
  onNavigate,
  onSave,
  onClose,
}: {
  product: Product;
  categories: Category[];
  existingProducts: Product[];
  isNewProduct: boolean;
  orderingEnabled?: boolean;
  modelEditingEnabled?: boolean;
  showCategories?: boolean;
  showUsers?: boolean;
  productCount?: number;
  onNavigate: (target: CatalogEditorNavigation) => void;
  onSave: (p: Product, modelChange?: ProductModelChange, autoProductId?: boolean) => Promise<Product | void>;
  onClose: (warning?: string) => void;
}) {
  const [draft, setDraft] = useState<Product>(() => ({
    ...structuredClone(product),
    sku: isNewProduct ? nextProductId(product.categoryId, categories, existingProducts) : product.sku,
  }));
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>("cm");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  useEffect(() => {
    if (!showLivePreview) return;
    // Nested native dialogs can inherit the editor's scrolled Save/footer position.
    // Reset after showModal() has mounted the preview on the top layer.
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLDialogElement>("dialog.catalog-private-preview-dialog")
        ?.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [showLivePreview]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [show3DTools, setShow3DTools] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [modelPending, setModelPending] = useState(false);
  const [modelInvalid, setModelInvalid] = useState(false);
  const [modelDirty, setModelDirty] = useState(false);
  const modelChange = useRef<ProductModelChange | undefined>(undefined);
  const modelLocked = useRef(false);
  const setModelChange = useCallback((change: ProductModelChange | undefined) => {
    modelChange.current = change;
    setModelDirty(change !== undefined);
  }, []);
  const setModelLoading = useCallback((pending: boolean, invalid = false) => {
    modelLocked.current = pending || invalid;
    setModelPending(pending);
    setModelInvalid(invalid);
  }, []);
  const isEditing = Boolean(product.name);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const uploadedImages = useRef(new Map<string, ProductImage>());
  const mounted = useRef(true);
  const closing = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const uploads = uploadedImages.current;
    return () => {
      mounted.current = false;
      const abandoned = [...uploads.values()];
      uploads.clear();
      // Unexpected navigation/unmount is best effort; server authorization and
      // references still govern cleanup. Never use an unconditional deletion.
      if (abandoned.length) void cleanupAbandonedImages(abandoned);
    };
  }, []);
  const update = <K extends keyof Product>(key: K, value: Product[K]) =>
    setDraft((p) => ({ ...p, [key]: value }));
  const addSpecificationRow = (sectionId?: string) =>
    setDraft((current) => {
      const specifications = [...(current.specifications ?? [])];
      if (specifications.length >= 24) return current;
      const row = { id: crypto.randomUUID(), name: "", value: "" };
      const startOfSection = sectionId
        ? specifications.findIndex(item => item.id === sectionId && item.kind === "section")
        : -1;
      if (sectionId && startOfSection < 0) return current;
      const nextSection = specifications.findIndex(
        (item, index) => index > startOfSection && item.kind === "section",
      );
      const index = nextSection < 0 ? specifications.length : nextSection;
      specifications.splice(index, 0, row);
      return { ...current, specifications };
    });
  const addSpecificationSection = () =>
    setDraft(current => {
      if ((current.specifications ?? []).length > 22) return current;
      return {
        ...current,
        specifications: [
          ...(current.specifications ?? []),
          { id: crypto.randomUUID(), name: "", value: "", kind: "section" },
          { id: crypto.randomUUID(), name: "", value: "" },
        ],
      };
    });
  const removeSpecificationSection = (sectionId: string) => {
    const specifications = draft.specifications ?? [];
    const start = specifications.findIndex(item => item.id === sectionId && item.kind === "section");
    if (start < 0) return;
    const next = specifications.findIndex((item, index) => index > start && item.kind === "section");
    const end = next < 0 ? specifications.length : next;
    const members = specifications.slice(start, end);
    if (members.some(item => item.value.trim() || (item.kind !== "section" && item.name.trim())) &&
        !window.confirm("Remove this section and all its rows? This cannot be undone after saving.")) return;
    setDraft(current => ({
      ...current,
      specifications: (current.specifications ?? []).filter(
        item => !members.some(member => member.id === item.id),
      ),
    }));
  };
  const { primary: primarySpecificationRows, sections: specificationSections } =
    splitSpecifications(draft.specifications);
  const changeSpecification = (id: string, field: "name" | "value", value: string) =>
    setDraft((current) => ({
      ...current,
      specifications: (current.specifications ?? []).map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    }));
  const removeSpecification = (id: string) =>
    setDraft((current) => ({
      ...current,
      specifications: (current.specifications ?? []).filter((row) => row.id !== id),
    }));
  async function commit(status: Product["status"] = draft.status) {
    if (uploadLock.current || modelLocked.current || busy) return;
    if (status === "draft" && product.status === "published" && !window.confirm("Saving as draft will unpublish this product from the public catalogue. Continue?")) return;
    setError("");
    try {
      validateProduct({ ...draft, status });
      setBusy(true);
      const saved = await onSave({ ...draft, sku: isNewProduct ? draft.sku : product.sku, status, updatedAt: new Date().toISOString() }, modelChange.current, isNewProduct);
      const retained = new Set((saved?.images ?? draft.images).map(image => image.url));
      const abandoned = [...uploadedImages.current.values()].filter(image => !retained.has(image.url));
      const cleanup = await cleanupAbandonedImages(abandoned);
      uploadedImages.current.clear();
      if (mounted.current) onClose(cleanup.cleanupWarning);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save product. Please try again.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void commit();
  }
  async function addImages(files: FileList | null) {
    if (!files || uploadLock.current || busy) return;
    const selected = Array.from(files);
    setError("");
    if (draft.images.length + selected.length > 8) {
      setError("Add up to 8 images per product.");
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    try {
      // Append each successful upload to current state. Edits, removals and
      // ordering changes made while the request is pending cannot be undone.
      for (const file of selected) {
        const image = await uploadImage(file);
        if (!mounted.current) {
          await cleanupAbandonedImages([image]);
          break;
        }
        uploadedImages.current.set(image.id, image);
        setDraft(current => ({ ...current, images: [...current.images, image] }));
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      uploadLock.current = false;
      if (mounted.current) setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function requestClose(next?: CatalogEditorNavigation) {
    if (busy || uploading || uploadLock.current || closing.current) return;
    if ((modelDirty || modelLocked.current || JSON.stringify(draft) !== JSON.stringify(product)) && !window.confirm('Discard your unsaved product changes?')) return;
    closing.current = true;
    setBusy(true);
    const abandoned = [...uploadedImages.current.values()];
    const result = await cleanupAbandonedImages(abandoned);
    uploadedImages.current.clear();
    if (mounted.current) {
      onClose(result.cleanupWarning);
      if (next) onNavigate(next);
    }
    closing.current = false;
    if (mounted.current) setBusy(false);
  }
  function move(index: number, step: number) {
    const images = [...draft.images];
    [images[index], images[index + step]] = [
      images[index + step],
      images[index],
    ];
    update("images", images);
  }
  const publishChecks = [
    { label: "Name, Product ID & category", done: draft.name.trim().length >= 2 && !!draft.sku.trim() && !!draft.categoryId },
    { label: "Cover photo", done: draft.images.length > 0 },
    { label: "Description & materials", done: !!draft.description.trim() && !!draft.materials.trim() },
    { label: "All dimensions", done: draft.width > 0 && draft.depth > 0 && draft.height > 0 },
  ];
  const readyCount = publishChecks.filter((item) => item.done).length;
  function jumpTo(id: string) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
  }
  const UploadIcon = isEditing ? Upload : ImagePlus;
  const cover = draft.images[0];
  const previewDescription = draft.description || (isEditing ? "" : "Your thoughtful product story will appear here.");
  const previewCard = (
    <article className="editor-preview">
      {isEditing && <div className="catalog-reference-preview-switch" aria-label="Customer preview format">
        <span className="is-active"><ImagePlus size={14} aria-hidden="true" /> Photo</span>
        <span className="is-disabled" aria-label="3D preview currently unavailable"><Box size={14} aria-hidden="true" /> 3D</span>
      </div>}
      {cover ? (
        <SafeImage key={cover.url} src={cover.url} alt={cover.alt || draft.name} />
      ) : (
        <div className="preview-placeholder">
          <ImagePlus aria-hidden="true" />
          {isEditing && <span>No cover photo</span>}
        </div>
      )}
      {isEditing && <span className="catalog-editor-media-caption">{product.model ? "ORIGINAL PHOTO · 3D MODEL AVAILABLE" : "ORIGINAL PHOTO · 3D NOT YET AVAILABLE"}</span>}
      <span className="eyebrow">
        {categories.find((category) => category.id === draft.categoryId)?.name || "Your category"}
      </span>
      <h3>{draft.name || "Your product name"}</h3>
      <p>
        <ProductPrice product={draft} surface="editor" />
      </p>
      {previewDescription && <p className="preview-description tiny muted">{previewDescription}</p>}
    </article>
  );
  const publishingControls = (
    <>
            <div className="product-editor-aside-heading" id={!isEditing ? "product-editor-publish" : undefined}>
              <span className="product-editor-step">04</span>
              <div>
                <h3>Publishing</h3>
                <p>Control how this product appears in the catalogue.</p>
              </div>
            </div>
            <section className="form-section product-editor-publish-fields">
              <h3 className="product-editor-minor-heading">Visibility & availability</h3>
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(e) =>
                    update("status", e.target.value as Product["status"])
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <p className="tiny muted">
                Only published products appear in the public catalog.
              </p>
              <label>
                Availability
                <select
                  value={draft.availability}
                  onChange={(e) =>
                    update(
                      "availability",
                      e.target.value as Product["availability"],
                    )
                  }
                >
                  <option value="available">Available</option>
                  <option value="made-to-order">Made to order</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
              {orderingEnabled && (
                <label>
                  Display order <span className="product-editor-publish-hint">Lower numbers appear first</span>
                  <input
                    aria-label="Display order"
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    value={draft.displayOrder ?? 0}
                    onChange={(e) => update("displayOrder", Number(e.target.value))}
                  />
                </label>
              )}
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => update("featured", e.target.checked)}
                />
                <span>
                  Feature this product
                  <small>Give it a place in the spotlight.</small>
                </span>
              </label>
              <label className="checkbox-field" title="Only published products selected here appear in Best-Selling Furniture.">
                <input
                  type="checkbox"
                  checked={draft.bestSelling === true}
                  onChange={(e) => update("bestSelling", e.target.checked)}
                />
                <span>
                  Best Selling
                  <small>Display this product in the public Best-Selling Furniture gallery once Published. Separate from Featured.</small>
                </span>
              </label>
            </section>
            <section className="product-editor-readiness" aria-label="Publishing checklist">
              <div className="product-editor-readiness-top">
                <h3>Publishing checklist</h3>
                <span>{readyCount} of {publishChecks.length}</span>
              </div>
              <div className="product-editor-readiness-track" role="progressbar"
                aria-label="Publishing checklist completion" aria-valuenow={readyCount}
                aria-valuemin={0} aria-valuemax={publishChecks.length}>
                <span style={{ width: `${readyCount / publishChecks.length * 100}%` }} />
              </div>
              <ul>
                {publishChecks.map((item) => (
                  <li className={item.done ? "is-complete" : ""} key={item.label}>
                    {item.done ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                    {item.label}
                  </li>
                ))}
              </ul>
              <p>Drafts only need a name, Product ID and category.</p>
            </section>
            <section className="editor-note">
              <span className="eyebrow">GOOD TO KNOW</span>
              <h3>Drafts stay private</h3>
              <p>Save now and finish the listing later. Only published products appear in the public catalogue.</p>
            </section>
    </>
  );
  return (
    <Modal
      title={isEditing ? "Edit product" : "Create product"}
      wide
      className={isEditing ? "product-editor-dialog product-editor-dialog--editing" : "product-editor-dialog"}
      onClose={() => void requestClose()}
    >
      <form onSubmit={submit} className="editor-form product-editor-v2">
        {isEditing && (
          <header className="catalog-editor-actionbar" aria-label="Product editor actions">
            <div className="catalog-editor-actionbar-identity">
              <button
                type="button"
                className="catalog-editor-back catalog-editor-back-icon"
                aria-label="Back to products"
                title="Back to products"
                onClick={() => void requestClose()}
              >
                <ArrowLeft size={19} aria-hidden="true" />
              </button>
              <div className="catalog-editor-header-title">
                <span className="catalog-editor-header-eyebrow">BRUTTI CATALOG / PRODUCT EDITOR</span>
                <strong title={draft.name}>{draft.name || "Untitled product"}</strong>
              </div>
            </div>
            <div className="catalog-editor-header-meta" aria-label="Product information">
              <span className="catalog-editor-header-sku">{draft.sku || "New product"}</span>
              <span className={`catalog-editor-header-status catalog-editor-header-status--${draft.status}`}>
                {draft.status === "published" ? "Published" : draft.status === "archived" ? "Archived" : "Draft"}
              </span>
            </div>
          </header>
        )}
        <div className="product-editor-intro">
          <div>
            <span className="product-editor-kicker">PRODUCT WORKSPACE</span>
            <p>
              {isEditing
                ? "Update the product details and check the preview before saving."
                : "Complete the essentials, then save a draft or prepare the product for publishing."}
            </p>
          </div>
          <span className={`product-editor-state product-editor-state--${draft.status}`}>
            {draft.status === "published" ? "Published" : draft.status === "archived" ? "Archived" : "Draft"}
          </span>
        </div>
        <nav className="product-editor-jump" aria-label="Jump to form section">
          <button type="button" onClick={() => jumpTo("product-editor-basics")}>
            <span className="product-editor-jump-number" aria-hidden="true">01</span>
            <span>Essentials</span>
          </button>
          <button type="button" onClick={() => jumpTo("product-editor-photos")}>
            <span className="product-editor-jump-number" aria-hidden="true">02</span>
            <span>Photos</span>
          </button>
          <button type="button" onClick={() => jumpTo("product-editor-specs")}>
            <span className="product-editor-jump-number" aria-hidden="true">03</span>
            <span>Specifications</span>
          </button>
          <button type="button" onClick={() => jumpTo("product-editor-publish")}>
            <span className="product-editor-jump-number" aria-hidden="true">04</span>
            <span>Publishing</span>
          </button>
        </nav>
        <div className="editor-columns">
          <div className="editor-primary">
            <section className="form-section product-editor-section" id="product-editor-basics">
              <div className="product-editor-section-heading">
                <span className="product-editor-step">01</span>
                <div>
                  <h3>Details</h3>
                  <p>Name, product code, category and description.</p>
                </div>
              </div>
              <label>
                Name <span aria-hidden="true">*</span>
                <input
                  required
                  maxLength={120}
                  value={draft.name}
                  placeholder="e.g. Kaanagan Open Concept Wardrobe"
                  onChange={(e) => update("name", e.target.value)}
                />
              </label>
              <div className="field-pair">
                <div className="catalog-product-id-field">
                  <span className="catalog-product-id-label" id="catalog-product-id-label">
                    Product ID <span aria-hidden="true">*</span>
                  </span>
                  <output
                    className="catalog-product-id-display"
                    aria-labelledby="catalog-product-id-label"
                    title="Product ID is system-managed and cannot be edited"
                  >
                    <span className="catalog-product-id-value">
                      {(isNewProduct ? draft.sku : product.sku) || "Choose a category to generate ID"}
                    </span>
                    <LockKeyhole size={16} strokeWidth={1.8} aria-hidden="true" />
                  </output>
                  <small className="catalog-product-id-help">
                    {isNewProduct ? "Generated automatically · final ID confirmed on Save" : "Assigned Product ID · cannot be changed"}
                  </small>
                </div>
                <div className="catalog-editor-category-field">
                  <span className="catalog-editor-category-label">Category <span aria-hidden="true">*</span></span>
                  <EditorCategoryPicker
                    categories={categories}
                    value={draft.categoryId}
                    onChange={value => setDraft(current => ({
                      ...current,
                      categoryId: value,
                      sku: isNewProduct ? nextProductId(value, categories, existingProducts) : current.sku,
                    }))}
                    disabled={busy || uploading}
                  />
                </div>
              </div>
              <label>
                Description <span className="product-editor-publish-hint">Required to publish</span>
                <textarea
                  aria-label="Description"
                  rows={4}
                  maxLength={10000}
                  value={draft.description}
                  placeholder="Tell the story, the details, and what makes it special."
                  onChange={(e) => update("description", e.target.value)}
                />
              </label>
            </section>
            <section className="form-section product-editor-section" id="product-editor-photos">
              <div className="product-editor-section-heading">
                <span className="product-editor-step">02</span>
                <div>
                  <h3>Photos <span className="product-editor-photo-count">{draft.images.length}/8</span></h3>
                  <p>First photo is the cover · add up to 8 images.</p>
                  {isEditing && <button type="button" className="catalog-reference-manage-photos" onClick={() => setShowPhotoOptions(value => !value)}>{showPhotoOptions ? "Hide photo options" : "Manage photos"}</button>}
                </div>
              </div>
              <div className="brutti-album-editor-toolbar">
                <button type="button" onClick={() => setShowAlbumPicker(true)}
                  disabled={busy || uploading || draft.images.length >= 8}>
                  <ImagePlus size={17} aria-hidden="true" /> Choose from Album
                </button>
                <span>Reuse saved Brutti photos without uploading them again.</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={uploading || busy}
                onChange={(e) => void addImages(e.target.files)}
              />
              <button
                type="button"
                className={`upload-zone ${dragging ? "is-dragging" : ""}`}
                aria-label="Add product photos"
                disabled={uploading || busy || draft.images.length >= 8}
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); if (!busy && !uploading) setDragging(true); }}
                onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (!busy && !uploading) void addImages(event.dataTransfer.files);
                }}
              >
                {uploading ? <LoaderCircle className="spin" /> : <UploadIcon size={27} />}
                <strong>
                  {uploading
                    ? "Uploading photos…"
                    : draft.images.length >= 8
                      ? "Maximum 8 photos added"
                      : isEditing ? "Drop photos or click to upload" : "Add product photos"}
                </strong>
                <span>{isEditing ? "JPG, PNG or WebP" : "Choose files or drag photos here · JPG, PNG, WebP"}</span>
              </button>
              <div className={`image-editor-grid ${isEditing && showPhotoOptions ? "is-managing-photos" : ""}`}>
                {draft.images.map((img, index) => (
                  <div className="image-editor-item" key={img.id}>
                    <div className="image-editor-photo">
                      <SafeImage src={img.url} alt={img.alt || draft.name} style={photoCropStyle(img)} />
                      {index === 0 && <span>Cover</span>}
                      <button
                        type="button"
                        className="image-remove"
                        aria-label={`Remove image ${index + 1}`}
                        onClick={() =>
                          update(
                            "images",
                            draft.images.filter((i) => i.id !== img.id),
                          )
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="catalog-photo-crop-open"
                      aria-label={`Adjust crop, position and zoom for photo ${index + 1}`}
                      disabled={busy || uploading}
                      onClick={() => setEditingPhotoId(img.id)}
                    >
                      <Crop size={14} aria-hidden="true" /> Adjust image
                    </button>
                    <input
                      aria-label={`Image ${index + 1} description`}
                      placeholder="Image description"
                      value={img.alt}
                      onChange={(e) =>
                        update(
                          "images",
                          draft.images.map((i) =>
                            i.id === img.id ? { ...i, alt: e.target.value } : i,
                          ),
                        )
                      }
                    />
                    <div className="image-order">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`Move image ${index + 1} earlier`}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <span>
                        {index + 1} of {draft.images.length}
                      </span>
                      <button
                        type="button"
                        disabled={index === draft.images.length - 1}
                        aria-label={`Move image ${index + 1} later`}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="tiny muted">
                Use Adjust image to crop, drag and zoom how customers see each photo. The original upload stays intact.
              </p>
              {isEditing && (
                <section className="catalog-photo-model-inline" aria-label="3D model management">
                  <button
                    type="button"
                    className="catalog-photo-model-toggle"
                    aria-expanded={show3DTools}
                    onClick={() => setShow3DTools(open => !open)}
                  >
                    <Box size={18} aria-hidden="true" />
                    <span><strong>3D model</strong><small>{product.model ? "Model on file" : "Not yet available · optional"}</small></span>
                    <ChevronDown size={17} aria-hidden="true" />
                  </button>
                  {show3DTools && (
                    <div className="catalog-photo-model-content">
                      <p>Photo-to-3D generation is paused. Manage existing approved 3D files here; original photos remain unchanged.</p>
                      <ProductModelEditor
                        productName={draft.name || "this product"}
                        productId={product.id}
                        saved={isEditing}
                        status={draft.status}
                        model={product.model}
                        photos={draft.images}
                        savedPhotoIds={product.images.map(image => image.id)}
                        modelEnabled={modelEditingEnabled}
                        poster={cover?.url}
                        disabled={busy}
                        onChange={setModelChange}
                        onPending={setModelLoading}
                      />
                    </div>
                  )}
                </section>
              )}
            </section>
            {isEditing ? (

            <section className="form-section product-editor-section catalog-reference-specifications" id="product-editor-specs">
              <div className="product-editor-section-heading">
                <span className="product-editor-step">03</span>
                <div>
                  <h3>Specifications</h3>
                  <p>Measurements, materials and finishing details.</p>
                </div>
              </div>
              <div className="catalog-reference-spec-rows">
                <div className="catalog-reference-spec-row">
                  <span className="catalog-reference-spec-key">Dimensions <small>Overall size</small></span>
                  <div className="catalog-reference-dimension-inputs catalog-unified-dimensions" role="group" aria-label="Product dimensions">
                    {(["width", "depth", "height"] as const).map((key) => (
                      <label key={key}>
                        <span>{key === "width" ? "Width" : key === "depth" ? "Depth" : "Height"}</span>
                        <input
                          aria-label={`${key} in ${dimensionUnit}`}
                          type="number"
                          min={0}
                          max={unitMax(dimensionUnit)}
                          step="any"
                          value={cmToUnit(draft[key], dimensionUnit)}
                          onChange={(e) => update(key, unitToCm(Number(e.target.value), dimensionUnit))}
                        />
                      </label>
                    ))}
                    <DimensionUnitPicker value={dimensionUnit} onChange={setDimensionUnit} disabled={busy || uploading} />
                  </div>
                </div>
                <label className="catalog-reference-spec-row">
                  <span className="catalog-reference-spec-key">Materials <small>Primary materials</small></span>
                  <input
                    aria-label="Materials"
                    maxLength={2000}
                    value={draft.materials}
                    placeholder="e.g. Walnut veneer, timber, brass"
                    onChange={(e) => update("materials", e.target.value)}
                  />
                </label>
                <div className="catalog-reference-spec-row catalog-reference-pricing-row">
                  <span className="catalog-reference-spec-key">Pricing <small>In Malaysian Ringgit</small></span>
                  <div className="catalog-pricing-fields">
                    <label className="catalog-pricing-field">
                      <span>{draft.priceBasis === "starting-from" ? "Starting price (RM)" : "Current price (RM)"}</span>
                      <div className="catalog-reference-price-field">
                        <span>RM</span>
                        <input
                          aria-label="Current price in MYR"
                          type="number"
                          min={0}
                          max={9999999999.99}
                          step="0.01"
                          value={draft.price ?? ""}
                          placeholder="Price on enquiry"
                          onChange={(e) => update("price", e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </div>
                    </label>
                    <label className="catalog-pricing-field">
                      <span>Original price <em>Optional</em></span>
                      <div className="catalog-reference-price-field">
                        <span>RM</span>
                        <input
                          aria-label="Original price before discount in MYR"
                          type="number"
                          min={0}
                          max={9999999999.99}
                          step="0.01"
                          value={draft.originalPrice ?? ""}
                          placeholder="No discount"
                          onChange={(e) => update("originalPrice", e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </div>
                    </label>
                  </div>
                </div>
                <div className="catalog-reference-spec-row">
                  <span className="catalog-reference-spec-key" id="catalog-spec-availability-label">Availability <small>Customer-facing status</small></span>
                  <AvailabilityPicker
                    value={draft.availability}
                    onChange={(next) => update("availability", next)}
                    disabled={busy}
                  />
                </div>
              </div>
              <div className="catalog-spec-base-rows">
              {primarySpecificationRows.map((row, index) => (
                <div className="catalog-reference-custom-row" key={row.id}>
                  <input
                    aria-label={`Additional detail ${index + 1} name`}
                    placeholder="e.g. Drawer dimensions"
                    maxLength={80}
                    value={row.name}
                    onChange={(event) => changeSpecification(row.id, "name", event.target.value)}
                  />
                  <input
                    aria-label={`Additional detail ${index + 1} value`}
                    placeholder="e.g. W 3ft × D 1.8ft × H 2ft"
                    maxLength={400}
                    value={row.value}
                    onChange={(event) => changeSpecification(row.id, "value", event.target.value)}
                  />
                  <button
                    type="button"
                    className="catalog-reference-remove-row"
                    aria-label={`Remove detail ${row.name || index + 1}`}
                    title="Remove row"
                    onClick={() => removeSpecification(row.id)}
                  ><X size={17} aria-hidden="true" /></button>
                </div>
              ))}
              <button
                type="button"
                className="catalog-reference-add-row"
                disabled={(draft.specifications ?? []).length >= 24 || busy}
                onClick={() => addSpecificationRow()}
              >
                <Plus size={17} aria-hidden="true" /> Add row
              </button>
              </div>
              <div className="catalog-spec-extra-heading">
                <div>
                  <h4>Additional details</h4>
                  <p>Organise components, drawer dimensions and finishes in separate specification sections.</p>
                </div>
                <span className="catalog-spec-extra-count">{(draft.specifications ?? []).length} / 24</span>
              </div>
              {specificationSections.map((section, index) => (
                <div className="catalog-spec-new-section" key={section.id}>
                  <div className="catalog-spec-new-section-heading">
                    <span className="catalog-spec-section-num">{String(index + 2).padStart(2, "0")}</span>
                    <label>
                      <span>Specification section title</span>
                      <input
                        aria-label={`Section ${index + 2} title`}
                        type="text"
                        maxLength={80}
                        placeholder="e.g. Pipe Rack or Drawer × 2"
                        value={section.title}
                        onChange={event => changeSpecification(section.id, "name", event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="catalog-spec-remove-section"
                      aria-label={`Remove section ${section.title || index + 2} and all its rows`}
                      title="Remove section"
                      onClick={() => removeSpecificationSection(section.id)}
                    ><X size={17} aria-hidden="true" /></button>
                  </div>
                  <div className="catalog-spec-new-section-rows">
                    {section.rows.map((row, rowIndex) => (
                      <div className="catalog-reference-custom-row" key={row.id}>
                        <input
                          aria-label={`Section ${index + 2} row ${rowIndex + 1} name`}
                          placeholder="e.g. Finishing"
                          maxLength={80}
                          value={row.name}
                          onChange={event => changeSpecification(row.id, "name", event.target.value)}
                        />
                        <input
                          aria-label={`Section ${index + 2} row ${rowIndex + 1} value`}
                          placeholder="e.g. Clear satin finishing"
                          maxLength={400}
                          value={row.value}
                          onChange={event => changeSpecification(row.id, "value", event.target.value)}
                        />
                        <button
                          type="button"
                          className="catalog-reference-remove-row"
                          aria-label={`Remove row ${row.name || rowIndex + 1}`}
                          title="Remove row"
                          onClick={() => removeSpecification(row.id)}
                        ><X size={17} aria-hidden="true" /></button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="catalog-reference-add-row"
                    disabled={(draft.specifications ?? []).length >= 24 || busy}
                    onClick={() => addSpecificationRow(section.id)}
                  >
                    <Plus size={17} aria-hidden="true" /> Add row
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="catalog-spec-add-section"
                disabled={(draft.specifications ?? []).length > 22 || busy}
                onClick={addSpecificationSection}
              >
                <Plus size={17} aria-hidden="true" /> Add specification
                <span>New section</span>
              </button>
            </section>
            ) : (
            <section className="form-section product-editor-section" id="product-editor-specs">
              <div className="product-editor-section-heading">
                <span className="product-editor-step">03</span>
                <div>
                  <h3>Specifications</h3>
                  <p>Materials, measurements and pricing.</p>
                </div>
              </div>
              <label>
                Materials <span className="product-editor-publish-hint">Required to publish</span>
                <input
                  aria-label="Materials"
                  maxLength={2000}
                  value={draft.materials}
                  placeholder="e.g. Reclaimed timber, natural oil finish"
                  onChange={(e) => update("materials", e.target.value)}
                />
              </label>
              <div className="section-label">
                Dimensions <span className="muted">Required to publish</span>
              </div>
              <div className="field-trio catalog-unified-dimensions" role="group" aria-label="Product dimensions">
                {(["width", "depth", "height"] as const).map((key) => (
                  <label key={key}>
                    <span>{key === "width" ? "Width" : key === "depth" ? "Depth" : "Height"}</span>
                    <input
                      aria-label={`${key} in ${dimensionUnit}`}
                      type="number"
                      min={0}
                      max={unitMax(dimensionUnit)}
                      step="any"
                      value={cmToUnit(draft[key], dimensionUnit)}
                      onChange={(e) => update(key, unitToCm(Number(e.target.value), dimensionUnit))}
                    />
                  </label>
                ))}
                <DimensionUnitPicker value={dimensionUnit} onChange={setDimensionUnit} disabled={busy || uploading} />
              </div>
              <div className="catalog-new-pricing-fields" role="group" aria-label="Product pricing">
                <label className="catalog-pricing-field">
                  <span>{draft.priceBasis === "starting-from" ? "Starting price" : "Current price"} <em>RM</em></span>
                  <div className="price-input">
                    <span>RM</span>
                    <input
                      aria-label="Current price in MYR"
                      type="number"
                      min={0}
                      max={9999999999.99}
                      step="0.01"
                      value={draft.price ?? ""}
                      placeholder="Price on enquiry"
                      onChange={(e) => update("price", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </div>
                </label>
                <label className="catalog-pricing-field">
                  <span>Original price <em>Optional · RM</em></span>
                  <div className="price-input">
                    <span>RM</span>
                    <input
                      aria-label="Original price before discount in MYR"
                      type="number"
                      min={0}
                      max={9999999999.99}
                      step="0.01"
                      value={draft.originalPrice ?? ""}
                      placeholder="No discount"
                      onChange={(e) => update("originalPrice", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </div>
                </label>
              </div>
              <p className="catalog-pricing-hint">Add an original price higher than the current price to show a discount in the catalog.</p>
            </section>
            )}



          </div>
          {!isEditing && (
            <aside className="editor-side product-editor-aside">
              <section className="product-editor-deferred" id="product-editor-model" aria-label="3D model manager">
                <button
                  type="button"
                  className="product-editor-deferred-toggle"
                  aria-expanded={show3DTools}
                  aria-controls="product-editor-deferred-content"
                  onClick={() => setShow3DTools(value => !value)}
                >
                  <span><strong>3D model</strong><small>{product.model ? "Model available" : "No 3D model"}</small></span>
                  <ChevronDown size={17} aria-hidden="true" />
                </button>
                {show3DTools && (
                  <div id="product-editor-deferred-content">
                    <p className="product-editor-deferred-note">3D generation is paused while we refine the catalog. Existing model files can still be reviewed or managed here.</p>
                    <ProductModelEditor productName={draft.name || "this product"} productId={product.id} saved={isEditing} status={draft.status} model={product.model}
                      photos={draft.images} savedPhotoIds={product.images.map(image => image.id)} modelEnabled={modelEditingEnabled} poster={cover?.url} disabled={busy}
                      onChange={setModelChange} onPending={setModelLoading} />
                  </div>
                )}
              </section>
              {publishingControls}
              <button type="button" className="button secondary full" aria-expanded={preview} onClick={() => setPreview(open => !open)}>
                <Eye size={16} /> {preview ? "Hide preview" : "Preview product"}
              </button>
              {preview && previewCard}
            </aside>
          )}
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <footer className="editor-footer">
          <span className="tiny muted">
            Changes are saved when you select Save.
          </span>
          <div className="button-row">
            <button
              className="button secondary"
              type="button"
              disabled={busy || uploading}
              onClick={() => void requestClose()}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || uploading || modelPending || modelInvalid}
              type="submit"
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}{" "}
              {busy ? "Saving…" : "Save product"}
            </button>
            {isEditing && (
              <button
                type="button"
                className="button secondary catalog-editor-footer-view-live"
                disabled={busy || uploading}
                onClick={() => setShowLivePreview(true)}
                title="Preview how this product will look in the public catalog without publishing"
              >
                <Eye size={16} aria-hidden="true" /> View live
              </button>
            )}
          </div>
        </footer>
      </form>
      {editingPhotoId && draft.images.some(image => image.id === editingPhotoId) && (
        <PhotoCropEditor
          key={editingPhotoId}
          image={draft.images.find(image => image.id === editingPhotoId)!}
          onClose={() => setEditingPhotoId(null)}
          onApply={crop => {
            setDraft(current => ({
              ...current,
              images: current.images.map(image =>
                image.id === editingPhotoId
                  ? { ...image, crop }
                  : image,
              ),
            }));
            setEditingPhotoId(null);
          }}
        />
      )}
      {showAlbumPicker && (
        <Modal title="Choose from Album" eyebrow="BRUTTI / MEDIA LIBRARY"
          className="brutti-album-picker-dialog" onClose={() => setShowAlbumPicker(false)}>
          <AlbumLibrary
            products={existingProducts}
            categories={categories}
            maxSelect={8 - draft.images.length}
            excludedUrls={draft.images.map(image => image.url)}
            onClose={() => setShowAlbumPicker(false)}
            onSelect={(photos: AlbumPhoto[]) => {
              const existing=new Set(draft.images.map(image=>image.url));
              const images=photos.filter(photo=>!existing.has(photo.url))
                .slice(0,Math.max(0,8-draft.images.length))
                .map(albumPhotoToProductImage);
              if(!images.length) {
                setError("Those photos have already been added to this product.");
                return;
              }
              setDraft(current => ({
                ...current,
                images:[...current.images,...images].slice(0,8),
              }));
              setError("");
              setShowAlbumPicker(false);
            }}
          />
        </Modal>
      )}
      {showLivePreview && (
        <Modal
          title="Private catalog preview"
          wide
          className="catalog-private-preview-dialog"
          onClose={() => setShowLivePreview(false)}
        >
          <div className="catalog-private-preview-note" role="status">
            Previewing your current edits. Nothing is published or saved by opening this preview.
          </div>
          <PublicCatalog
            products={[]}
            categories={categories}
            loading={false}
            error={null}
            onRetry={() => {}}
            onAdmin={() => setShowLivePreview(false)}
            previewProduct={draft}
          />
        </Modal>
      )}
    </Modal>
  );
}
