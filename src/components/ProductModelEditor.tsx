import { lazy, Suspense, useCallback, useRef, useState, type DragEvent } from 'react';
import { Box, Upload, X } from 'lucide-react';
import type { Product, ProductImage, ProductModel } from '../lib/types';
import type { ProductModelChange } from '../lib/catalog';
import { modelExtensions } from '../lib/model-formats';

const ProductModelViewer = lazy(() => import('./ProductModelViewer'));
const acceptedFiles = [...modelExtensions, 'zip', 'bin', 'mtl', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'tga', 'dds', 'ktx', 'ktx2', 'tif', 'tiff'].map(ext => `.${ext}`).join(',');

type Props = {
  productName: string;
  productId: string;
  saved: boolean;
  status: Product['status'];
  model?: ProductModel | null;
  poster?: string;
  photos: readonly ProductImage[];
  savedPhotoIds: readonly string[];
  modelEnabled: boolean;
  disabled: boolean;
  onChange: (change: ProductModelChange | undefined) => void;
  onPending: (pending: boolean, invalid?: boolean) => void;
};

export default function ProductModelEditor({ productName, status, model, poster, modelEnabled, disabled, onChange, onPending }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<readonly File[]>();
  const [fileName, setFileName] = useState('');
  const [removed, setRemoved] = useState(false);
  const [peek, setPeek] = useState(Boolean(model));
  const [error, setError] = useState('');
  const selecting = useRef(false);
  const draftChange = useRef<Exclude<ProductModelChange, null> | undefined>(undefined);
  const fallbackRemoved = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewFailedRef = useRef(false);
  const shownModel = removed ? null : model;
  const label = files ? fileName : shownModel?.name;
  const onPreview = useCallback((preview: 'loading' | 'ready' | 'error') => {
    onChange(preview === 'ready' && draftChange.current ? draftChange.current : (fallbackRemoved.current ? null : undefined));
    previewFailedRef.current = preview === 'error';
    setPreviewFailed(preview === 'error');
    onPending(preview === 'loading', preview === 'error');
  }, [onChange, onPending]);

  async function selectFiles(selection: FileList | readonly File[] | null): Promise<boolean> {
    if (!selection?.length || disabled || selecting.current) return false;
    selecting.current = true;
    setPreparing(true);
    onPending(true);
    setError('');
    try {
      const selected = Array.from(selection);
      const { packageModelFiles } = await import('../lib/model-files');
      const { file, name } = await packageModelFiles(selected);
      draftChange.current = { package: file, name };
      onChange(fallbackRemoved.current ? null : undefined);
      setFiles([file]);
      setFileName(name);
      setPeek(true);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'These model files could not be opened.');
      onPending(false, previewFailedRef.current);
      return false;
    } finally {
      setPreparing(false);
      selecting.current = false;
      if (input.current) input.current.value = '';
    }
  }

  function remove() {
    setError('');
    setPeek(false);
    setFiles(undefined);
    setFileName('');
    setPreviewFailed(false);
    previewFailedRef.current = false;
    draftChange.current = undefined;
    onPending(false);
    if (files) onChange(fallbackRemoved.current ? null : undefined);
    else {
      setRemoved(true);
      fallbackRemoved.current = true;
      onChange(null);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    void selectFiles(event.dataTransfer.files);
  }

  return (
    <section className="form-section product-editor-section product-model-section product-model-section--upload-only"
      id="product-editor-model" aria-labelledby="product-model-heading">
      <div className="product-editor-section-heading">
        <span className="product-editor-step"><Box size={15} aria-hidden="true" /></span>
        <div>
          <h3 id="product-model-heading">Upload 3D model</h3>
          <p>Add an existing 3D file for this product, then preview and save it.</p>
        </div>
      </div>
      {modelEnabled ? (
        <>
          <div className="product-model-upload product-model-upload--direct" onDragOver={event => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault();
          }} onDrop={drop}>
            <input type="file" ref={input} multiple accept={acceptedFiles}
              aria-label="Upload 3D model files" hidden disabled={disabled || preparing}
              onChange={event => void selectFiles(event.currentTarget.files)} />
            <span className="product-model-upload-icon"><Upload size={23} aria-hidden="true" /></span>
            <div className="product-model-upload-copy">
              <strong>Drop a 3D file here, or browse your files</strong>
              <span>GLB, glTF, OBJ, FBX, STL and other supported 3D formats · Maximum 50 MB</span>
            </div>
            <button type="button" className="button secondary product-model-upload-button"
              onClick={() => input.current?.click()} disabled={disabled || preparing}>
              <Upload size={16} aria-hidden="true" />
              {preparing ? 'Preparing model…' : label ? 'Replace 3D file' : 'Choose 3D file'}
            </button>
          </div>
          <details className="product-model-formats">
            <summary>Supported file formats</summary>
            <p>GLB, glTF, OBJ, FBX, STL, PLY, 3MF, 3DS, DAE, USD, USDZ, DRC, VRML and XYZ.</p>
            <p>STEP, IGES, BREP and Rhino 3DM with a render mesh. For textured multi-file models, upload the model with its textures or a ZIP.</p>
          </details>
          <p className="product-model-option-note">
            {status === 'published'
              ? 'After Save Product, the uploaded model can be viewed on the public product page.'
              : 'Save Product first. The 3D model will be visible to customers when the product is published.'}
          </p>
        </>
      ) : <p className="product-model-option-note">3D model uploads are not enabled for this catalog.</p>}
      {label && (
        <div className="product-model-file">
          <Box size={17} aria-hidden="true" />
          <span>{label}</span>
          {!files && <button type="button" className="button secondary" onClick={() => setPeek(open => !open)}
            aria-expanded={peek}>{peek ? 'Hide 3D' : 'Preview 3D'}</button>}
          <button type="button" className="icon-button" onClick={remove} disabled={disabled || preparing}
            aria-label={files ? 'Discard model selection' : 'Remove model'}><X size={17} aria-hidden="true" /></button>
        </div>
      )}
      {peek && (files || shownModel) && (
        <Suspense fallback={<p className="product-model-editor-loading" role="status">Loading 3D viewer…</p>}>
          <ProductModelViewer files={files} model={shownModel ?? undefined}
            productName={productName} poster={poster} onPreview={files ? onPreview : undefined} />
        </Suspense>
      )}
      {error && <p className="product-model-editor-error" role="alert">{error}</p>}
      {previewFailed && <p className="product-model-editor-error" role="status">
        This model could not be previewed. Choose another file or remove this selection before saving.
      </p>}
    </section>
  );
}
