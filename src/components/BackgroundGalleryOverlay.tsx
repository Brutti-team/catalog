import { useSyncExternalStore } from "react";
import { LoaderCircle } from "lucide-react";
import {
  getBackgroundJobSnapshot, subscribeBackgroundJob,
} from "../lib/photo-background-jobs";

/** The catalogue card uses the same independent job as Photo Studio.
 * Only the actual photo being processed gets a visible animation; never
 * cover a different image when a product has multiple photos. */
export default function BackgroundGalleryOverlay({
  productId, coverImageId,
}: {
  productId: string;
  coverImageId?: string;
}) {
  const job = useSyncExternalStore(subscribeBackgroundJob, getBackgroundJobSnapshot);
  if (job.status !== "running" || job.productId !== productId) return null;
  const isPhoto = coverImageId === job.image?.id;
  return (
    <span className={`brutti-gallery-ai-overlay${isPhoto ? " is-photo" : " is-other-photo"}`}
      aria-label={`Background removal in progress: estimated ${job.percent}%`}>
      {isPhoto && <span className="brutti-gallery-ai-glimmer" aria-hidden="true" />}
      <span className="brutti-gallery-ai-status">
        <LoaderCircle size={13} className="spin" aria-hidden="true"/>
        <span>{isPhoto ? "Refining photo" : "Photo processing"}</span>
        <strong>{job.percent}%</strong>
      </span>
      <span className="brutti-gallery-ai-track" aria-hidden="true">
        <span style={{ width: `${job.percent}%` }}/>
      </span>
    </span>
  );
}
