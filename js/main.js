// Referral links point to conta.html?ref=CODE; the code is stashed until the
// visitor actually finishes creating an account (see showProfile() in conta.js).
const refParam = new URLSearchParams(window.location.search).get("ref");
if (refParam) localStorage.setItem("mushy-pending-ref", refParam.toUpperCase());

// Reloading returns the reader to the section they were in. "auto" is the
// browser's own restore, which handles this better than replaying a saved
// offset would (it waits for layout). The header no longer needs the old
// force-to-top workaround now that it's sticky rather than fixed.
if ("scrollRestoration" in history) history.scrollRestoration = "auto";

const siteHeader = document.getElementById("siteHeader");
const heroMedia = document.getElementById("heroMedia");

const grid = document.getElementById("productGrid");
const filters = document.getElementById("filters");
const featuredGrid = document.getElementById("featuredGrid");
const carousel = document.getElementById("carousel");
const carouselTrack = document.getElementById("carouselTrack");
const carouselPrev = document.getElementById("carouselPrev");
const carouselNext = document.getElementById("carouselNext");

const searchBtn = document.getElementById("searchBtn");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchClose = document.getElementById("searchClose");

const cartBtn = document.getElementById("cartBtn");
const cartClose = document.getElementById("cartClose");
const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartItemsEl = document.getElementById("cartItems");
const cartSubtotalEl = document.getElementById("cartSubtotal");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");

const couponToggle = document.getElementById("couponToggle");
const couponFieldWrap = document.getElementById("couponFieldWrap");
const couponInput = document.getElementById("couponInput");
const applyCouponBtn = document.getElementById("applyCouponBtn");
const removeCouponBtn = document.getElementById("removeCouponBtn");
const couponMessageEl = document.getElementById("couponMessage");
const cartSubtotalRow = document.getElementById("cartSubtotalRow");
const couponDiscountRow = document.getElementById("couponDiscountRow");
const appliedCouponCodeEl = document.getElementById("appliedCouponCode");
const cartDiscountEl = document.getElementById("cartDiscount");

const wishlistBtn = document.getElementById("wishlistBtn");
const wishlistClose = document.getElementById("wishlistClose");
const wishlistOverlay = document.getElementById("wishlistOverlay");
const wishlistDrawer = document.getElementById("wishlistDrawer");
const wishlistItemsEl = document.getElementById("wishlistItems");
const wishlistCountEl = document.getElementById("wishlistCount");

const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

const newsletterForm = document.getElementById("newsletterForm");
const newsletterEmail = document.getElementById("newsletterEmail");
const newsletterNote = document.getElementById("newsletterNote");

