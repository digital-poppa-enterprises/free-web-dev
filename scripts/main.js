/**
 * main.js — Digital Poppa Enterprises: First 50 Web App Campaign
 * ---------------------------------------------------------------
 * All client-side behaviour for the static site.
 * No framework, no build step — plain ES2017+ JavaScript.
 *
 * Sections:
 *   1.  DOM references and shared state
 *   2.  Mobile navigation menu
 *   3.  Sticky header state (IntersectionObserver on campaign bar)
 *   4.  Scroll-reveal animations
 *   5.  Form setup - validation and Apps Script submission
 *   6.  Desktop application rail - docking / stopping logic
 *   7.  Mobile application modal - open, close, focus trap
 *   8.  Mobile floating "Apply now" CTA button
 *   9.  FAQ accordion
 *   10. In-page smooth scroll (anchor links)
 *
 * Configure the Apps Script endpoint as described in README.md.
 */

// 1. DOM REFERENCES AND SHARED STATE

const menuToggle        = document.querySelector(".menu-toggle");
const mobileMenu        = document.querySelector("#mobile-menu");
const header            = document.querySelector("#site-header");
const campaignBar       = document.querySelector(".campaign-bar");
const heroWrap          = document.querySelector(".hero-wrap");
const finalCta          = document.querySelector(".final-cta");
const desktopFormRail   = document.querySelector(".application-rail");
const originalForm      = document.querySelector("#application-form");
const mobileApply       = document.querySelector(".mobile-apply");
const mobileApplyTrigger= document.querySelector(".mobile-apply-trigger");
const applicationModal  = document.querySelector("#application-modal");
const modalSlot         = document.querySelector(".modal-form-slot");
const applicationEndpoint = "https://script.google.com/macros/s/AKfycbweLh2EvAiwrn9RdhZRFeK6ElrZaj6_u_uD7YREzUYUjzJ8wrsXAwIa9jidu-b3T_m9Rg/exec"; // Add the deployed Apps Script /exec URL here.

/** True when OS/browser prefers reduced motion */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tracks whether the user has successfully submitted any form instance */
let hasApplied = false;

/** Lazily-created clone of originalForm that lives inside the modal */
let modalForm = null;
let submissionInProgress = false;
const pendingSubmissions = new Map();

// 2. MOBILE NAVIGATION MENU
//    Toggle .is-open class and ARIA attributes on the button
//    and the menu panel. Clicking any menu link closes the menu.

/** Collapse the mobile menu and reset ARIA state */
function closeMenu() {
  if (!menuToggle || !mobileMenu) return;
  menuToggle.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
}

menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.classList.toggle("is-open", !open);
  menuToggle.setAttribute("aria-expanded", String(!open));
  menuToggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
  mobileMenu?.classList.toggle("is-open", !open);
  mobileMenu?.setAttribute("aria-hidden", String(open));
});

// Close menu when any nav link is tapped (smooth scroll takes over)
document
  .querySelectorAll(".mobile-menu a")
  .forEach((link) => link.addEventListener("click", closeMenu));

// ---------------------------------------------------------------
// 3. STICKY HEADER STATE
//    When the campaign bar scrolls out of view, add .is-sticky
//    to the header so CSS can apply a shadow / background change.
//    rootMargin: "-36px" keeps a 36 px buffer before triggering.
// ---------------------------------------------------------------

const headerObserver = new IntersectionObserver(
  ([entry]) => {
    header?.classList.toggle("is-sticky", !entry.isIntersecting);
  },
  { threshold: 0, rootMargin: "-36px 0px 0px" }
);
if (campaignBar) headerObserver.observe(campaignBar);


// ---------------------------------------------------------------
// 4. SCROLL-REVEAL ANIMATIONS
//    Elements with .reveal fade + slide in once they enter the
//    viewport. .reveal-delay staggers paired siblings.
//    If the user prefers reduced motion or IntersectionObserver
//    is unavailable, every element is shown immediately.
// ---------------------------------------------------------------

const revealItems = document.querySelectorAll(".reveal");

if (reducedMotion || !("IntersectionObserver" in window)) {
  // Accessibility: show everything right away, no motion
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target); // one-shot: stop watching once shown
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" }
  );
  revealItems.forEach((item) => revealObserver.observe(item));
}


// ---------------------------------------------------------------
// 5. FORM SETUP — VALIDATION AND SUCCESS STATE
// ---------------------------------------------------------------

