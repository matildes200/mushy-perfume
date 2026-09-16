// Legal pages — sections arrive as they are reached.
//
// There is deliberately no section index: these documents are meant to be read
// through, not picked over, and a list of shortcuts invites skipping to the
// clause you already agree with.

(() => {
  const blocks = Array.from(document.querySelectorAll(".legal-doc .policy-block"));
  if (!blocks.length) return;

  // Applied by script, never by the stylesheet: if this fails the document must
  // still be readable rather than blank.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  blocks.forEach((b) => b.classList.add("legal-hidden"));
  const reveal = new IntersectionObserver(
    (records, obs) => {
      records.forEach((r) => {
        if (!r.isIntersecting) return;
        r.target.classList.remove("legal-hidden");
        obs.unobserve(r.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.02 }
  );
  blocks.forEach((b) => reveal.observe(b));
})();