// A non-breaking space before "Kz" keeps the amount and currency together —
// a plain space is a valid line-break point, and on narrow mobile cards the
// number and "Kz" could end up wrapping onto separate lines.
const money = (v) => `${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

// Effective price after discount_percent (0 when the column doesn't exist yet
// or hasn't been set, so pre-migration data still renders correctly).
const effectivePrice = (p) => p.price * (1 - (p.discount_percent || 0) / 100);
const isOutOfStock = (p) => p.stock !== undefined && p.stock !== null && p.stock <= 0;

// The discount sits on its own line *under* the price rather than beside it,
// so the current price is always the first line of the block and every card in
// a row lines its name and price up at the same height, discounted or not.
function priceMarkup(p, className) {
  if (!p.discount_percent) return `<span class="${className}"><span class="price-final">${money(p.price)}</span></span>`;
  return `<span class="${className} price-discounted">
    <span class="price-final">${money(effectivePrice(p))}</span>
    <span class="price-was">
      <span class="price-original">${money(p.price)}</span>
      <span class="price-badge">-${p.discount_percent}%</span>
    </span>
  </span>`;
}

function stockBadge(p) {
  return isOutOfStock(p) ? `<span class="stock-badge" data-i18n="product.soldout">Esgotado</span>` : "";
}

function addButton(p, label, labelKey) {
  return isOutOfStock(p)
    ? `<button class="btn btn-small" disabled data-i18n="product.soldout">Esgotado</button>`
    : `<button class="btn btn-small" data-add="${p.id}" data-i18n="${labelKey}">${label}</button>`;
}

// Resolved to an absolute URL: a relative url() stored in a CSS custom property
// resolves against the stylesheet that reads it via var(), not against this page,
// so a plain relative path breaks once it's consumed from css/style.css.
const cardImageUrl = (path) => new URL(path, document.baseURI).href;

// Search terms that should match a category even though they never appear in the data
// (e.g. "perfume de mulher" should surface the feminino products).
const CATEGORY_SEARCH_TERMS = {
  feminino: ["feminino", "femininos", "feminina", "femininas", "mulher", "mulheres", "ela", "woman", "women", "female", "ladies"],
  masculino: ["masculino", "masculinos", "masculina", "masculinas", "homem", "homens", "ele", "man", "men", "male", "mens"],
  // "unissexo" is how people actually write it, and it is NOT reachable from
  // "unissex" by prefix — the typed word is the longer one — so it has to be
  // listed in its own right.
  unissex: ["unissex", "unissexo", "unissexos", "unisex", "unisexo"],
};

const ACCENT_FOLD = { á: "a", à: "a", â: "a", ã: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", õ: "o", ö: "o", ú: "u", ù: "u", û: "u", ü: "u", ç: "c" };

// Accents folded, case dropped, and punctuation flattened to spaces, so
// "eclat dor", "ÉCLAT D'OR" and "eclat d or" all normalise to the same thing.
// Without the punctuation step an apostrophe in a product name made it
// unsearchable by anyone typing it without one.
const normalizeText = (str) =>
  String(str || "")
    .toLowerCase()
    .split("")
    .map((ch) => ACCENT_FOLD[ch] || ch)
    .join("")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Portuguese plurals reduced to a common stem, so "perfumes" and "perfume",
// "fragrâncias" and "fragrância", "colecções" and "colecção" all collide.
// Applied to both sides of a comparison, so it never matters which form was
// typed and which is stored.
function singularize(word) {
  if (word.length <= 3) return word;
  if (word.endsWith("oes") || word.endsWith("aes")) return word.slice(0, -3) + "ao"; // colecçoes -> colecçao
  if (word.endsWith("ais") || word.endsWith("eis") || word.endsWith("ois")) return word.slice(0, -2) + "l";
  if (word.endsWith("ns")) return word.slice(0, -2) + "m"; // homens -> homem
  if (word.endsWith("res") || word.endsWith("ses") || word.endsWith("zes")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

// Words that describe the shop rather than any one bottle. Typing one of these
// returns the whole catalogue instead of nothing — "perfumes" should never be
// a dead end on a perfume shop. Stored singularised; matched as a prefix so
// "perfum", "fragranc" and "colec" all count.
const GENERIC_SITE_TERMS = [
  "perfume", "perfumaria", "parfum", "fragrancia", "fragrance", "aroma", "essencia",
  "cheiro", "colecao", "coleccao", "catalogo", "produto", "artigo", "frasco",
  "scent", "product", "tudo", "todo", "all",
];
// Below this length a query is treated as the start of a name, not as a
// general term — otherwise a single "p" would return the entire shop.
const GENERIC_MIN_LENGTH = 3;

function matchesGenericTerm(word) {
  if (word.length < GENERIC_MIN_LENGTH) return false;
  return GENERIC_SITE_TERMS.some((term) => term.startsWith(word));
}

// Everything a shopper might reasonably type, in one normalised string: the
// name, the brand, the olfactory family and notes, the concentration, and the
// words people use for a category ("perfume de mulher" finds the feminino
// range) — the old version only looked at name and notes.
function productHaystack(p) {
  if (!p._haystack) {
    p._haystack = normalizeText(
      [
        p.name, p.brand, p.fragrance_family, p.concentration,
        p.notes, p.notes_top, p.notes_heart, p.notes_base,
        p.short_description, p.description,
      ]
        .filter(Boolean)
        .join(" ")
    );
    // Spaces stripped as well, so a name whose punctuation became a space still
    // matches when someone types it closed up: "Éclat d'Or" normalises to
    // "eclat d or", and only this compact form contains "dor".
    p._haystackCompact = p._haystack.replace(/\s+/g, "");
    // Singularised word list, so a plural in the data matches a singular query
    // and the other way round.
    p._tokens = p._haystack.split(" ").filter(Boolean).map(singularize);
  }
  return p;
}

// Category words are matched as prefixes of a known term, not as substrings of
// one big text blob. Blob matching meant "men" hit the feminino range too,
// because "women" contains it. Prefix matching keeps "femin" → feminino and
// "uniss" → unissex working while "men" only reaches masculino.
function matchesCategoryTerm(p, word) {
  const terms = CATEGORY_SEARCH_TERMS[p.category] || [];
  return terms.some((term) => term.startsWith(word) || singularize(term).startsWith(word));
}

// Every word in the query has to match something. In order of breadth:
//   - a general word for the shop itself ("perfumes", "fragrâncias") → all
//   - the start of any word in the product's own text, plural-insensitive
//   - the product text as raw substrings, which catches mid-word and the
//     punctuation-stripped form ("dor" → Éclat d'Or)
//   - the product's category
function productMatchesSearch(p, normalizedQuery) {
  if (!normalizedQuery) return true;
  productHaystack(p);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((raw) => {
      const word = singularize(raw);
      return (
        matchesGenericTerm(word) ||
        p._tokens.some((token) => token.startsWith(word)) ||
        p._haystack.includes(raw) ||
        p._haystackCompact.includes(raw) ||
        matchesCategoryTerm(p, word) ||
        matchesCategoryTerm(p, raw)
      );
    });
}

let cart = JSON.parse(localStorage.getItem("mushy-cart") || "{}");
let wishlist = JSON.parse(localStorage.getItem("mushy-wishlist") || "[]");
let activeFilter = "todos";

function saveCart() {
  localStorage.setItem("mushy-cart", JSON.stringify(cart));
}
function saveWishlist() {
  localStorage.setItem("mushy-wishlist", JSON.stringify(wishlist));
}

function bottleIcon() {
  return `<svg viewBox="0 0 100 130" class="bottle-icon"><path d="M40 10h20v9c5 3 8 8 8 15v75a7 7 0 0 1-7 7H39a7 7 0 0 1-7-7V34c0-7 3-12 8-15v-9z" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="44" y="4" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><line x1="32" y1="60" x2="68" y2="60" stroke="currentColor" stroke-width="1.4"/></svg>`;
}

function wishlistHeart(id) {
  const active = wishlist.includes(id);
  return `<button class="wishlist-btn${active ? " active" : ""}" data-wishlist="${id}" aria-label="Favoritar">
    <svg viewBox="0 0 24 24" fill="${active ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  </button>`;
}

