import SafeImage from "./SafeImage";
import "./product-media-whatsapp-studio.css";
import "./product-editor-publish-action.css";
import "./product-editor-confirm-dialog.css";
import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  ImagePlus,
  Plus,
  Box,
  ArrowLeft,
  X,
  Eye,
  Save,
  LoaderCircle,
  LockKeyhole,
  CheckCircle2,
  Circle,
  Upload,
  Crop,
  MoreHorizontal,
  ChevronDown,
  Ruler,
  Hash,
  Pencil,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  Globe2,
  EyeOff,
} from "lucide-react";
import type { Product, Category, ProductImage, ProductSpecification } from "../lib/types";
import { uploadImage, validateProduct, cleanupAbandonedImages, type ProductModelChange } from "../lib/catalog";
import Modal from "./Modal";
import AvailabilityPicker from "./AvailabilityPicker";
import EditorCategoryPicker from "./EditorCategoryPicker";
import ProductModelEditor from "./ProductModelEditor";
import PublicCatalog from "./PublicCatalog";
import ProductPrice from "./ProductPrice";
import { nextProductId } from "../lib/product-ids";
import { cmToUnit, unitToCm, unitMax, DIMENSION_UNIT_OPTIONS, normalizeDimensionUnits, type DimensionKey, type DimensionUnit } from "../lib/dimensions";
import OverallDimensionFields from "./OverallDimensionFields";
import MeasurementTypePicker from "./MeasurementTypePicker";
import MaterialsEditor from "./MaterialsEditor";
import PhotoCropEditor from "./PhotoCropEditor";
import PhotoCoverStudio from "./PhotoCoverStudio";
import AlbumLibrary from "./AlbumLibrary";
import { albumPhotoToProductImage, type AlbumPhoto } from "../lib/album";
import { photoCropStyle } from "../lib/photo-crop";
import { splitSpecifications, compactSpecifications } from "../lib/specification-groups";

const MEASUREMENT_NAME_OPTIONS = [
  "Width", "Height", "Depth", "Length", "Diameter", "Thickness", "Radius",
  "Inner Diameter", "Outer Diameter", "Seat Height", "Seat Depth", "Arm Height",
] as const;

type SpecificationRowType = "detail" | "measurement" | "quantity";

function parseMeasurementValue(value: string): { amount: string; unit: DimensionUnit } {
  const match = value.trim().match(/^([0-9]*(?:\.[0-9]*)?)\s*(mm|cm|m|in|ft)$/);
  return match
    ? { amount: match[1], unit: match[2] as DimensionUnit }
    : { amount: "", unit: "cm" };
}

/** Uses the existing name/value specification record. Measurement units stay
 * embedded in value for the public product view, with kind for editing. */