/**
 * Mark a field as valid or invalid.
 * Uses aria-invalid for screen readers and .is-invalid for CSS styling.
 * @param {HTMLElement} field
 * @param {boolean} invalid
 */
function setInvalid(field, invalid) {
  field.setAttribute("aria-invalid", String(invalid));
  field.classList.toggle("is-invalid", invalid);
}

/**
 * Mark all form instances as submitted and hide the floating CTA.
 */
function markApplied() {
  hasApplied = true;
  document
    .querySelectorAll(".application-card")
    .forEach((form) => {
      form.classList.add("is-success");
      clearFormError(form);
    });
  mobileApply?.classList.remove("is-visible");
  mobileApply?.setAttribute("aria-hidden", "true");
}

/**
 * Show a submission error without discarding the user's answers.
 * @param {HTMLFormElement} form
 * @param {string} message
 */
function showFormError(form, message) {
  const errorMessage = form.querySelector(".form-error");
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearFormError(form) {
  const errorMessage = form.querySelector(".form-error");
  if (!errorMessage) return;
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function finishSubmission(requestId, success) {
  const pending = pendingSubmissions.get(requestId);
  if (!pending) return;

  pendingSubmissions.delete(requestId);
  window.clearTimeout(pending.timeout);
  pending.frame.remove();
  pending.button.disabled = false;
  pending.button.textContent = pending.buttonLabel;
  pending.form.removeAttribute("aria-busy");
  submissionInProgress = false;

  if (success) {
    markApplied();
    return;
  }

  showFormError(
    pending.form,
    "We couldn't confirm that your application was received. Please wait a moment before trying again, or contact us if the problem continues."
  );
}

window.addEventListener("message", (event) => {
  const result = event.data;
  if (!result || result.type !== "application-submission-result") return;

  const pending = pendingSubmissions.get(result.requestId);
  if (!pending || event.source !== pending.frame.contentWindow) return;
  finishSubmission(result.requestId, result.success === true);
});

/**
 * Submit the validated form to the Apps Script endpoint through a hidden
 * iframe so the static site does not need cross-origin response access.
 * @param {HTMLFormElement} form
 */
function handleFormSuccess(form) {
  if (submissionInProgress) {
    showFormError(form, "Your application is still being submitted. Please wait.");
    return;
  }

  let endpoint;
  try {
    endpoint = new URL(applicationEndpoint);
  } catch (error) {
    showFormError(form, "Applications are not connected yet. Please contact us directly.");
    return;
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== "script.google.com" ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname)
  ) {
    showFormError(form, "The application service is not configured correctly. Please contact us.");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  if (!button) {
    showFormError(form, "The application form could not be submitted. Please contact us.");
    return;
  }

  clearFormError(form);
  submissionInProgress = true;
  const buttonLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Submitting application...";
  form.setAttribute("aria-busy", "true");

  const requestId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let requestField = form.querySelector('input[name="requestId"]');
  if (!requestField) {
    requestField = document.createElement("input");
    requestField.type = "hidden";
    requestField.name = "requestId";
    form.append(requestField);
  }
  requestField.value = requestId;

  const frame = document.createElement("iframe");
  frame.name = `application-submission-${requestId}`;
  frame.title = "Application submission response";
  frame.hidden = true;
  frame.tabIndex = -1;
  document.body.append(frame);

  const timeout = window.setTimeout(
    () => finishSubmission(requestId, false),
    30000
  );
  pendingSubmissions.set(requestId, { form, button, buttonLabel, frame, timeout });

  form.action = endpoint.href;
  form.method = "post";
  form.target = frame.name;

  try {
    form.submit();
  } catch (error) {
    console.error("Could not submit the application.", error);
    finishSubmission(requestId, false);
  }
}

/**
 * Wire up validation and submit handling for a single form instance.
 * Guards with form.dataset.ready so it's safe to call on clones
 * without double-binding.
 * @param {HTMLFormElement|null} form
 */
function setupForm(form) {
  if (!form || form.dataset.ready === "true") return;
  form.dataset.ready = "true";

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // prevent page reload

    // Validate all required fields
    const required = [...form.querySelectorAll("[required]")];
    let firstInvalid = null;

    required.forEach((field) => {
      const invalid =
        !field.value.trim() ||
        (field.type === "email" && !field.validity.valid);
      setInvalid(field, invalid);
      if (invalid && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      firstInvalid.focus(); // move keyboard focus to the first problem field
      return;
    }

    handleFormSuccess(form);
  });

  // Clear invalid state as the user types / changes a field
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      setInvalid(field, false);
      clearFormError(form);
    });
    field.addEventListener("change", () => {
      setInvalid(field, false);
      clearFormError(form);
    });
  });
}