function mediaContent(p) {
  return p.image
    ? `<img src="${p.image}" alt="${p.name}" class="product-photo" loading="lazy">`
    : bottleIcon();
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// The olfactory family only ("Floral", "Amadeirado"). The masculino/feminino/
// unissex category is deliberately not shown on the card — it's a filter, not
// something a shopper needs printed under every bottle. fragrance_family is
// admin-entered free text and often blank on older products, hence the guard.
function familyLabel(p) {
  return p.fragrance_family || "";
}

// Only ever one badge (never both at once, to avoid cluttering the corner),
// and only when the product's own flag supports it — never hard-coded.
function badgeMarkup(p) {
  if (p.bestseller) return `<span class="perfume-badge badge-bestseller" data-i18n="badge.bestseller">Mais Vendido</span>`;
  if (p.new_arrival) return `<span class="perfume-badge badge-new" data-i18n="badge.new">Novidade</span>`;
  return "";
}

// The back of the card is the detail view — there is no "ver detalhes" link,
// because clicking through to another page would defeat the point of flipping.
// Everything a shopper needs lives here: name and brand, the olfactory
// pyramid, the size, and the price with its discount.
//
// notes_top/heart/base are admin-entered and still blank on most products, so
// the pyramid falls back to the free-text notes field rather than leaving the
// back half empty. Every row is omitted when it has nothing to say.
function noteRow(labelKey, fallbackLabel, value) {
  if (!value) return "";
  return `<div class="flip-note-row">
    <span class="flip-note-label" data-i18n="${labelKey}">${fallbackLabel}</span>
    <span class="flip-note-value">${value}</span>
  </div>`;
}

function backContent(p) {
  const pyramid =
    noteRow("notes.top", "Saída", p.notes_top) +
    noteRow("notes.heart", "Coração", p.notes_heart) +
    noteRow("notes.base", "Fundo", p.notes_base);

  // Nothing structured on this product yet — show whatever notes text exists.
  const fallbackNotes = !pyramid && (p.notes || p.short_description || p.description);

  const size = [p.volume_ml ? `${p.volume_ml} ml` : "", p.concentration].filter(Boolean).join(" · ");

  return `
    <div class="flip-back-head">
      ${p.brand ? `<span class="flip-back-brand">${p.brand}</span>` : ""}
      <h3 class="flip-back-name">${p.name}</h3>
      ${familyLabel(p) ? `<span class="flip-back-family">${familyLabel(p)}</span>` : ""}
    </div>
    <div class="flip-back-notes">
      ${pyramid}
      ${fallbackNotes ? `<p class="flip-back-fallback">${fallbackNotes}</p>` : ""}
    </div>
    <div class="flip-back-meta">
      ${size ? `<span class="flip-back-size">${size}</span>` : ""}
      ${priceMarkup(p, "flip-back-price")}
    </div>`;
}

// Shared by .product-card / .carousel-card / .featured-card. The card flips:
// the front is the bottle with its name and price underneath, and tapping it
// turns the card over to the notes and the add-to-cart button. Nothing on the
// front is buyable — you have to flip first, which is the whole point.
function perfumeCardTemplate(p, wrapClass, addLabel, addLabelKey) {
  const toneClass = p.image ? "" : ` ${p.tone}`;
  const style = p.image ? ` style="--card-image:url('${cardImageUrl(p.image)}')"` : "";
  const description = p.short_description || p.notes || "";
  const family = familyLabel(p);
  // data-img drives the skeleton: the shimmer stays until this URL has loaded.
  const imgAttr = p.image ? ` data-img="${cardImageUrl(p.image)}"` : "";
  return `
    <article class="${wrapClass} flip-card">
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <div class="perfume-card-media-wrap${p.image ? " is-loading" : ""}"${imgAttr}>
            <div class="perfume-card-media${toneClass}"${style}>
              ${p.image ? "" : `<div class="product-card-icon">${bottleIcon()}</div>`}
            </div>
            ${badgeMarkup(p)}
            ${stockBadge(p)}
            ${wishlistHeart(p.id)}
          </div>
          <div class="perfume-card-body">
            <h3 class="perfume-card-name">${p.name}</h3>
            ${priceMarkup(p, "perfume-card-price")}
          </div>
        </div>
        <div class="flip-face flip-back">
          ${backContent(p)}
          <div class="flip-back-actions">
            ${addButton(p, addLabel, addLabelKey)}
          </div>
        </div>
      </div>
    </article>`;
}

// One delegated handler for every grid on the page. Anything that already does
// something of its own — the heart, add-to-cart — is left alone; everywhere
// else on the card toggles the flip.
//
// The gesture is measured before it counts as a tap. A finger that brushes a
// card while the page is moving still fires a click, and that click used to
// flip the card and show its pale back face — which is exactly what "the image
// turns white when I accidentally touch it while scrolling" was. A tap now has
// to stay within TAP_SLOP pixels and finish inside TAP_MS, so a scroll, a
// flick, or a long press never flips anything.
const TAP_SLOP = 10;
const TAP_MS = 500;
let tapStart = null;

document.addEventListener(
  "pointerdown",
  (e) => { tapStart = { x: e.clientX, y: e.clientY, t: Date.now() }; },
  { passive: true }
);
// Any scroll at all cancels the pending tap, however small the finger movement
// looked — momentum scrolling can register almost no delta at the fingertip.
window.addEventListener("scroll", () => { tapStart = null; }, { passive: true });

document.addEventListener("click", (e) => {
  const card = e.target.closest(".flip-card");
  if (!card) return;
  if (e.target.closest("[data-wishlist], [data-add], button, a")) return;

  if (tapStart) {
    const movedTooFar =
      Math.abs(e.clientX - tapStart.x) > TAP_SLOP || Math.abs(e.clientY - tapStart.y) > TAP_SLOP;
    if (movedTooFar || Date.now() - tapStart.t > TAP_MS) {
      tapStart = null;
      return;
    }
  } else if (e.pointerType !== "mouse" && e.detail === 0) {
    // No tracked press and not a real click — treat it as stray.
    return;
  }
  tapStart = null;
  card.classList.toggle("flipped");
});

// Swaps the shimmer for the photo once the photo is actually decoded. The card
// image is a CSS background, so there's no <img> load event to hook — we warm
// the same URL through the cache and let the background paint from there.
function hydrateCardImages(root = document) {
  root.querySelectorAll(".perfume-card-media-wrap.is-loading[data-img]").forEach((wrap) => {
    const done = () => wrap.classList.remove("is-loading");
    const img = new Image();
    img.onload = done;
    img.onerror = done;
    img.src = wrap.dataset.img;
    if (img.complete) done();
  });
}

function productCardTemplate(p) { return perfumeCardTemplate(p, "product-card", "Adicionar", "product.add"); }
function featuredCardTemplate(p) { return perfumeCardTemplate(p, "featured-card", "Comprar", "product.buy"); }
function carouselCardTemplate(p) { return perfumeCardTemplate(p, "carousel-card", "Adicionar", "product.add"); }

const CATEGORY_ORDER = { masculino: 0, feminino: 1, unissex: 2 };

// Hidden by an admin (active === false) but tolerant of the column not
// existing yet, so the storefront still works before the migration runs.
const isVisible = (p) => p.active !== false;

function renderProducts() {
  if (!grid) return;
  const query = searchInput ? normalizeText(searchInput.value.trim()) : "";
  const items = PRODUCTS.filter((p) => {
    const matchesCategory = activeFilter === "todos" || p.category === activeFilter;
    return isVisible(p) && matchesCategory && productMatchesSearch(p, query);
  }).sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);
  grid.innerHTML = items.length
    ? items.map(productCardTemplate).join("")
    : `<p class="cart-empty" data-i18n="product.notfound">Nenhum perfume encontrado.</p>`;
  hydrateCardImages(grid);
  // Re-render happens on every filter/search change, so the freshly built
  // cards need another translation pass to pick the current language back up.
  window.applyTranslations?.(window.getLang?.());
}

