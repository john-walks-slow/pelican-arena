/**
 * At most one gallery card plays a live frame. Hovering activates one
 * immediately; leaving keeps it around briefly so moving across cards does not
 * tear down and refetch the frame. Touch screens keep the touched frame until
 * another card is activated.
 */
let activeSrc: string | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function cancelRelease() {
  if (releaseTimer === null) return;
  clearTimeout(releaseTimer);
  releaseTimer = null;
}

export function subscribeActivePreview(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActivePreview() {
  return activeSrc;
}

export function activatePreview(src: string) {
  cancelRelease();
  if (activeSrc === src) return;
  activeSrc = src;
  emit();
}

/** Keeps the frame alive briefly; a later activation cancels the release. */
export function releasePreview(src: string, delay = 1200) {
  if (activeSrc !== src) return;
  cancelRelease();
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (activeSrc !== src) return;
    activeSrc = null;
    emit();
  }, delay);
}

/** Drops the frame now — used when the owning card unmounts. */
export function clearPreview(src: string) {
  if (activeSrc !== src) return;
  cancelRelease();
  activeSrc = null;
  emit();
}
