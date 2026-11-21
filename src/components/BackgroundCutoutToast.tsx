import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, Download, Eye, LoaderCircle, Sparkles, X } from "lucide-react";
import Modal from "./Modal";
import {
  cancelBackgroundJob, dismissBackgroundJob,
  getBackgroundJobSnapshot, subscribeBackgroundJob,
} from "../lib/photo-background-jobs";

type Props = {
  onEditResult: (productId: string, imageId: string) => boolean;
};

export default function BackgroundCutoutToast({ onEditResult }: Props) {
  const job = useSyncExternalStore(subscribeBackgroundJob, getBackgroundJobSnapshot);
  const [host, setHost] = useState<HTMLElement>(() => document.body);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [toastError, setToastError] = useState("");

  // Anchor the progress inside the fixed sidebar, just above View public
  // catalog. On phones the sidebar is hidden, so keep a small topbar badge.
  // Native dialogs may use the browser top layer; those still get the dialog
  // notification to remain visible while editing other products.
  useEffect(() => {
    const updateHost = () => {
      const open = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"));
      const small = window.matchMedia("(max-width: 800px)").matches;
      const target = document.getElementById(small
        ? "brutti-background-task-mobile-host"
        : "brutti-background-sidebar-host");
      setHost(open[open.length - 1] ?? target ?? document.body);
    };
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["open"],
    });
    window.addEventListener("resize", updateHost);
    updateHost();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHost);
    };
  }, []);

  useEffect(() => {
    if (job.status === "idle" || job.status === "running") {
      setPreviewOpen(false);
      setPreviewError("");
      setToastError("");
    }
  }, [job.jobId, job.status]);

  function openPhoto(): boolean {
    if (!job.productId || !job.image || !onEditResult(job.productId, job.image.id)) {
      setToastError("This photo is no longer attached to the product. You can download the result when it's ready.");
      return false;
    }
    setToastError("");
    setPreviewError("");
    return true;
  }

  const label = job.image?.alt || "Product photo";
  const visible = job.status !== "idle" && job.status !== "cancelled";
  const running = job.status === "running";

  async function download(): Promise<void> {
    if (!job.result) return;
    const canvas = job.result;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (label.replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "brutti-photo") + "-transparent.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      {visible && !previewOpen && createPortal(
        (host.id === "brutti-background-sidebar-host" ||
          host.id === "brutti-background-task-mobile-host") ? (
          <div className={`brutti-background-header-task${host.id === "brutti-background-sidebar-host" ? " brutti-background-sidebar-task" : ""}`}
            aria-label="Current photo background removal">
            <button type="button" className="brutti-background-header-open"
              title={`${label}: ${running ? "Background removal in progress" : job.message}`}
              onClick={() => {
                if (job.status === "done") {
                  if (!openPhoto()) setPreviewOpen(true);
                } else if (job.status === "running") {
                  openPhoto();
                } else {
                  setToastError(job.error);
                }
              }}>
              <span className="brutti-background-header-label">
                {running ? <LoaderCircle className="spin" size={13}/> :
                  job.status === "done" ? <Check size={13}/> : <X size={13}/>}
                <span>{running ? "Removing background" :
                  job.status === "done" ? "Result ready · Open" : "Removal failed"}</span>
              </span>
              <strong>{running ? `${job.percent}%` : job.status === "done" ? "100%" : "!"}</strong>
              {host.id === "brutti-background-sidebar-host" && (
                <span className="brutti-background-sidebar-product" title={label}>{label}</span>
              )}
              <span className="brutti-background-header-track" aria-hidden="true">
                <span style={{ width: `${job.percent}%` }}/>
              </span>
            </button>
            {running ? (
              <button type="button" className="brutti-background-header-action"
                onClick={cancelBackgroundJob} title="Cancel background removal"
                aria-label="Cancel background removal"><X size={14}/></button>
            ) : (
              <button type="button" className="brutti-background-header-action"
                title={job.status === "done" ? "Preview transparent result" : "Dismiss error"}
                aria-label={job.status === "done" ? "Preview transparent result" : "Dismiss error"}
                onClick={() => job.status === "done" ? setPreviewOpen(true) : dismissBackgroundJob()}>
                {job.status === "done" ? <Eye size={15}/> : <X size={14}/>}
              </button>
            )}
          </div>
        ) : (
        <aside className="brutti-background-task-toast"
          role="region" tabIndex={0}
          aria-label="Background removal task. Click to return to the product photo."
          aria-busy={running}
          onClick={event => {
            // Every non-control part of the notification returns to the
            // original product. Nested Cancel/Preview/Download retain actions.
            if ((event.target as HTMLElement).closest("button, a")) return;
            if (openPhoto()) setPreviewOpen(false);
          }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (openPhoto()) setPreviewOpen(false);
            }
          }}>
          <div className="brutti-background-task-toast-head">
            <span className="brutti-background-task-toast-mark">
              {running ? <LoaderCircle className="spin" size={17}/> :
                job.status === "done" ? <Check size={17}/> : <X size={17}/>}
            </span>
            <button type="button" className="brutti-background-task-toast-title brutti-background-task-title-link"
              onClick={() => { if (openPhoto()) setPreviewOpen(false); }}
              title="Return to the photo being edited"
              aria-label={`Open Photo Studio for ${label}`}>
              <strong>{running ? "Removing background" :
                job.status === "done" ? "Background ready" : "Background removal failed"}</strong>
              <small title={label}>{label}</small>
            </button>
            {job.status !== "running" && (
              <button type="button" className="brutti-background-task-close"
                onClick={dismissBackgroundJob} aria-label="Dismiss background task">
                <X size={15}/>
              </button>
            )}
          </div>
          {running ? (
            <>
              <div className="brutti-background-task-toast-progress">
                <span>Processing in this tab</span>
                <strong>{job.percent}%</strong>
              </div>
              <progress max={100} value={job.percent}
                aria-label="Estimated background-removal progress"/>
              <p role="status">{job.message || "Preparing AI…"}</p>
              <div className="brutti-background-task-toast-actions">
                <small>Estimated · Keep this browser tab open</small>
                <button type="button" className="brutti-background-task-view"
                  onClick={() => { if (openPhoto()) setPreviewOpen(false); }}>
                  <ArrowUpRight size={14}/> Open photo
                </button>
                <button type="button" onClick={cancelBackgroundJob}>Cancel</button>
              </div>
            </>
          ) : job.status === "done" ? (
            <>
              <p>Photo cutout is ready to review. Your original is unchanged.</p>
              <div className="brutti-background-task-toast-actions">
                <button type="button" className="brutti-background-task-open"
                  onClick={() => {
                    if (openPhoto()) setPreviewOpen(false);
                    else setPreviewOpen(true);
                  }}>
                  <ArrowUpRight size={15}/> Open result
                </button>
                <button type="button" onClick={() => setPreviewOpen(true)}
                  aria-label="Preview transparent result" title="Preview image">
                  <Eye size={16}/>
                </button>
                <button type="button" onClick={() => void download()} aria-label="Download transparent PNG">
                  <Download size={16}/>
                </button>
              </div>
            </>
          ) : (
            <>
              <p role="alert">{job.error || "Processing could not finish."}</p>
              <div className="brutti-background-task-toast-actions">
                <button type="button" onClick={dismissBackgroundJob}>Dismiss</button>
              </div>
            </>
          )}
          {toastError && <p role="alert" className="brutti-background-task-toast-error">{toastError}</p>}
        </aside>
        ),
        host,
      )}
      {previewOpen && job.status === "done" && job.result && (
        <Modal title="Background removal result" eyebrow="BRUTTI PHOTO STUDIO"
          className="brutti-background-result-dialog" onClose={() => setPreviewOpen(false)}>
          <div className="brutti-background-result-content">
            <div className="brutti-background-result-photo">
              <img src={job.result.toDataURL("image/png")} alt={`Removed background preview for ${label}`}/>
            </div>
            <div className="brutti-background-result-info">
              <strong>{label}</strong>
              <p>Review the transparent edges before applying. Original photo is kept unchanged.</p>
              <div className="brutti-background-result-actions">
                <button type="button" className="brutti-background-task-open"
                  onClick={() => {
                    if (!job.productId || !job.image ||
                      !onEditResult(job.productId, job.image.id)) {
                      setPreviewError("The original photo is no longer available in Product Editor. Download the result as PNG instead.");
                      return;
                    }
                    setPreviewError("");
                    setPreviewOpen(false);
                  }}>
                  <Sparkles size={16}/> Continue in Photo Studio
                </button>
                {previewError && <p role="alert" className="brutti-background-result-error">{previewError}</p>}
                <button type="button" onClick={() => void download()}>
                  <Download size={16}/> Download PNG
                </button>
                <button type="button" onClick={() => setPreviewOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