function renderFeatured() {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = PRODUCTS.filter((p) => isVisible(p) && p.featured).map(featuredCardTemplate).join("");
  hydrateCardImages(featuredGrid);
}

function renderCarousel() {
  if (!carouselTrack) return;
  const cards = PRODUCTS.filter((p) => isVisible(p) && p.bestseller).map(carouselCardTemplate).join("");
  carouselTrack.innerHTML = `${cards}
    <a href="colecao.html" class="carousel-end-card">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <span data-i18n="carousel.vertodos">Ver todos<br>os produtos</span>
    </a>`;
  hydrateCardImages(carouselTrack);
}

// ---------- Reviews carousel ----------
// One continuous marquee, not a step-and-rewind.
//
// The previous version advanced one card at a time and, on reaching the end,
// animated all the way back to the start using the SAME duration as a
// one-card step — so the rewind covered four cards' width in the time a step
// covered one, running about four times faster. That burst is what read as
// cards "accelerating past the others"; it was never a per-card animation.
//
// This version cannot have that problem by construction. The whole set is
// duplicated once and a single CSS transform slides the one track element
// from 0 to -50%. At -50% the second copy sits exactly where the first
// started, so the animation restarts on an identical frame and the loop is
// seamless — there is no rewind to be fast. Because it is one transform on
// one element, every card moves by the same pixels at the same instant; no
// card can travel at its own rate.
//
// The timing function is linear on purpose. An ease curve on a never-ending
// loop would visibly speed up and slow down each cycle, which is exactly the
// acceleration this is meant to remove. Constant speed is what "one speed for
// every card" actually means here.
(() => {
  const track = document.getElementById("reviewsTrack");
  if (!track) return;

  // The clones make -50% land on an identical frame. They are decorative
  // repeats, so they are hidden from assistive tech.
  const originals = Array.from(track.children);
  originals.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.dataset.clone = "true";
    track.appendChild(clone);
  });

  // Touching the strip pauses it so a comment can actually be read, and it
  // resumes from where it stopped rather than jumping.
  const viewport = document.getElementById("reviewsGrid");
  let resumeTimer = null;
  const pause = () => {
    track.classList.add("paused");
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => track.classList.remove("paused"), 5000);
  };
  ["touchstart", "pointerdown"].forEach((ev) => viewport?.addEventListener(ev, pause, { passive: true }));
})();

// ---------- Coupons ----------
// Only the code/type/value/min_order_value returned by validate_coupon are cached
// here — the RPC (not this cache) is the source of truth, called again on every
// apply and never trusted past that without re-validating server-side.
let appliedCoupon = JSON.parse(localStorage.getItem("mushy-coupon") || "null");

function saveCoupon() {
  if (appliedCoupon) localStorage.setItem("mushy-coupon", JSON.stringify(appliedCoupon));
  else localStorage.removeItem("mushy-coupon");
}

function cartSubtotal() {
  return Object.keys(cart).reduce((sum, id) => {
    const p = PRODUCTS.find((x) => x.id === Number(id));
    return p ? sum + effectivePrice(p) * cart[id] : sum;
  }, 0);
}

function couponDiscountAmount(subtotal) {
  if (!appliedCoupon || subtotal < appliedCoupon.min_order_value) return 0;
  if (appliedCoupon.discount_type === "percentage") return subtotal * (appliedCoupon.discount_value / 100);
  return Math.min(appliedCoupon.discount_value, subtotal);
}

// The RPC's reason_code maps straight onto a "coupon.<code>" translation key,
// so these messages follow the selected language like everything else.
const couponReasonMessage = (reasonCode) =>
  window.t?.(`coupon.${reasonCode}`) || window.t?.("coupon.invalid") || "Cupão inválido.";

function showCouponMessage(text, type) {
  if (!couponMessageEl) return;
  couponMessageEl.textContent = text;
  couponMessageEl.className = `coupon-message${type ? ` ${type}` : ""}`;
}

// The coupon input starts collapsed behind a small toggle so it doesn't
// crowd out the product list; a coupon that's already applied is shown
// via the discount row instead, so the toggle only reappears once removed.
function setCouponToggleState() {
  if (couponToggle) couponToggle.style.display = appliedCoupon ? "none" : "block";
  if (couponFieldWrap) couponFieldWrap.style.display = "none";
}

couponToggle?.addEventListener("click", () => {
  couponToggle.style.display = "none";
  if (couponFieldWrap) couponFieldWrap.style.display = "flex";
  couponInput?.focus();
});

