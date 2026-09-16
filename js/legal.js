// Legal pages — the index down the side, and which section you are in.
//
// Built from the headings that are already on the page rather than maintained
// by hand: adding a section to the document adds it to the index, and it stays
// right when the page is translated.

(() => {
  const index = document.getElementById("legalIndex");
  const blocks = Array.from(document.querySelectorAll(".legal-doc .policy-block[id]"));
  if (!index || blocks.length < 3) return;

  const entries = blocks
    .map((block) => {
      const heading = block.querySelector("h3");
      if (!heading) return null;
      // "1. Identificação da Empresa" -> number and title, so the index can set
      // them in different weights without the markup having to carry spans.
      const raw = heading.textContent.trim();
      const match = raw.match(/^(\d+)\.\s*(.+)$/);
      return {
        id: block.id,
        num: match ? match[1] : "",
        title: match ? match[2] : raw,
        block,
      };
    })
    .filter(Boolean);

  index.innerHTML =
    `<p class="legal-index-title">Nesta página</p><ol class="legal-index-list">` +
    entries
      .map(
        (e) =>
          `<li><a href="#${e.id}" data-index-for="${e.id}">` +
          (e.num ? `<span class="legal-index-num">${e.num}</span>` : "") +
          `<span class="legal-index-text">${e.title}</span></a></li>`
      )
      .join("") +
    `</ol>`;

  const links = new Map(
    Array.from(index.querySelectorAll("[data-index-for]")).map((a) => [a.dataset.indexFor, a])
  );

  // Which section is being read. The observer reports what is on screen; the
  // topmost of those is the one the index should mark, so a long section does
  // not hand the marker to the next one the moment its heading scrolls away.
  const visible = new Set();
  const mark = () => {
    let current = null;
    for (const e of entries) {
      if (visible.has(e.id)) { current = e.id; break; }
    }
    links.forEach((a, id) => a.classList.toggle("current", id === current));
  };

  const spy = new IntersectionObserver(
    (records) => {
      records.forEach((r) => {
        if (r.isIntersecting) visible.add(r.target.id);
        else visible.delete(r.target.id);
      });
      mark();
    },
    // The band excludes the sticky header, and stops short of the bottom so the
    // marker follows what is actually being read rather than what is about to
    // appear.
    { rootMargin: "-96px 0px -55% 0px", threshold: 0 }
  );
  entries.forEach((e) => spy.observe(e.block));

  // Sections arrive as they are reached. Anything already on screen is shown at
  // once — a document must never be blank because an observer has not fired.
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!motion.matches) {
    entries.forEach((e) => e.block.classList.add("legal-hidden"));
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
    entries.forEach((e) => reveal.observe(e.block));
  }

  // Rebuilt on a language change, or the index would still be in Portuguese
  // while the document beside it is in English.
  document.addEventListener("lang:changed", () => {
    entries.forEach((e) => {
      const heading = e.block.querySelector("h3");
      if (!heading) return;
      const raw = heading.textContent.trim();
      const match = raw.match(/^(\d+)\.\s*(.+)$/);
      const link = links.get(e.id);
      const text = link?.querySelector(".legal-index-text");
      if (text) text.textContent = match ? match[2] : raw;
    });
  });
})();
