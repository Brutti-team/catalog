import { useEffect, useState } from "react";
import { publicAnalyticsPage, readAnalyticsChoice, setAnalyticsChoice, trackAnalyticsPage, type AnalyticsChoice } from "../lib/google-analytics";
import "./analytics-preferences.css";

export default function AnalyticsPreferences({ ready, productId, productName }: { ready: boolean; productId: string | null; productName: string }) {
  const [choice, setChoice] = useState<AnalyticsChoice>(readAnalyticsChoice);
  const [open, setOpen] = useState(() => readAnalyticsChoice() === null);
  const allowed = publicAnalyticsPage();
  useEffect(() => {
    if (allowed && choice) setAnalyticsChoice(choice);
  }, [allowed, choice]);
  useEffect(() => {
    if (allowed && ready && choice === "granted") trackAnalyticsPage(productId, productName);
  }, [allowed, ready, choice, productId, productName]);
  if (!allowed) return null;
  const choose = (value: "granted" | "denied") => {
    setAnalyticsChoice(value);
    setChoice(value);
    setOpen(false);
  };
  return <>
    <button type="button" className="brutti-analytics-link" onClick={() => setOpen(true)}>Analytics preferences</button>
    {open && <aside className="brutti-analytics-panel" aria-label="Analytics preferences">
      <strong>Your privacy choices</strong>
      <p>Allow optional Google Analytics cookies to help us understand how the catalogue is used. You can decline and still browse normally.</p>
      <div className="brutti-analytics-actions">
        <button type="button" onClick={() => choose("denied")}>Decline</button>
        <button type="button" onClick={() => choose("granted")}>Allow analytics</button>
      </div>
    </aside>}
  </>;
}