async function applyCoupon() {
  const code = couponInput?.value.trim();
  if (!code) return;
  applyCouponBtn.disabled = true;
  const subtotal = cartSubtotal();
  try {
    const { data, error } = await supabaseClient.rpc("validate_coupon", { p_code: code, p_order_total: subtotal });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result) {
      showCouponMessage(window.t?.("coupon.validate.error") || "Não foi possível validar este cupão.", "error");
      return;
    }
    if (!result.valid) {
      if (result.reason_code === "min_order") {
        showCouponMessage(window.t?.("coupon.minorder", { amount: money(result.min_order_value) }), "error");
      } else {
        showCouponMessage(couponReasonMessage(result.reason_code), "error");
      }
      return;
    }
    appliedCoupon = {
      code: code.toUpperCase(),
      discount_type: result.discount_type,
      discount_value: Number(result.discount_value),
      min_order_value: Number(result.min_order_value || 0),
    };
    saveCoupon();
    couponInput.value = "";
    setCouponToggleState();
    showCouponMessage(window.t?.("coupon.applied", { code: appliedCoupon.code }), "success");
    updateCartUI();
  } finally {
    applyCouponBtn.disabled = false;
  }
}

function removeCoupon() {
  appliedCoupon = null;
  saveCoupon();
  setCouponToggleState();
  showCouponMessage("", "");
  updateCartUI();
}

applyCouponBtn?.addEventListener("click", applyCoupon);
couponInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } });
removeCouponBtn?.addEventListener("click", removeCoupon);
setCouponToggleState();

function updateCartUI() {
  const ids = Object.keys(cart);
  const totalCount = ids.reduce((sum, id) => sum + cart[id], 0);
  cartCountEl.textContent = totalCount;
  cartCountEl.style.display = totalCount > 0 ? "flex" : "none";

  if (ids.length === 0) {
    cartItemsEl.innerHTML = `<p class="cart-empty" data-i18n="cart.empty">Seu carrinho está vazio.</p>`;
    window.applyTranslations?.(window.getLang?.());
    if (cartSubtotalEl) cartSubtotalEl.textContent = money(0);
    if (cartSubtotalRow) cartSubtotalRow.style.display = "none";
    if (couponDiscountRow) couponDiscountRow.style.display = "none";
    cartTotalEl.textContent = money(0);
    checkoutBtn.classList.add("disabled");
    return;
  }

  checkoutBtn.classList.remove("disabled");

  let subtotal = 0;
  cartItemsEl.innerHTML = ids
    .map((id) => {
      const p = PRODUCTS.find((x) => x.id === Number(id));
      const qty = cart[id];
      subtotal += effectivePrice(p) * qty;
      return `
      <div class="cart-item" data-cart-view="${p.id}">
        <div class="cart-item-media ${p.image ? "" : p.tone}">${mediaContent(p)}</div>
        <div class="cart-item-info">
          <strong>${p.name}</strong>
          <span>${money(effectivePrice(p))}</span>
          <div class="qty-control">
            <button data-dec="${p.id}" aria-label="Diminuir quantidade">−</button>
            <span>${qty}</span>
            <button data-inc="${p.id}" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
        <button class="remove-btn" data-remove="${p.id}" aria-label="Remover item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`;
    })
    .join("");

  const discount = couponDiscountAmount(subtotal);
  const total = Math.max(0, subtotal - discount);
  if (cartSubtotalEl) cartSubtotalEl.textContent = money(subtotal);

  if (couponDiscountRow) {
    if (appliedCoupon && discount > 0) {
      if (cartSubtotalRow) cartSubtotalRow.style.display = "flex";
      couponDiscountRow.style.display = "flex";
      if (appliedCouponCodeEl) appliedCouponCodeEl.textContent = appliedCoupon.code;
      if (cartDiscountEl) cartDiscountEl.textContent = `-${money(discount)}`;
    } else {
      if (cartSubtotalRow) cartSubtotalRow.style.display = "none";
      couponDiscountRow.style.display = "none";
      if (appliedCoupon) showCouponMessage(window.t?.("coupon.addmore", { amount: money(appliedCoupon.min_order_value - subtotal), code: appliedCoupon.code }), "error");
    }
  }

  cartTotalEl.textContent = money(total);
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  updateCartUI();
  openCart();
}

function changeQty(id, delta) {
  const next = (cart[id] || 0) + delta;
  if (next <= 0) {
    delete cart[id];
  } else {
    cart[id] = next;
  }
  saveCart();
  updateCartUI();
}

function removeFromCart(id) {
  delete cart[id];
  saveCart();
  updateCartUI();
}

// Recomputed from whatever is actually open rather than toggled per panel, so
// closing one overlay while another is still up can't unlock the page early.
function syncScrollLock() {
  const anyOpen = document.querySelector(
    ".cart-drawer.open, .wishlist-drawer.open, .pd-overlay.open, .checkout-overlay.open, .quiz-overlay.open"
  );
  document.body.classList.toggle("no-scroll", Boolean(anyOpen));
  document.documentElement.classList.toggle("no-scroll", Boolean(anyOpen));
}
window.syncScrollLock = syncScrollLock;

// checkout.js and quiz.js toggle their own overlays, so watching the elements
// beats sprinkling syncScrollLock() through three files: every add/remove of
// "open" re-runs the check, whoever made it.
(() => {
  const panels = document.querySelectorAll(
    ".cart-drawer, .wishlist-drawer, .pd-overlay, .checkout-overlay, .quiz-overlay"
  );
  if (!panels.length) return;
  const observer = new MutationObserver(syncScrollLock);
  panels.forEach((el) => observer.observe(el, { attributes: true, attributeFilter: ["class"] }));
})();

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
  syncScrollLock();
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
  syncScrollLock();
}

function setWishlistButtonState(id) {
  const active = wishlist.includes(id);
  document.querySelectorAll(`[data-wishlist="${id}"]`).forEach((btn) => {
    btn.classList.toggle("active", active);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", active ? "currentColor" : "none");
  });
}

