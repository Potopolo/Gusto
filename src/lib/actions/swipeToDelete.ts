/**
 * Reusable Svelte action: swipe-left to delete on touch devices.
 *
 * Usage:
 *   <li use:swipeToDelete={{ onDelete: () => removeItem(id) }}>
 *     ...item content...
 *   </li>
 *
 * Behaviour:
 *  - Tracks horizontal drag with translateX inline style.
 *  - Cancels if the user is mostly scrolling vertically (locks axis after 8px).
 *  - On release: if dx < -threshold (default −96px), call onDelete().
 *    Otherwise spring back to 0.
 *  - A red/pink "Supprimer" backdrop is rendered behind the row via a
 *    pseudo-element on the host — but visuals are out of scope of the
 *    action; the action just sets data-swipe-progress=<0..1> on the host
 *    so CSS can react.
 *  - No-ops on non-touch input (mouse drags are not hijacked).
 */

export type SwipeToDeleteOptions = {
  onDelete: () => void;
  /** Pixels past which release triggers delete. Default 96. */
  threshold?: number;
  /** Max translate-X distance during drag. Default = threshold * 1.5. */
  maxTranslate?: number;
};

export function swipeToDelete(node: HTMLElement, opts: SwipeToDeleteOptions) {
  let options = opts;
  const getThreshold = () => options.threshold ?? 96;
  const getMax = () => options.maxTranslate ?? getThreshold() * 1.5;

  let startX = 0;
  let startY = 0;
  let dx = 0;
  let active = false; // gesture in progress
  let axisLocked: 'h' | 'v' | null = null;

  function setProgress(p: number) {
    node.style.transform = `translateX(${Math.min(0, p)}px)`;
    const prog = Math.min(1, Math.abs(p) / getThreshold());
    node.dataset.swipeProgress = prog.toFixed(2);
  }

  function reset(animate = true) {
    if (animate) node.style.transition = 'transform 180ms ease-out';
    node.style.transform = '';
    node.dataset.swipeProgress = '0';
    if (animate) {
      // clear transition after the animation so subsequent drags feel immediate
      setTimeout(() => {
        node.style.transition = '';
      }, 200);
    }
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    active = true;
    axisLocked = null;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    node.style.transition = '';
  }

  function onTouchMove(e: TouchEvent) {
    if (!active) return;
    const t = e.touches[0];
    const moveX = t.clientX - startX;
    const moveY = t.clientY - startY;

    // Decide axis once we've moved past 8px
    if (axisLocked === null) {
      if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return;
      axisLocked = Math.abs(moveX) > Math.abs(moveY) ? 'h' : 'v';
    }
    if (axisLocked !== 'h') return;

    // Only allow left drag (negative dx). Clamp.
    dx = Math.max(-getMax(), Math.min(0, moveX));
    setProgress(dx);
    // Prevent page horizontal scroll while we hijack the gesture
    if (e.cancelable) e.preventDefault();
  }

  function onTouchEnd() {
    if (!active) {
      reset(false);
      return;
    }
    active = false;
    if (dx <= -getThreshold()) {
      // Animate out then call onDelete
      node.style.transition = 'transform 180ms ease-out, opacity 180ms ease-out';
      node.style.transform = `translateX(-100%)`;
      node.style.opacity = '0';
      setTimeout(() => {
        options.onDelete();
        // Reset for re-rendered list reuse
        node.style.transition = '';
        node.style.transform = '';
        node.style.opacity = '';
        node.dataset.swipeProgress = '0';
      }, 180);
    } else {
      reset(true);
    }
  }

  function onTouchCancel() {
    active = false;
    reset(true);
  }

  // passive: false on touchmove so preventDefault works during horizontal drag
  node.addEventListener('touchstart', onTouchStart, { passive: true });
  node.addEventListener('touchmove', onTouchMove, { passive: false });
  node.addEventListener('touchend', onTouchEnd);
  node.addEventListener('touchcancel', onTouchCancel);

  return {
    update(next: SwipeToDeleteOptions) {
      options = next;
    },
    destroy() {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
    }
  };
}
