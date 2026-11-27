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
      <div className="brutti-analytics-heading">
        <span className="brutti-analytics-symbol" aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4.5 6v5.2c0 4.5 3.1 7.6 7.5 9.8 4.4-2.2 7.5-5.3 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>
        </span>
        <div><span className="brutti-analytics-kicker">PRIVACY & COOKIES</span><strong>Your privacy choices</strong></div>
      </div>
      <p>Optional Google Analytics cookies help us improve your catalogue experience. You can decline and browse as usual.</p>
      <div className="brutti-analytics-actions">
        <button type="button" onClick={() => choose("denied")}>Decline</button>
        <button type="button" onClick={() => choose("granted")}>Allow analytics</button>
      </div>
    </aside>}
  </>;
}