function SpecificationRowFields({
  row, label, namePlaceholder, valuePlaceholder, onChange, onQuantityChange, onRemove,
}: {
  row: ProductSpecification;
  label: string;
  namePlaceholder: string;
  valuePlaceholder: string;
  onChange: (id: string, field: "name" | "value" | "description", value: string) => void;
  onQuantityChange: (id: string, quantity: number | undefined) => void;
  onRemove: (id: string) => void;
}) {
  const measurement = row.kind === "measurement";
  const quantityRow = row.kind === "quantity";
  const [editingCustomMeasurement, setEditingCustomMeasurement] = useState(false);
  const recognisedMeasurement = MEASUREMENT_NAME_OPTIONS.find(
    option => option.toLowerCase() === row.name.trim().toLowerCase(),
  );
  // Keep legacy/bespoke names intact. They appear as the selected option
  // rather than replacing the measurement dropdown with a text field.
  const isCustomMeasurement = measurement && row.name.trim().length > 0 && !recognisedMeasurement;
  const { amount, unit } = measurement ? parseMeasurementValue(row.value) : { amount: "", unit: "cm" as DimensionUnit };
  return (
    <div className={"catalog-reference-custom-row" + (measurement ? " catalog-spec-measurement-row" : "") + (quantityRow ? " catalog-spec-quantity-row" : "")}>
      {measurement ? (
        <div className="catalog-spec-measurement-name">
          <MeasurementTypePicker
            label={label + " measurement type"}
            value={isCustomMeasurement ? "__custom__" : recognisedMeasurement ?? ""}
            customName={isCustomMeasurement ? row.name : undefined}
            options={MEASUREMENT_NAME_OPTIONS}
            onChange={next => {
              if (next === "__custom__") {
                if (!isCustomMeasurement) onChange(row.id, "name", "");
                setEditingCustomMeasurement(true);
              } else {
                setEditingCustomMeasurement(false);
                onChange(row.id, "name", next);
              }
            }}
          />
          {isCustomMeasurement && !editingCustomMeasurement && (
            <button
              type="button"
              className="catalog-spec-custom-name-edit"
              aria-label={label + " edit custom measurement name"}
              onClick={() => setEditingCustomMeasurement(true)}
            ><Pencil size={12} aria-hidden="true" /> Edit custom name</button>
          )}
          {editingCustomMeasurement && (
            <input
              type="text"
              autoFocus
              aria-label={label + " custom measurement name"}
              placeholder="e.g. Pipe diameter"
              maxLength={80}
              value={row.name}
              onChange={event => onChange(row.id, "name", event.target.value)}
              onBlur={() => { if (row.name.trim()) setEditingCustomMeasurement(false); }}
              onKeyDown={event => {
                if (event.key === "Enter" && row.name.trim()) {
                  event.preventDefault();
                  setEditingCustomMeasurement(false);
                }
              }}
            />
          )}
        </div>
      ) : (
        <input
          aria-label={label + " name"}
          placeholder={quantityRow ? "e.g. Drawer" : namePlaceholder}
          maxLength={80}
          value={row.name}
          onChange={event => onChange(row.id, "name", event.target.value)}
        />
      )}
      {quantityRow ? (
        <div className="catalog-spec-row-quantity" role="group" aria-label={label + " quantity"}>
          <input
            aria-label={label + " quantity in pieces"}
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            step={1}
            placeholder="e.g. 2"
            title="Number of pieces"
            value={row.quantity ?? ""}
            onChange={event => {
              const raw = event.target.value;
              if (!raw) { onQuantityChange(row.id, undefined); return; }
              const quantity = Number(raw);
              if (/^[0-9]+$/.test(raw) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 9999) {
                onQuantityChange(row.id, quantity);
              }
            }}
          />
          <span aria-hidden="true">pcs</span>
        </div>
      ) : measurement ? (
        <div className="catalog-spec-measurement-fields" role="group" aria-label={label + " measurement"}>
          <input
            aria-label={label + " measurement value"}
            type="number"
            inputMode="decimal"
            min={0}
            max={unitMax(unit)}
            step="any"
            placeholder="e.g. 25"
            value={amount}
            onChange={(event) => onChange(row.id, "value", event.target.value + " " + unit)}
          />
          <select
            aria-label={label + " measurement unit"}
            value={unit}
            title="Measurement unit"
            onChange={(event) => {
              const nextUnit = event.target.value as DimensionUnit;
              const nextAmount = amount && Number.isFinite(Number(amount)) && Number(amount) > 0
                ? String(cmToUnit(unitToCm(Number(amount), unit), nextUnit))
                : amount;
              onChange(row.id, "value", nextAmount + " " + nextUnit);
            }}
          >
            {DIMENSION_UNIT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      ) : (
        <input
          aria-label={label + " value"}
          placeholder={valuePlaceholder}
          maxLength={400}
          value={row.value}
          onChange={(event) => onChange(row.id, "value", event.target.value)}
        />
      )}
      <input
        className="catalog-spec-row-description"
        aria-label={label + " description"}
        title="Description (optional)"
        placeholder="Description (optional)"
        maxLength={400}
        value={row.description ?? ""}
        onChange={(event) => onChange(row.id, "description", event.target.value)}
      />
      <button
        type="button"
        className="catalog-reference-remove-row"
        aria-label={"Remove " + (quantityRow ? "quantity " : measurement ? "measurement " : "detail ") + (row.name || label)}
        title="Remove row"
        onClick={() => onRemove(row.id)}
      ><X size={17} aria-hidden="true" /></button>
    </div>
  );
}

/** An in-flow choice panel avoids popover clipping inside editor sections.
 * Both the base rows and named sections use the same accessible actions. */
function AddSpecificationRowMenu({
  disabled, onAdd,
}: {
  disabled: boolean;
  onAdd: (type: SpecificationRowType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>(".catalog-reference-add-row")?.focus();
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);
  return (
    <div className="catalog-spec-row-menu-wrap" ref={ref}>
      <button type="button" className="catalog-reference-add-row"
        disabled={disabled} aria-expanded={open}
        aria-label="Add specification row: choose detail, measurement or quantity"
        onClick={() => setOpen(value => !value)}>
        <Plus size={17} aria-hidden="true" /> Add row
        <ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div className="catalog-spec-row-choice-panel" role="group" aria-label="Choose row type">
          <button type="button" onClick={() => { onAdd("detail"); setOpen(false); }}>
            <span className="catalog-spec-choice-icon"><Plus size={17} aria-hidden="true" /></span>
            <span><strong>Detail row</strong><small>Material, finish or description</small></span>
          </button>
          <button type="button" onClick={() => { onAdd("measurement"); setOpen(false); }}>
            <span className="catalog-spec-choice-icon"><Ruler size={17} aria-hidden="true" /></span>
            <span><strong>Measurement</strong><small>Numeric value with mm, cm, m, in or ft</small></span>
          </button>
          <button type="button" onClick={() => { onAdd("quantity"); setOpen(false); }}>
            <span className="catalog-spec-choice-icon"><Hash size={17} aria-hidden="true" /></span>
            <span><strong>Quantity</strong><small>Count pieces, e.g. Drawer · 2 pcs</small></span>
          </button>
        </div>
      )}
    </div>
  );
}