function renderWishlistDrawer() {
  if (!wishlistItemsEl) return;
  if (wishlist.length === 0) {
    wishlistItemsEl.innerHTML = `<p class="cart-empty" data-i18n="wishlist.empty">Você ainda não adicionou favoritos.</p>`;
    window.applyTranslations?.(window.getLang?.());
    return;
  }
  wishlistItemsEl.innerHTML = wishlist
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean)
    .map(
      (p) => `
      <div class="cart-item" data-wishlist-view="${p.id}">
        <div class="cart-item-media ${p.image ? "" : p.tone}">${mediaContent(p)}</div>
        <div class="cart-item-info">
          <strong>${p.name}</strong>
          <span>${money(effectivePrice(p))}</span>
        </div>
        <div class="wishlist-item-actions">
          <button class="remove-btn add-to-cart-btn" data-wishlist-add="${p.id}" aria-label="Adicionar ao carrinho">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M1 1h3l2.4 12.2a2 2 0 0 0 2 1.8h9.2a2 2 0 0 0 2-1.6L21.8 5H5.2"/></svg>
          </button>
          <button class="remove-btn" data-wishlist-remove="${p.id}" aria-label="Remover dos favoritos">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </div>`
    )
    .join("");
}

// ---------- Product detail modal (opened from the wishlist) ----------
const productDetailOverlay = document.getElementById("productDetailOverlay");
const pdAddToCartBtn = document.getElementById("pdAddToCart");
let productDetailId = null;

function openProductDetail(p) {
  if (!productDetailOverlay) return;
  productDetailId = p.id;
  const mediaEl = document.getElementById("pdMedia");
  mediaEl.className = `pd-media${p.image ? "" : ` ${p.tone}`}`;
  mediaEl.innerHTML = mediaContent(p);
  document.getElementById("pdCategory").textContent = p.category;
  document.getElementById("pdName").textContent = p.name;
  document.getElementById("pdNotes").textContent = p.notes;
  document.getElementById("pdPrice").innerHTML = priceMarkup(p, "pd-price");
  productDetailOverlay.classList.add("open");
}

function closeProductDetail() {
  productDetailOverlay?.classList.remove("open");
  productDetailId = null;
  syncScrollLock();
}

document.getElementById("productDetailClose")?.addEventListener("click", closeProductDetail);
productDetailOverlay?.addEventListener("click", (e) => { if (e.target === productDetailOverlay) closeProductDetail(); });
pdAddToCartBtn?.addEventListener("click", () => {
  if (productDetailId != null) {
    if (wishlist.includes(productDetailId)) toggleWishlist(productDetailId);
    addToCart(productDetailId);
  }
  closeProductDetail();
});

function updateWishlistUI() {
  if (wishlistCountEl) {
    wishlistCountEl.textContent = wishlist.length;
    wishlistCountEl.style.display = wishlist.length > 0 ? "flex" : "none";
  }
  renderWishlistDrawer();
}

function toggleWishlist(id) {
  const idx = wishlist.indexOf(id);
  if (idx === -1) wishlist.push(id);
  else wishlist.splice(idx, 1);
  saveWishlist();
  setWishlistButtonState(id);
  updateWishlistUI();
}

function openWishlist() {
  wishlistDrawer.classList.add("open");
  wishlistOverlay.classList.add("open");
  syncScrollLock();
}
function closeWishlist() {
  wishlistDrawer.classList.remove("open");
  wishlistOverlay.classList.remove("open");
  syncScrollLock();
}

// ---------- Delegated click handling (grid / featured / carousel / cart / wishlist / filters) ----------
document.body.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) return addToCart(Number(addBtn.dataset.add));

  const wishBtn = e.target.closest("[data-wishlist]");
  if (wishBtn) return toggleWishlist(Number(wishBtn.dataset.wishlist));

  const wishRemove = e.target.closest("[data-wishlist-remove]");
  if (wishRemove) return toggleWishlist(Number(wishRemove.dataset.wishlistRemove));

  const wishAdd = e.target.closest("[data-wishlist-add]");
  if (wishAdd) {
    const id = Number(wishAdd.dataset.wishlistAdd);
    toggleWishlist(id); // it's always present when clicked from the wishlist drawer, so this removes it
    closeWishlist();
    addToCart(id);
    return;
  }

  const wishView = e.target.closest("[data-wishlist-view]");
  if (wishView) {
    const product = PRODUCTS.find((p) => p.id === Number(wishView.dataset.wishlistView));
    if (product) {
      closeWishlist();
      openProductDetail(product);
    }
    return;
  }

  const inc = e.target.closest("[data-inc]");
  if (inc) return changeQty(Number(inc.dataset.inc), 1);

  const dec = e.target.closest("[data-dec]");
  if (dec) return changeQty(Number(dec.dataset.dec), -1);

  const rem = e.target.closest("[data-remove]");
  if (rem) return removeFromCart(Number(rem.dataset.remove));

  const cartView = e.target.closest("[data-cart-view]");
  if (cartView) {
    const product = PRODUCTS.find((p) => p.id === Number(cartView.dataset.cartView));
    if (product) {
      closeCart();
      openProductDetail(product);
    }
    return;
  }

  const filterBtn = e.target.closest(".filter-btn");
  if (filterBtn && filters && filters.contains(filterBtn)) {
    filters.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    filterBtn.classList.add("active");
    activeFilter = filterBtn.dataset.filter;
    renderProducts();
    return;
  }

  const openCard = e.target.closest("[data-open]");
  if (openCard) {
    const product = PRODUCTS.find((p) => p.id === Number(openCard.dataset.open));
    if (product) openProductDetail(product);
  }
});