// Wire up the main form in the page
setupForm(originalForm);


// ============================================================
// 6. DESKTOP APPLICATION RAIL — DOCKING AND STOPPING
//    On desktop (> 1100 px), the application-rail is absolutely
//    positioned 88 px from the top of .hero-wrap, then becomes
//    position: fixed ("docked") as the user scrolls down, and
//    finally stops ("stopped") just above the final CTA section
//    to avoid overlapping it.
//
//    Three CSS classes drive the layout:
//      (default)   — position: absolute, top: 88px inside hero-wrap
//      .is-docked  — position: fixed, top: 130px in the viewport
//      .is-stopped — position: absolute, top: var(--rail-stop-top)
//
//    On mobile / tablet this function is a no-op (early return).
// ============================================================

const desktopRailBreakpoint = 1100; // px — matches the CSS breakpoint
const railDockTop   = 130; // px from viewport top when docked (fixed)
const railStaticTop =  88; // px from hero-wrap top when not docked

function updateDesktopFormRail() {
  if (!desktopFormRail || !heroWrap) return;

  // On narrow screens the rail is in normal flow — nothing to do
  if (window.innerWidth <= desktopRailBreakpoint) {
    desktopFormRail.classList.remove("is-docked", "is-stopped");
    desktopFormRail.style.removeProperty("--rail-stop-top");
    return;
  }

  // Document-relative Y coordinate of the rail's starting position.
  // Using getBoundingClientRect() + scrollY is more reliable than
  // offsetTop through nested positioned ancestors.
  const railDocumentTop =
    heroWrap.getBoundingClientRect().top + window.scrollY + railStaticTop;

  // Document-relative Y of the final CTA section (or Infinity if absent)
  const finalCtaDocumentTop = finalCta
    ? finalCta.getBoundingClientRect().top + window.scrollY
    : Number.POSITIVE_INFINITY;

  // The rail stops this many px above the final CTA (32 px gap)
  const railHeight = desktopFormRail.getBoundingClientRect().height;
  const stopDocumentTop = finalCtaDocumentTop - railHeight - 32;

  // Should the rail be fixed (docked)?
  const shouldDock = window.scrollY >= railDocumentTop - railDockTop;
  // Should the rail be stopped (absolute near the bottom of the wrap)?
  const shouldStop = shouldDock && window.scrollY >= stopDocumentTop - railDockTop;

  desktopFormRail.classList.toggle("is-docked",   shouldDock && !shouldStop);
  desktopFormRail.classList.toggle("is-stopped",  shouldStop);

  if (shouldStop) {
    // Calculate where the rail's top should sit relative to hero-wrap
    const stopTop = stopDocumentTop -
      (heroWrap.getBoundingClientRect().top + window.scrollY);
    desktopFormRail.style.setProperty(
      "--rail-stop-top",
      `${Math.max(railStaticTop, stopTop)}px`
    );
  } else {
    desktopFormRail.style.removeProperty("--rail-stop-top");
  }
}

// Run once on load, then on every scroll and resize
updateDesktopFormRail();
window.addEventListener("scroll", updateDesktopFormRail, { passive: true });
window.addEventListener("resize", updateDesktopFormRail);


// ============================================================
// 7. MOBILE APPLICATION MODAL — OPEN, CLOSE, FOCUS TRAP
//    Uses a custom <div role="dialog"> (not native <dialog>) so
//    CSS can animate the backdrop. We manage:
//      - Lazy form cloning (first open only)
//      - body overflow lock
//      - Focus returned to the trigger on close
//      - Escape key to close
//      - Full keyboard focus trap inside the dialog
// ============================================================

/**
 * Open the application modal.
 * Lazily clones originalForm into .modal-form-slot on first call.
 */