export type CatalogEditorNavigation = "overview" | "products" | "categories" | "users" | "activity" | "catalog";
export default function ProductEditor({
  product,
  categories,
  existingProducts,
  isNewProduct,
  orderingEnabled = false,
  modelEditingEnabled = false,
  photoOpenRequest,
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
  photoOpenRequest?: { productId: string; imageId: string; requestId: number } | null;
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
  const [error, setError] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<"published" | "draft" | null>(null);
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
  const [mediaTab, setMediaTab] = useState<"photos" | "3d">("photos");
  const [photoMenuId, setPhotoMenuId] = useState<string | null>(null);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  useEffect(() => {
    if (!photoOpenRequest || photoOpenRequest.productId !== product.id) return;
    // Keeps existing unsaved product edits: open the PHOTO overlay only.
    setEditingPhotoId(photoOpenRequest.imageId);
  }, [photoOpenRequest, product.id]);
  const [editingCoverId, setEditingCoverId] = useState<string | null>(null);
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
  const addSpecificationRow = (type: SpecificationRowType, sectionId?: string) =>
    setDraft((current) => {
      const specifications = [...(current.specifications ?? [])];
      if (specifications.length >= 24) return current;
      const row: ProductSpecification = type === "measurement"
        ? { id: crypto.randomUUID(), name: "", value: " cm", kind: "measurement" }
        : type === "quantity"
          ? { id: crypto.randomUUID(), name: "", value: "", kind: "quantity" }
          : { id: crypto.randomUUID(), name: "", value: "" };
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
    if (members.some(item => item.value.trim() || item.quantity || item.description?.trim() || (item.kind !== "section" && item.name.trim())) &&
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
  const changeSpecification = (id: string, field: "name" | "value" | "description", value: string) =>
    setDraft((current) => ({
      ...current,
      specifications: (current.specifications ?? []).map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    }));
  const changeSpecificationQuantity = (id: string, quantity: number | undefined) =>
    setDraft((current) => ({
      ...current,
      specifications: (current.specifications ?? []).map((row) =>
        row.id === id ? { ...row, quantity } : row,
      ),
    }));
  const removeSpecification = (id: string) =>
    setDraft((current) => ({
      ...current,
      specifications: (current.specifications ?? []).filter((row) => row.id !== id),
    }));
  async function commit(status: Product["status"] = draft.status, confirmed = false) {
    if (busy) return;
    // Never silently ignore a click. Explain temporary upload/model blockers
    // in the sticky footer where the user clicked.
    if (uploadLock.current || uploading) {
      setError("An image is still uploading. Complete the upload before saving or publishing.");
      return;
    }
    if (modelLocked.current) {
      setError(modelInvalid
        ? "The 3D model preview failed. Replace or remove the selected 3D file before publishing."
        : modelPending
          ? "The 3D model is still processing. Finish or cancel it before publishing."
          : "Complete or cancel the 3D model operation before saving or publishing.");
      return;
    }
    setError("");
    // Newly added but untouched rows should not prevent a completed product
    // from being published. Partially filled rows remain subject to validation.
    const candidate = { ...draft, specifications: compactSpecifications(draft.specifications), status };
    try {
      validateProduct(candidate);
      if (!confirmed && (
        (status === "published" && product.status !== "published") ||
        (status === "draft" && product.status === "published")
      )) {
        setConfirmStatus(status === "published" ? "published" : "draft");
        return;
      }
      setBusy(true);
      const saved = await onSave({ ...candidate, sku: isNewProduct ? draft.sku : product.sku, updatedAt: new Date().toISOString() }, modelChange.current, isNewProduct);
      const savedImages = saved?.images ?? draft.images;
      const retained = new Set(savedImages.map(image => image.url));
      const preservedOriginalPaths = new Set(savedImages.flatMap(image => image.preservedOriginalPaths ?? []));
      const abandoned = [...uploadedImages.current.values()].filter(image =>
        !retained.has(image.url) && !(image.storagePath && preservedOriginalPaths.has(image.storagePath)));
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
  const publishChecks = [
    { label: "Name, Product ID & category", done: draft.name.trim().length >= 2 && !!draft.sku.trim() && !!draft.categoryId },
    { label: "Cover photo", done: draft.images.length > 0 },
    { label: "Description", done: !!draft.description.trim() },
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
            <div className="catalog-editor-header-actions">
              <div className="catalog-editor-header-meta" aria-label="Product information">
                <span className="catalog-editor-header-sku">{draft.sku || "New product"}</span>
                <span className={`catalog-editor-header-status catalog-editor-header-status--${draft.status}`}
                  aria-label={`Current product status: ${draft.status}`}>
                  {draft.status === "published" ? "Published" : draft.status === "archived" ? "Archived" : "Draft"}
                </span>
              </div>
              <button
                type="button"
                className="catalog-editor-header-close"
                aria-label="Close product editor"
                title="Close editor"
                disabled={busy || uploading}
                onClick={() => void requestClose()}
              >
                <X size={20} strokeWidth={1.9} aria-hidden="true" />
              </button>
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
            <section className="form-section product-editor-section brutti-editor-section-card" id="product-editor-basics">
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
            <section className="brutti-product-media brutti-editor-section-card" id="brutti-media-section">
              <span id="product-editor-photos" className="brutti-media-jump-target" aria-hidden="true" />
              <div className="product-editor-section-heading brutti-media-section-heading">
                <span className="product-editor-step">02</span>
                <div>
                  <h3>Media <small>(Photos &amp; 3D)</small></h3>
                </div>
                <p>Add up to 8 photos and an optional 3D model.</p>
              </div>
              <div className="brutti-media-toolbar">
                <div className="brutti-media-tabs" role="tablist" aria-label="Product media type">
                  <button type="button" role="tab" id="brutti-media-photos-tab" aria-controls="brutti-media-photos-panel"
                    aria-selected={mediaTab==="photos"} className={mediaTab==="photos"?"is-active":""}
                    onClick={()=>{setMediaTab("photos");setPhotoMenuId(null);}}>
                    <ImageIcon size={15} aria-hidden="true"/> Photos <span>({draft.images.length})</span>
                  </button>
                  <button type="button" role="tab" id="brutti-media-3d-tab" aria-controls="brutti-media-3d-panel"
                    aria-selected={mediaTab==="3d"} className={mediaTab==="3d"?"is-active":""}
                    onClick={()=>{setMediaTab("3d");setPhotoMenuId(null);}}>
                    <Box size={15} aria-hidden="true"/> 3D Model <span>({product.model || modelDirty ? 1 : 0})</span>
                  </button>
                </div>
                {mediaTab==="photos" && <div className="brutti-media-actions">
                  <button type="button" className="brutti-media-album-button"
                    onClick={()=>setShowAlbumPicker(true)} disabled={busy || uploading || draft.images.length>=8}>
                    <ImagePlus size={15} aria-hidden="true"/> Choose from Album
                  </button>
                  <button type="button" className="brutti-media-upload-button"
                    onClick={()=>fileRef.current?.click()} disabled={busy || uploading || draft.images.length>=8}>
                    {uploading?<LoaderCircle size={16} className="spin"/>:<Upload size={16} aria-hidden="true"/>}
                    {uploading?"Uploading…":"Upload Photos"}
                  </button>
                </div>}
              </div>
              <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
                hidden disabled={uploading||busy} onChange={event=>void addImages(event.target.files)} />

              <div role="tabpanel" id="brutti-media-photos-panel" aria-labelledby="brutti-media-photos-tab"
                className="brutti-media-gallery-panel" hidden={mediaTab!=="photos"}>
                <div className="brutti-media-gallery" aria-label="Product photos">
                  {draft.images.map((img,index)=>(
                    <div className="brutti-media-photo-item" key={img.id}>
                      <button type="button" className="brutti-media-thumbnail"
                        aria-label={`View photo ${index+1} of ${draft.images.length}`}
                        onClick={()=>{setPreviewPhotoId(img.id);setPhotoMenuId(null);}}>
                        <SafeImage src={img.url} alt={img.alt||draft.name} style={photoCropStyle(img)}/>
                        {index===0 && <span className="brutti-media-cover-badge"><CheckCircle2 size={12} aria-hidden="true"/> Cover</span>}
                      </button>
                      <button type="button" className="brutti-media-quick-edit"
                        aria-label={`Edit photo ${index+1}`}
                        disabled={busy||uploading} title="Crop and rotate"
                        onClick={()=>{setEditingPhotoId(img.id);setPhotoMenuId(null);}}>
                        <Crop size={17} aria-hidden="true"/>
                      </button>
                      <button type="button" className="brutti-media-more"
                        aria-expanded={photoMenuId===img.id}
                        aria-haspopup="menu"
                        aria-label={`More actions for photo ${index+1}`}
                        title="Photo options"
                        onClick={()=>setPhotoMenuId(current=>current===img.id?null:img.id)}>
                        <MoreHorizontal size={19} aria-hidden="true"/>
                      </button>
                      {photoMenuId===img.id && <div className="brutti-media-photo-menu" role="menu" aria-label={`Photo ${index+1} actions`} onKeyDown={event=>{
                        if (event.key==="Escape") { event.stopPropagation(); setPhotoMenuId(null); }
                      }}>
                        <button type="button" role="menuitem" disabled={busy||uploading}
                          onClick={()=>{setEditingPhotoId(img.id);setPhotoMenuId(null);}}>
                          <Pencil size={15} aria-hidden="true"/> Edit
                        </button>
                        <button type="button" role="menuitem" className="is-danger" disabled={busy||uploading} onClick={()=>{
                          setPhotoMenuId(null);
                          if (!window.confirm("Delete this photo from the product? It will be removed when you save. The original Album photo will remain.")) return;
                          setDraft(current=>({...current,images:current.images.filter(item=>item.id!==img.id)}));
                        }}>
                          <Trash2 size={15} aria-hidden="true"/> Delete
                        </button>
                      </div>}
                    </div>
                  ))}
                  {draft.images.length<8 && <button type="button"
                    className={`brutti-media-add-tile${dragging?" is-dragging":""}`}
                    aria-label="Add a product photo" disabled={uploading||busy}
                    onClick={()=>fileRef.current?.click()}
                    onDragOver={event=>{event.preventDefault();if(!busy&&!uploading)setDragging(true);}}
                    onDragLeave={event=>{event.preventDefault();setDragging(false);}}
                    onDrop={event=>{
                      event.preventDefault();setDragging(false);
                      if(!busy&&!uploading)void addImages(event.dataTransfer.files);
                    }}>
                    <Plus size={24} aria-hidden="true"/>
                    <span>Add Photo</span>
                  </button>}
                </div>
                <p className="brutti-media-gallery-help">Select a photo to preview it; use the crop icon to edit. The original file stays in Album.</p>
              </div>

              <div role="tabpanel" id="brutti-media-3d-panel" aria-labelledby="brutti-media-3d-tab"
                className="brutti-media-3d-panel" hidden={mediaTab!=="3d"}>
                <ProductModelEditor productName={draft.name||"this product"} productId={product.id}
                  saved={isEditing} status={draft.status} model={product.model}
                  photos={draft.images} savedPhotoIds={product.images.map(image=>image.id)}
                  modelEnabled={modelEditingEnabled} poster={cover?.url}
                  disabled={busy} onChange={setModelChange} onPending={setModelLoading}/>
              </div>
            </section>
            {isEditing ? (

            <section className="form-section product-editor-section catalog-reference-specifications brutti-editor-section-card" id="product-editor-specs">
              <div className="product-editor-section-heading">
                <span className="product-editor-step">03</span>
                <div>
                  <h3>Specifications</h3>
                  <p>Measurements, materials and finishing details.</p>
                </div>
              </div>
              <div className="catalog-reference-spec-rows">
                <div className="catalog-reference-spec-row">
                  <span className="catalog-reference-spec-key">Dimensions <small>Optional · overall size</small></span>
                  <OverallDimensionFields
                    product={draft}
                    disabled={busy || uploading}
                    onValueChange={(key, value) => update(key, value)}
                    onUnitChange={(key, unit) => setDraft(current => ({
                      ...current,
                      dimensionUnits: { ...normalizeDimensionUnits(current.dimensionUnits), [key]: unit },
                    }))}
                  />
                </div>
                <div className="catalog-reference-spec-row catalog-materials-spec-row">
                  <span className="catalog-reference-spec-key">Materials <small>Optional · primary materials</small></span>
                  <MaterialsEditor
                    value={draft.materials}
                    onChange={value => update("materials", value)}
                    disabled={busy}
                  />
                </div>
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
                <SpecificationRowFields key={row.id}
                  row={row}
                  label={`Additional detail ${index + 1}`}
                  namePlaceholder="e.g. Drawer dimensions"
                  valuePlaceholder="e.g. W 3ft × D 1.8ft × H 2ft"
                  onChange={changeSpecification}
                  onQuantityChange={changeSpecificationQuantity}
                  onRemove={removeSpecification}
                />
              ))}
              <AddSpecificationRowMenu
                disabled={(draft.specifications ?? []).length >= 24 || busy}
                onAdd={(type) => addSpecificationRow(type)}
              />
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
                      <SpecificationRowFields key={row.id}
                        row={row}
                        label={`Section ${index + 2} row ${rowIndex + 1}`}
                        namePlaceholder="e.g. Finishing"
                        valuePlaceholder="e.g. Clear satin finishing"
                        onChange={changeSpecification}
                        onQuantityChange={changeSpecificationQuantity}
                        onRemove={removeSpecification}
                      />
                    ))}
                  </div>
                  <AddSpecificationRowMenu
                    disabled={(draft.specifications ?? []).length >= 24 || busy}
                    onAdd={(type) => addSpecificationRow(type, section.id)}
                  />
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
            <section className="form-section product-editor-section brutti-editor-section-card" id="product-editor-specs">
              <div className="product-editor-section-heading">
                <span className="product-editor-step">03</span>
                <div>
                  <h3>Specifications</h3>
                  <p>Materials, measurements and pricing.</p>
                </div>
              </div>
              <div className="catalog-materials-new-field">
                <span>Materials <span className="product-editor-publish-hint">Optional</span></span>
                <MaterialsEditor
                  value={draft.materials}
                  onChange={value => update("materials", value)}
                  disabled={busy}
                />
              </div>
              <div className="section-label">
                Dimensions <span className="muted">Optional</span>
              </div>
              <OverallDimensionFields
                product={draft}
                disabled={busy || uploading}
                onValueChange={(key, value) => update(key, value)}
                onUnitChange={(key, unit) => setDraft(current => ({
                  ...current,
                  dimensionUnits: { ...normalizeDimensionUnits(current.dimensionUnits), [key]: unit },
                }))}
              />
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
              {publishingControls}
              <button type="button" className="button secondary full" aria-expanded={preview} onClick={() => setPreview(open => !open)}>
                <Eye size={16} /> {preview ? "Hide preview" : "Preview product"}
              </button>
              {preview && previewCard}
            </aside>
          )}
        </div>
        {!isEditing && error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <footer className="editor-footer">
          {isEditing && error && (
            <div className="catalog-editor-save-error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" aria-label="Dismiss publishing error"
                title="Dismiss message" onClick={() => setError("")}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <span className="tiny muted">
            Changes are saved when you select Save.
          </span>
          <div className="button-row">
            <button
              className={isEditing && draft.status !== "published"
                ? "button secondary catalog-editor-footer-save-draft" : "button primary"}
              disabled={busy}
              type="submit"
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}{" "}
              {busy ? "Saving…" : "Save product"}
            </button>
            {isEditing && draft.status !== "published" && (
              <button
                type="button"
                className="button primary catalog-editor-footer-publish"
                disabled={busy}
                onClick={() => void commit("published")}
                title="Save changes and publish this product to the public catalog"
              >
                <Upload size={16} aria-hidden="true" /> Publish product
              </button>
            )}
            {isEditing && draft.status === "published" && (
              <button
                type="button"
                className="button secondary catalog-editor-footer-unpublish"
                disabled={busy}
                onClick={() => void commit("draft")}
                title="Save changes and remove this product from the public catalog"
              >
                <Eye size={16} aria-hidden="true" /> Move to Draft
              </button>
            )}
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
      {confirmStatus && (
        <Modal
          title={confirmStatus === "published" ? "Publish this product?" : "Move product to Draft?"}
          eyebrow="BRUTTI CATALOG / CONFIRM ACTION"
          className="catalog-publish-confirm-dialog"
          onClose={() => setConfirmStatus(null)}
        >
          <div className="catalog-publish-confirm-body">
            <div className={`catalog-publish-confirm-icon ${confirmStatus === "published" ? "is-publish" : "is-draft"}`}>
              {confirmStatus === "published"
                ? <Globe2 size={22} strokeWidth={1.85} aria-hidden="true" />
                : <EyeOff size={22} strokeWidth={1.85} aria-hidden="true" />}
            </div>
            <p className="catalog-publish-confirm-description">
              {confirmStatus === "published"
                ? "This product will appear in the public Brutti Catalog and customers will be able to view it."
                : "This product will be removed from the public catalog. Its details and photos will remain saved for editing."}
            </p>
            <div className="catalog-publish-confirm-product">
              <span className="catalog-publish-confirm-product-label">PRODUCT</span>
              <strong>{draft.name.trim() || "Untitled product"}</strong>
              <span className="catalog-publish-confirm-product-sku">{draft.sku}</span>
            </div>
            <div className="catalog-publish-confirm-actions">
              <button type="button" className="catalog-publish-confirm-cancel"
                onClick={() => setConfirmStatus(null)}>Cancel</button>
              <button type="button" className={`catalog-publish-confirm-submit ${confirmStatus === "draft" ? "is-draft" : ""}`}
                onClick={() => {
                  const nextStatus = confirmStatus;
                  setConfirmStatus(null);
                  void commit(nextStatus, true);
                }}>
                {confirmStatus === "published"
                  ? <Globe2 size={17} strokeWidth={1.85} aria-hidden="true" />
                  : <EyeOff size={17} strokeWidth={1.85} aria-hidden="true" />}
                {confirmStatus === "published" ? "Publish Product" : "Move to Draft"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {editingCoverId && draft.images.some(image => image.id === editingCoverId) && (
        <PhotoCoverStudio
          key={editingCoverId}
          imageUrl={draft.images.find(image => image.id === editingCoverId)!.url}
          imageName={draft.images.find(image => image.id === editingCoverId)!.alt || draft.name}
          saveLabel="Use as product cover"
          onClose={() => setEditingCoverId(null)}
          onSave={async file => {
            if (draft.images.length >= 8) throw new Error("The product already has 8 photos. Free one slot to keep the original.");
            uploadLock.current = true;
            setUploading(true);
            try {
              const edited = await uploadImage(file);
              uploadedImages.current.set(edited.id, edited);
              if (!mounted.current) { await cleanupAbandonedImages([edited]); return; }
              // Add as first cover without removing or overwriting the source.
              setDraft(current => ({
                ...current,
                images: [{ ...edited, alt: "Edited furniture cover" }, ...current.images].slice(0, 8),
              }));
              setEditingCoverId(null);
              setError("");
            } finally {
              uploadLock.current = false;
              if (mounted.current) setUploading(false);
            }
          }}
        />
      )}
      {previewPhotoId && draft.images.some(image => image.id===previewPhotoId) && (
        <Modal title="Photo preview" eyebrow="BRUTTI / MEDIA"
          className="brutti-media-preview-dialog" onClose={()=>setPreviewPhotoId(null)}>
          {(()=> {
            const img = draft.images.find(item=>item.id===previewPhotoId)!;
            return <div className="brutti-media-preview-body">
              <div className="brutti-media-preview-image">
                <div className="brutti-media-preview-ambient" aria-hidden="true">
                  <SafeImage src={img.url} alt="" />
                </div>
                <SafeImage
                  className="brutti-media-preview-photo"
                  src={img.url}
                  alt={img.alt||draft.name}
                  style={photoCropStyle(img)}
                />
              </div>
              <div className="brutti-media-preview-footer">
                <span>{img.alt||draft.name}</span>
                <button type="button" onClick={()=>{setPreviewPhotoId(null);setEditingPhotoId(img.id);}}
                  disabled={busy||uploading}><Crop size={16}/> Edit photo</button>
              </div>
            </div>;
          })()}
        </Modal>
      )}
      {editingPhotoId && draft.images.some(image => image.id === editingPhotoId) && (
        <PhotoCropEditor
          key={editingPhotoId}
          image={draft.images.find(image => image.id === editingPhotoId)!}
          productId={product.id}
          onClose={() => setEditingPhotoId(null)}
          onApply={async file => {
            if (busy || uploadLock.current) throw new Error("Another upload is in progress.");
            uploadLock.current = true;
            setUploading(true);
            try {
              const edited = await uploadImage(file);
              uploadedImages.current.set(edited.id,edited);
              if (!mounted.current) {
                await cleanupAbandonedImages([edited]);
                return;
              }
              // Replace just this product slot. Its original source file remains untouched.
              setDraft(current=>({
                ...current,
                images:current.images.map(image=>image.id===editingPhotoId
                  ? {
                    ...edited,
                    alt:image.alt||current.name,
                    preservedOriginalPaths:[
                      ...new Set([...(image.preservedOriginalPaths ?? []),
                        ...(image.storagePath ? [image.storagePath] : [])]),
                    ],
                  }:image),
              }));
              setEditingPhotoId(null);
              setError("");
            } finally {
              uploadLock.current = false;
              if (mounted.current) setUploading(false);
            }
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