// ---------- Live search results ----------
// Typing used to do nothing at all except on the catalogue page, where it
// silently filtered the grid further down. Now every page shows matches under
// the field as you type and one tap opens the perfume, so the search never
// dead-ends. The panel is built here rather than in markup so all six pages
// get it without six copies of the same HTML.
let searchResultsEl = null;
function ensureSearchResults() {
  if (searchResultsEl) return searchResultsEl;
  // Anchored to the header, not inside .search-bar — that element clips its
  // overflow to animate its own height, which would cut the panel off.
  if (!siteHeader || !searchBar) return null;
  searchResultsEl = document.createElement("div");
  searchResultsEl.className = "search-results";
  siteHeader.appendChild(searchResultsEl);
  return searchResultsEl;
}

const SEARCH_RESULT_LIMIT = 6;

function renderSearchResults() {
  const box = ensureSearchResults();
  if (!box) return;
  const query = normalizeText(searchInput.value.trim());
  if (!query) {
    box.classList.remove("open");
    box.innerHTML = "";
    return;
  }
  const matches = PRODUCTS.filter((p) => isVisible(p) && productMatchesSearch(p, query));
  box.innerHTML = matches.length
    ? matches
        .slice(0, SEARCH_RESULT_LIMIT)
        .map(
          (p) => `<button type="button" class="search-result" data-search-open="${p.id}">
            <span class="search-result-thumb">${p.image ? `<img src="${p.image}" alt="">` : bottleIcon()}</span>
            <span class="search-result-text">
              <strong>${p.name}</strong>
              ${familyLabel(p) ? `<small>${familyLabel(p)}</small>` : ""}
            </span>
            <span class="search-result-price">${money(effectivePrice(p))}</span>
          </button>`
        )
        .join("") +
      (matches.length > SEARCH_RESULT_LIMIT
        ? `<a class="search-result-more" href="colecao.html?q=${encodeURIComponent(searchInput.value.trim())}">
             <span data-i18n="search.seeall">Ver todos os resultados</span> (${matches.length})
           </a>`
        : "")
    : `<p class="search-empty" data-i18n="product.notfound">Nenhum perfume encontrado.</p>`;
  box.classList.add("open");
  window.applyTranslations?.(window.getLang?.());
}

function closeSearchResults() {
  searchResultsEl?.classList.remove("open");
}

searchInput?.addEventListener("input", () => {
  renderSearchResults();
  // The catalogue page also filters its grid live, as it always did.
  if (grid) renderProducts();
});

// One tap on a result opens that perfume straight away.
document.addEventListener("click", (e) => {
  const hit = e.target.closest("[data-search-open]");
  if (!hit) return;
  const product = PRODUCTS.find((p) => String(p.id) === hit.dataset.searchOpen);
  if (!product) return;
  closeSearchResults();
  searchBar?.classList.remove("open");
  openProductDetail(product);
});

// Clicking anywhere else dismisses the panel.
document.addEventListener("click", (e) => {
  if (!searchBar?.contains(e.target)) closeSearchResults();
});

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeSearchResults();
  if (e.key !== "Enter") return;
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  // Enter on a single match goes straight into that perfume — the shortest
  // path from typing a name to seeing the bottle.
  const matches = PRODUCTS.filter((p) => isVisible(p) && productMatchesSearch(p, normalizeText(query)));
  if (matches.length === 1) {
    closeSearchResults();
    searchBar?.classList.remove("open");
    openProductDetail(matches[0]);
    return;
  }
  if (grid) {
    closeSearchResults();
    return renderProducts();
  }
  const url = `colecao.html?q=${encodeURIComponent(query)}`;
  document.body.classList.remove("page-loaded");
  setTimeout(() => { window.location.href = url; }, 170);
});

cartBtn?.addEventListener("click", openCart);
cartClose?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", closeCart);

wishlistBtn?.addEventListener("click", openWishlist);
wishlistClose?.addEventListener("click", closeWishlist);
wishlistOverlay?.addEventListener("click", closeWishlist);

// Populated on load when the shopper is signed in (see initCustomerSession below).
let currentCustomer = null;

async function initCustomerSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const { data } = await supabaseClient.from("customers").select("*").eq("id", session.user.id).maybeSingle();
  currentCustomer = data;
}
initCustomerSession();

// Called from js/checkout.js once the receipt has been uploaded to Storage;
// receiptPath is the object's path within the private "receipts" bucket.
async function logOrder(name, phone, receiptPath, paymentMethod, address, city) {
  const ids = Object.keys(cart);
  let subtotal = 0;
  const items = ids.map((id) => {
    const p = PRODUCTS.find((x) => x.id === Number(id));
    const qty = cart[id];
    const unitPrice = effectivePrice(p);
    subtotal += unitPrice * qty;
    // The image is snapshotted onto the order line so "os meus pedidos" can
    // still show the bottle after the product is edited or delisted.
    return { id: p.id, name: p.name, price: unitPrice, qty, image: p.image || null };
  });
  const discount = couponDiscountAmount(subtotal);
  const total = Math.max(0, subtotal - discount);
  const usedCoupon = discount > 0 ? appliedCoupon.code : null;

  const { data: order, error } = await supabaseClient
    .from("orders")
    .insert({
      items,
      total,
      status: "pending",
      payment_status: "pending",
      payment_method: paymentMethod || null,
      customer_id: currentCustomer?.id || null,
      customer_name: name,
      customer_phone: phone,
      customer_address: address || null,
      customer_city: city || null,
      customer_email: currentCustomer?.email || null,
      discount,
      coupon_code: usedCoupon,
      receipt_url: receiptPath,
    })
    .select()
    .single();
  if (error) throw error;

  if (usedCoupon) {
    await supabaseClient.rpc("redeem_coupon", { p_code: usedCoupon });
    removeCoupon();
  }
  return order;
}

menuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  mainNav.classList.toggle("open");
});
// Closing on an outside click (rather than requiring the hamburger to be
// clicked again) and on picking a link, so the dropdown never gets stuck open.
document.addEventListener("click", (e) => {
  if (mainNav.classList.contains("open") && !e.target.closest(".main-nav") && !e.target.closest(".menu-btn")) {
    mainNav.classList.remove("open");
  }
});
mainNav?.addEventListener("click", (e) => {
  if (e.target.closest("a")) mainNav.classList.remove("open");
});
document.querySelector("[data-nav-search]")?.addEventListener("click", () => {
  mainNav.classList.remove("open");
  searchBar.classList.add("open");
  searchInput.focus();
});

// Mobile overflow ("...") menu: holds search + account so the header row
// only shows wishlist/cart directly, per the phone-declutter pass.
const moreBtn = document.getElementById("moreBtn");
const moreMenuPanel = document.getElementById("moreMenuPanel");
moreBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  moreMenuPanel?.classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (moreMenuPanel?.classList.contains("open") && !e.target.closest(".more-menu")) {
    moreMenuPanel.classList.remove("open");
  }
});

searchBtn?.addEventListener("click", () => {
  moreMenuPanel?.classList.remove("open");
  searchBar.classList.toggle("open");
  if (searchBar.classList.contains("open")) searchInput.focus();
});
searchClose?.addEventListener("click", () => {
  searchBar.classList.remove("open");
  searchInput.value = "";
  renderProducts();
});

carouselPrev?.addEventListener("click", () => carousel.scrollBy({ left: -300, behavior: "smooth" }));
carouselNext?.addEventListener("click", () => carousel.scrollBy({ left: 300, behavior: "smooth" }));

newsletterForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = newsletterEmail.value.trim();
  if (!email) return;
  const submitBtn = newsletterForm.querySelector("button[type=submit]");
  submitBtn?.setAttribute("disabled", "true");
  try {
    const { error } = await supabaseClient.from("subscriptions").insert({ email });
    if (error && error.code !== "23505") throw error; // 23505 = already subscribed, treat as success
    newsletterNote.textContent = window.t?.("msg.newsletter.success") || "Obrigado! Foi inscrito com sucesso.";
    newsletterForm.reset();
  } catch (err) {
    console.error("Falha ao registar inscrição no Supabase:", err);
    newsletterNote.textContent = window.t?.("msg.newsletter.error") || "Não foi possível concluir a sua inscrição. Tente novamente.";
  } finally {
    submitBtn?.removeAttribute("disabled");
  }
});

// ---------- Header scroll state + hero parallax ----------
function handleScroll() {
  const y = window.scrollY;
  if (siteHeader) {
    // Pages without a hero (e.g. sobre.html) have no transparent state to fall back to.
    if (heroMedia) siteHeader.classList.toggle("scrolled", y > 40);
    else siteHeader.classList.add("scrolled");
  }
  if (heroMedia) heroMedia.style.transform = `translateY(${Math.min(y * 0.25, 160)}px)`;
}
window.addEventListener("scroll", handleScroll, { passive: true });
handleScroll();

// ---------- Fade-in on scroll ----------
const revealEls = document.querySelectorAll(".reveal");
if (revealEls.length) {
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }
}

// ---------- Idle autoplay for the reviews strip (mobile) ----------
// Advances one card at a time while the shopper isn't touching it; any
// manual scroll/touch pauses it for a while so it doesn't fight the user.
// (initIdleCarousel removed.) It was a second, independent auto-scroller
// running on the very same reviews strip every 3.5s using the browser's own
// scrollTo({behavior:"smooth"}), while the marquee/step animation above ran on
// its own schedule. Two animations driving one element at different intervals
// and different speeds is what made the motion look uneven no matter how the
// other one was tuned. The marquee is now the only thing that moves it.

const searchQueryParam = new URLSearchParams(window.location.search).get("q");
if (searchQueryParam && searchInput) {
  searchInput.value = searchQueryParam;
  searchBar?.classList.add("open");
}

document.addEventListener("products:ready", () => {
  renderProducts();
  renderFeatured();
  renderCarousel();
  updateCartUI();
  updateWishlistUI();
});

// ---------- Fade page in on load, fade out before navigating to another page ----------
requestAnimationFrame(() => document.body.classList.add("page-loaded"));

document.body.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || /^https?:\/\//.test(href)) return;

  // A link to the page we're already on, differing only by #fragment (the
  // footer's politicas.html#envio while already on politicas.html), performs
  // no navigation — the browser just scrolls. Fading out for that would leave
  // the body at opacity:0 with no reload to ever fade it back in, i.e. a
  // blank page. Let the browser handle those natively.
  const target = new URL(href, window.location.href);
  if (target.pathname === window.location.pathname && target.hash) return;

  e.preventDefault();
  document.body.classList.remove("page-loaded");
  setTimeout(() => { window.location.href = href; }, 170);
});

// Safety net for any other route to a stuck fade-out: a hash change means the
// document survived, so the page must be visible.
window.addEventListener("hashchange", () => document.body.classList.add("page-loaded"));

// Using the browser's Back button restores the page exactly as the tab left
// it (from bfcache) rather than reloading it — including the opacity:0 state
// set right above just before navigating away. Without this, going back
// lands on a page that's technically there but invisible: a blank screen.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) document.body.classList.add("page-loaded");
});

// Belt and braces for the same iOS Safari bug the .scrolled rule above avoids:
// after a rubber-band/pull-to-refresh gesture the fixed header can occasionally
// be left painted mid-screen until something forces the compositor to
// re-evaluate it. A sub-pixel nudge once the gesture settles does that, and is
// invisible if the header was never displaced in the first place.
let headerRepaintTimer;
function nudgeHeaderRepaint() {
  if (!siteHeader) return;
  siteHeader.style.top = "-0.5px";
  requestAnimationFrame(() => { siteHeader.style.top = ""; });
}
["touchend", "touchcancel"].forEach((evt) => {
  window.addEventListener(evt, () => {
    clearTimeout(headerRepaintTimer);
    headerRepaintTimer = setTimeout(nudgeHeaderRepaint, 80);
  }, { passive: true });
});