function openApplicationModal() {
  if (!applicationModal || !modalSlot || !originalForm || hasApplied) return;

  // Clone the form once and wire it up — subsequent opens reuse the clone
  if (!modalForm) {
    modalForm = originalForm.cloneNode(true);    // deep clone including children
    modalForm.id = "application-form-modal";
    modalForm.classList.remove("is-success");    // start in a clean state
    delete modalForm.dataset.ready;              // allow setupForm to bind events
    modalSlot.replaceChildren(modalForm);
    setupForm(modalForm);
  }

  applicationModal.hidden = false;
  document.body.classList.add("modal-open");    // lock background scroll via CSS

  // Move focus into the modal for keyboard users
  applicationModal.querySelector(".modal-close")?.focus();
}

/**
 * Close the application modal and restore focus to the trigger.
 */
function closeApplicationModal() {
  if (!applicationModal || applicationModal.hidden) return;
  applicationModal.hidden = true;
  document.body.classList.remove("modal-open");
  mobileApplyTrigger?.focus(); // return focus to the button that opened it
}

// Open on floating CTA click
mobileApplyTrigger?.addEventListener("click", openApplicationModal);

// Close on backdrop click or close button click
document
  .querySelectorAll("[data-modal-close]")
  .forEach((element) => element.addEventListener("click", closeApplicationModal));

// Close on Escape key (global)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && applicationModal && !applicationModal.hidden) {
    closeApplicationModal();
  }
});

// Keyboard focus trap — keep Tab and Shift+Tab cycling inside the dialog
if (applicationModal) {
  applicationModal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;

    // Collect all naturally-focusable, non-disabled elements
    const focusable = [
      ...applicationModal.querySelectorAll("button, input, select, textarea, a"),
    ].filter((item) => !item.disabled);

    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      // Shift+Tab at the first element → wrap to the last
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      // Tab at the last element → wrap to the first
      event.preventDefault();
      first.focus();
    }
  });
}


// ============================================================
// 8. MOBILE FLOATING "APPLY NOW" CTA BUTTON
//    Visible on screens ≤ 1100 px only.
//    Logic:
//      - hasSeenForm: true once the main form has been in the
//        viewport at least once (user scrolled to it)
//      - Show the button when: on mobile AND hasSeenForm AND
//        the form is NOT currently visible AND hasn't been submitted
//      - Hide permanently once hasApplied is true
// ============================================================

if (mobileApply && mobileApplyTrigger) {
  let hasSeenForm = false;

  /**
   * Sync the floating CTA's visibility based on current state.
   * @param {boolean} isIntersecting — whether the form is in the viewport
   */
  function syncMobileApply(isIntersecting) {
    const shouldShow =
      window.innerWidth <= 1100 &&
      hasSeenForm          &&
      !isIntersecting      &&
      !hasApplied;
    mobileApply.classList.toggle("is-visible", shouldShow);
    mobileApply.setAttribute("aria-hidden", String(!shouldShow));
  }

  // Watch the main form with IntersectionObserver
  const mobileObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) hasSeenForm = true; // mark as seen on first entry
      syncMobileApply(entry.isIntersecting);
    },
    { threshold: 0, rootMargin: "-30px 0px 0px" }
  );

  if (originalForm) {
    mobileObserver.observe(originalForm);

    // Also update on resize (e.g. rotating a phone)
    window.addEventListener("resize", () => {
      const formRect = originalForm.getBoundingClientRect();
      const isIntersecting =
        formRect.top < window.innerHeight && formRect.bottom > 0;
      if (isIntersecting) hasSeenForm = true;
      syncMobileApply(isIntersecting);
    });
  }
}


// ============================================================
// 9. FAQ ACCORDION
//    Single-open: clicking a trigger opens that item and closes
//    all others. Clicking an open item closes it.
//    The ± indicator inside each button is updated via CSS
//    (data-expanded attribute is set alongside aria-expanded).
// ============================================================

document.querySelectorAll(".faq-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const expanded = trigger.getAttribute("aria-expanded") === "true";

    // Close every trigger in the group first
    document
      .querySelectorAll(".faq-trigger")
      .forEach((other) => other.setAttribute("aria-expanded", "false"));

    // Then toggle the clicked one (opens if was closed, stays closed if was open)
    trigger.setAttribute("aria-expanded", String(!expanded));
  });
});


// ============================================================
// 10. IN-PAGE SMOOTH SCROLL
//     Override default anchor jump behaviour so the page scrolls
//     smoothly to the target. Respects prefers-reduced-motion by
//     using "auto" (instant) instead of "smooth".
//     Note: CSS `scroll-behavior: smooth` handles most cases;
//     this JS version gives finer control and reduced-motion safety.
// ============================================================

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
});
