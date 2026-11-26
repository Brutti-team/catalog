// One shared native observer for overview reveals and numbers. No scroll listeners.
let observer: IntersectionObserver | undefined;
const callbacks = new Map<Element, () => void>();

export function observeOverviewOnce(element: Element, callback: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback();
    return () => {};
  }
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < .12) continue;
      const run = callbacks.get(entry.target);
      callbacks.delete(entry.target);
      observer?.unobserve(entry.target);
      run?.();
    }
  }, { threshold: .12 });
  callbacks.set(element, callback);
  observer.observe(element);
  return () => {
    callbacks.delete(element);
    observer?.unobserve(element);
  };
}
