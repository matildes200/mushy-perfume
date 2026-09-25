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
const money = (v) => `${Math.round(Number(v) || 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 })} Kz`;

// ---------- The bottle, and the amostra ----------
// Each perfume has one bottle, whose size the shop sets per product, and may
// also be sold as a small amostra with its own price and its own stock. Those
// are the only two things a customer ever chooses between, so they are built
// here as a plain list rather than a variant table.

// Overridden from site settings once they load; 5 ml is what the shop sells.
// var, not let: a top-level `let` is not a property of window, so the value
// products.js fetches would land somewhere this file never reads. Seeded from
// whatever products.js may already have set, so the two cannot race.
var AMOSTRA_ML = window.AMOSTRA_ML || 5;

function productOptions(p) {
  const options = [
    {
      kind: "full",
      // A bottle whose size has never been set says so, rather than showing
      // a dash the customer has to interpret.
      label: p.volume_ml ? `Frasco completo · ${p.volume_ml} ml` : "Frasco completo",
      short: p.volume_ml ? `${p.volume_ml} ml` : "Frasco completo",
      price: Number(p.price) || 0,
      stock: Number(p.stock ?? 0),
    },
  ];
  // An amostra with no price would be given away, so it is not offered.
  if (p.amostra_enabled && p.amostra_price !== null && p.amostra_price !== undefined) {
    options.push({
      kind: "amostra",
      label: `Amostra · ${AMOSTRA_ML} ml`,
      short: `Amostra ${AMOSTRA_ML} ml`,
      price: Number(p.amostra_price) || 0,
      stock: Number(p.amostra_stock ?? 0),
    });
  }
  return options;
}

const hasAmostra = (p) => productOptions(p).length > 1;
const optionInStock = (o) => Number(o?.stock ?? 0) > 0;
const findOption = (p, kind) => productOptions(p).find((o) => o.kind === kind) || null;

// The bottle is the product; it is what a card shows unless it has sold out and
// the amostra has not, in which case showing the bottle's price would quote a
// figure nobody can pay.
function defaultOption(p) {
  const options = productOptions(p);
  const full = options[0];
  if (optionInStock(full)) return full;
  return options.find(optionInStock) || full;
}

// ---------- Which discount applies ----------
// A campaign OVERRIDES the product's own discount rather than stacking on it.
// Stacking would mean a 20% campaign quietly becoming 28% on whatever already
// carried a manual 10%, which is exactly the kind of thing nobody notices until
// the margin has gone. One rule, so the banner can never disagree with the
// shelf: while a campaign runs, the campaign is the price.
//
// Returns null when nothing is off.
function activeDiscount(p, option) {
  const c = p.campaign;
  const isAmostra = option?.kind === "amostra";
  // A campaign leaves amostras alone unless it was told not to: an amostra is
  // already priced to win a full-bottle sale later.
  if (c && (!isAmostra || c.applies_to_amostras)) {
    return {
      source: "campaign",
      type: c.discount_type,
      value: Number(c.discount_value) || 0,
      campaign: c,
    };
  }
  if (p.discount_percent) {
    return { source: "product", type: "percentage", value: Number(p.discount_percent) || 0 };
  }
  return null;
}

function applyDiscount(base, discount) {
  if (!discount || !discount.value) return base;
  return discount.type === "percentage"
    ? Math.round(base * (1 - discount.value / 100))
    : Math.max(0, base - discount.value);
}

// How the saving is written on the badge. A percentage campaign says "-20%"; a
// fixed one says what it takes off, because "-13%" on one perfume and "-19%" on
// the next would be the same campaign described two ways.
function discountBadgeLabel(discount) {
  if (!discount) return "";
  return discount.type === "percentage"
    ? `-${Math.round(discount.value)}%`
    : `-${money(discount.value)}`;
}

const effectivePrice = (p, option) => {
  const opt = option === undefined ? defaultOption(p) : option;
  const base = opt ? opt.price : Number(p.price) || 0;
  return applyDiscount(base, activeDiscount(p, opt));
};

// Sold out only when there is nothing left to buy at all: a perfume with no
// bottles but some amostras is still for sale.
const isOutOfStock = (p) => !productOptions(p).some(optionInStock);

// The discount sits on its own line *under* the price rather than beside it,
// so the current price is always the first line of the block and every card in
// a row lines its name and price up at the same height, discounted or not.
function priceMarkup(p, className, option) {
  const v = option === undefined ? defaultOption(p) : option;
  const base = v ? v.price : Number(p.price) || 0;
  const discount = activeDiscount(p, v);
  const final = applyDiscount(base, discount);
  // A discount that saves nothing is not a discount: a fixed amount of zero, or
  // a campaign that happens to land on the same number, shouldn't strike the
  // price through for no reason.
  if (!discount || final >= base) {
    return `<span class="${className}"><span class="price-final">${money(base)}</span></span>`;
  }
  return `<span class="${className} price-discounted">
    <span class="price-final">${money(final)}</span>
    <span class="price-was">
      <span class="price-original">${money(base)}</span>
      <span class="price-badge">${discountBadgeLabel(discount)}</span>
    </span>
  </span>`;
}

// "Promoção até 30 de Setembro", shown where there is room to read it. Only for
// a campaign: a manual discount has no end date to promise.
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function campaignEndNote(p) {
  const c = p.campaign;
  if (!c?.end_date) return "";
  // Split rather than parsed as a Date: the column is a plain day, and parsing
  // it as an instant can shift it to the day before west of UTC.
  const [y, m, d] = String(c.end_date).split("-").map(Number);
  if (!y || !m || !d) return "";
  // Sentence case and one line: "PROMOÇÃO ATÉ 30 DE SETEMBRO" in capitals wrapped
  // onto two lines on a card and shouted while doing it.
  return `<span class="campaign-until">Até ${d} de ${MONTHS_PT[m - 1]}</span>`;
}

function stockBadge(p) {
  return isOutOfStock(p) ? `<span class="stock-badge" data-i18n="product.soldout">Esgotado</span>` : "";
}

function addButton(p, label, labelKey) {
  if (isOutOfStock(p)) {
    return `<button class="btn btn-small" disabled data-i18n="product.soldout">Esgotado</button>`;
  }
  // data-option is what the click handler adds to the cart. It starts on the
  // default choice and is rewritten by selectCardOption() as choices are made.
  const o = defaultOption(p);
  return `<button class="btn btn-small" data-add="${p.id}" data-option="${o.kind}" data-i18n="${labelKey}">${label}</button>`;
}

// ---------- Size picker on the back of the card ----------
// One row of pills. A size with no stock stays visible but cannot be chosen:
// hiding it would make the range look smaller than it is, and silently
// swapping to another size would sell someone the wrong bottle.
// Frasco completo or amostra, as two rows rather than pills: each one carries a
// price, and a price needs room to be read.
function optionPicker(p, compact) {
  if (!hasAmostra(p)) return "";
  const selected = defaultOption(p);
  const rows = productOptions(p)
    .map((o) => {
      const out = !optionInStock(o);
      const on = o.kind === selected.kind;
      // No tooltip: this is a phone-first shop and a title attribute never
      // appears on touch. Unavailable is carried by the styling and by
      // disabled, which screen readers announce.
      return `<button type="button" class="option-row${on ? " selected" : ""}${out ? " out" : ""}"
        data-option-pick="${o.kind}" data-product="${p.id}"${out ? " disabled" : ""}
        aria-pressed="${on ? "true" : "false"}">
        <span class="option-mark" aria-hidden="true"></span>
        <span class="option-label">${compact ? o.short : o.label}</span>
        <span class="option-price">${out ? "Esgotado" : money(effectivePrice(p, o))}</span>
      </button>`;
    })
    .join("");
  return `<div class="option-picker" role="group" data-option-group="${p.id}">${rows}</div>`;
}

// Shown only while the amostra is the chosen option. People do not buy a thing
// they have to work out the point of.
function amostraNote() {
  return `<div class="amostra-note" data-amostra-note hidden>
    <strong>Experimente antes de decidir</strong>
    <p>A amostra de ${AMOSTRA_ML}ml permite conhecer a fragrância na sua pele, ao longo do dia.
       Se depois quiser o frasco completo, descontamos o valor da amostra na sua compra.</p>
  </div>`;
}

// Repricing in place rather than re-rendering: rebuilding the grid would drop
// the .flipped class and turn every open card back to its front face.
function selectCardOption(btn) {
  const productId = Number(btn.dataset.product);
  const kind = btn.dataset.optionPick;
  const product = PRODUCTS.find((x) => x.id === productId);
  const option = product && findOption(product, kind);
  if (!product || !option || !optionInStock(option)) return;

  const group = btn.closest("[data-option-group]");
  group?.querySelectorAll(".option-row").forEach((el) => {
    const on = el === btn;
    el.classList.toggle("selected", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });

  // The explanation belongs to the amostra, so it comes and goes with it.
  const scope = btn.closest(".flip-back") || btn.closest(".pd-info") || document;
  const note = scope.querySelector("[data-amostra-note]");
  if (note) note.hidden = kind !== "amostra";

  // The same picker is used on the back of a card and inside the detail modal,
  // which has no .flip-card around it — hence the two branches.
  const card = btn.closest(".flip-card");
  if (card) {
    const priceEl = card.querySelector(".flip-back-price");
    if (priceEl) priceEl.outerHTML = priceMarkup(product, "flip-back-price", option);
    const addBtn = card.querySelector("[data-add]");
    if (addBtn) addBtn.dataset.option = kind;
    return;
  }

  if (btn.closest("#pdSizes")) {
    productDetailOption = kind;
    const pdPrice = document.getElementById("pdPrice");
    if (pdPrice) pdPrice.innerHTML = priceMarkup(product, "pd-price", option);
  }
}

// Resolved to an absolute URL: a relative url() stored in a CSS custom property
// resolves against the stylesheet that reads it via var(), not against this page,
// so a plain relative path breaks once it's consumed from css/style.css.
const cardImageUrl = (path) => new URL(path, document.baseURI).href;

// Photos this page has already decoded. Used to skip the loading skeleton when
// the grid is rebuilt — see perfumeCardTemplate().
const loadedCardImages = new Set();

// Search terms that should match a category even though they never appear in the data
// (e.g. "perfume de mulher" should surface the feminino products).
const CATEGORY_SEARCH_TERMS = {
  feminino: ["feminino", "femininos", "feminina", "femininas", "mulher", "mulheres", "ela", "her", "woman", "women", "female", "ladies", "girl"],
  masculino: ["masculino", "masculinos", "masculina", "masculinas", "homem", "homens", "ele", "him", "man", "men", "male", "mens", "guy"],
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

// Every plausible stem of a typed word, rather than one guess. The rules above
// are Portuguese, and applying them blind to English mangles it: "collections"
// ends in "ns", so the homens->homem rule turned it into "collectiom" and it
// matched nothing. Offering both the Portuguese stem and a plain -s/-es strip
// means the search doesn't have to know which language was typed.
function queryStems(word) {
  const stems = [word];
  const add = (s) => { if (s && s.length >= 2 && !stems.includes(s)) stems.push(s); };
  add(singularize(word));
  if (word.length > 3) {
    if (word.endsWith("es")) add(word.slice(0, -2));
    if (word.endsWith("s")) add(word.slice(0, -1));
  }
  return stems;
}

// Words that describe the shop rather than any one bottle. Typing one of these
// returns the whole catalogue instead of nothing — "perfumes" should never be
// a dead end on a perfume shop. Stored singularised; matched as a prefix so
// "perfum", "fragranc" and "colec" all count.
const GENERIC_SITE_TERMS = [
  // Portuguese
  "perfume", "perfumaria", "parfum", "fragrancia", "aroma", "essencia",
  "cheiro", "colecao", "coleccao", "catalogo", "produto", "artigo", "frasco",
  "tudo", "todo",
  // English — the site has an EN mode, so it has to answer to EN words too
  "fragrance", "scent", "collection", "product", "item", "bottle",
  "perfumery", "everything", "all",
];
// Below this length a query is treated as the start of a name, not as a
// general term — otherwise a single "p" would return the entire shop.
const GENERIC_MIN_LENGTH = 3;

// Connectives carry no search intent, so they are skipped rather than failed.
// Every word in a query has to match something, which meant "perfume para
// mulher" or "fragrance for her" died on the middle word.
const SEARCH_STOP_WORDS = new Set([
  "de", "do", "da", "dos", "das", "para", "por", "com", "em", "e",
  "o", "a", "os", "as", "um", "uma", "no", "na",
  "for", "the", "of", "and", "with", "to", "in", "my", "me",
]);

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
    p._tokens = [];
    p._haystack.split(" ").filter(Boolean).forEach((w) => {
      p._tokens.push(w);
      const stem = singularize(w);
      if (stem !== w) p._tokens.push(stem);
    });
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
      if (SEARCH_STOP_WORDS.has(raw)) return true;
      if (p._haystack.includes(raw) || p._haystackCompact.includes(raw)) return true;
      return queryStems(raw).some(
        (stem) =>
          matchesGenericTerm(stem) ||
          p._tokens.some((token) => token.startsWith(stem)) ||
          matchesCategoryTerm(p, stem)
      );
    });
}

let cart = JSON.parse(localStorage.getItem("mushy-cart") || "{}");
let wishlist = JSON.parse(localStorage.getItem("mushy-wishlist") || "[]");
let activeFilter = "todos";

// ---------- Cart keys ----------
// The same perfume in two sizes is two lines, so the cart is keyed by
// "<productId>:<kind>" rather than by product alone, where kind is "full" or
// "amostra". The same perfume in both is two lines.
const cartKey = (productId, kind) => `${productId}:${kind}`;

// The second half is a kind — "full" or "amostra" — not a number. Coercing it
// with Number() gave NaN, every line failed to resolve, and the cart silently
// totalled zero while still showing the right items.
function parseCartKey(key) {
  const [pid, kind] = String(key).split(":");
  return { productId: Number(pid), kind: kind === undefined ? null : kind };
}

// Resolves a key back to what it refers to. Returns null for a line whose
// product or option no longer exists, so a stale cart is dropped rather than
// throwing or silently pricing at zero.
function cartLine(key) {
  const { productId, kind } = parseCartKey(key);
  const product = PRODUCTS.find((x) => x.id === productId);
  if (!product) return null;
  const variant = kind === null ? defaultOption(product) : findOption(product, kind);
  // An amostra that has since been withdrawn invalidates the line.
  if (kind !== null && !variant) return null;
  return { key, product, variant, qty: cart[key], unitPrice: effectivePrice(product, variant) };
}

const cartLines = () => Object.keys(cart).map(cartLine).filter(Boolean);

const inCart = (productId) =>
  Object.keys(cart).some((k) => parseCartKey(k).productId === productId);

// Carts saved before sizes existed are keyed by product id alone. Rewriting
// them on load means an old tab's cart keeps its contents instead of emptying.
function migrateLegacyCart() {
  let changed = false;
  Object.keys(cart).forEach((key) => {
    if (String(key).includes(":")) return;
    const product = PRODUCTS.find((x) => x.id === Number(key));
    const qty = cart[key];
    delete cart[key];
    changed = true;
    if (!product) return;
    const next = cartKey(product.id, "full");
    cart[next] = (cart[next] || 0) + qty;
  });
  if (changed) saveCart();
}

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
  const notesText = !pyramid && (p.notes || p.short_description || p.description);
  const notes = pyramid || (notesText ? `<p class="flip-back-notes-text">${notesText}</p>` : "");

  // Stacked top-down with fixed gaps. Nothing is distributed, nothing is
  // centred in a band of its own: the only space that moves is the one above
  // the button, which is pushed to the bottom.
  //
  // The brand line is always rendered, empty or not, so the name sits at the
  // same height on a card with a brand and a card without one. Eleven of the
  // twelve products have no brand, so without this the backs of two
  // neighbouring cards never lined up.
  return `
    <div class="flip-back-head">
      <span class="flip-back-brand">${p.brand || ""}</span>
      <h3 class="flip-back-name">${p.name}</h3>
    </div>

    ${notes ? `<div class="flip-back-notes">
      <span class="flip-back-notes-label" data-i18n="card.notes">Notas</span>
      ${notes}
    </div>` : ""}

    <div class="flip-back-buy">
      ${optionPicker(p, true)}
      ${hasAmostra(p) ? amostraNote() : ""}
      ${hasAmostra(p) || !sizeLine(p) ? "" : `<span class="flip-back-size">${sizeLine(p)}</span>`}
      ${priceMarkup(p, "flip-back-price")}
      ${campaignEndNote(p)}
    </div>`;
}

// Shared by .product-card / .carousel-card / .featured-card. The card flips:
// the front is the bottle with its name and price underneath, and tapping it
// turns the card over to the notes and the add-to-cart button. Nothing on the
// front is buyable — you have to flip first, which is the whole point.
function perfumeCardTemplate(p, wrapClass, addLabel, addLabelKey) {
  const toneClass = p.image ? "" : ` ${p.tone}`;
  const style = p.image ? ` style="--card-image:url('${cardImageUrl(p.image)}')"` : "";
  // data-img drives the skeleton: the shimmer stays until this URL has loaded.
  const imageUrl = p.image ? cardImageUrl(p.image) : "";
  const imgAttr = imageUrl ? ` data-img="${imageUrl}"` : "";
  // The skeleton is only for a photo this page has never shown. Filtering and
  // searching rebuild the whole grid on every keystroke, and re-applying
  // is-loading each time dropped every image to opacity:0 behind a pale
  // shimmer and back — which is the white flashing while you type. A photo
  // already decoded is in cache and can paint immediately.
  const needsSkeleton = imageUrl && !loadedCardImages.has(imageUrl);
  return `
    <article class="${wrapClass} flip-card">
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <div class="perfume-card-media-wrap${needsSkeleton ? " is-loading" : ""}"${imgAttr}>
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
    const done = () => {
      loadedCardImages.add(wrap.dataset.img);
      wrap.classList.remove("is-loading");
    };
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

// Either every card shows the concentration or none does. With it filled in on
// one product out of twelve, showing it produced exactly the raggedness this
// was meant to avoid: one card reading "100 ML · EAU DE PARFUM" beside eleven
// reading "100 ML". Fills itself in as the field gets populated.
const showConcentration = () =>
  Array.isArray(PRODUCTS) &&
  PRODUCTS.length > 0 &&
  PRODUCTS.every((p) => p.active !== false && p.archived !== true ? Boolean(p.concentration) : true);

// "100 ML", or "100 ML · EAU DE PARFUM" when every product can say it.
function sizeLine(p) {
  const vol = p.volume_ml ? `${p.volume_ml} ml` : "";
  if (!vol) return "";
  return showConcentration() && p.concentration ? `${vol} · ${p.concentration}` : vol;
}

// Hidden by an admin (active === false) but tolerant of the column not
// existing yet, so the storefront still works before the migration runs.
const isVisible = (p) => p.active !== false;

function renderProducts() {
  if (!grid) return;
  const query = searchInput ? normalizeText(searchInput.value.trim()) : "";
  const items = PRODUCTS.filter((p) => {
    const matchesCategory = activeFilter === "todos" || p.category === activeFilter;
    const matchesCampaign = !campaignParam || p.campaign?.campaign_id === campaignParam;
    return isVisible(p) && matchesCategory && matchesCampaign && productMatchesSearch(p, query);
  }).sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);

  renderCampaignHeading(items.length);
  grid.innerHTML = items.length
    ? items.map(productCardTemplate).join("")
    : `<p class="cart-empty" data-i18n="product.notfound">Nenhum perfume encontrado.</p>`;
  hydrateCardImages(grid);
  // Re-render happens on every filter/search change, so the freshly built
  // cards need another translation pass to pick the current language back up.
  window.applyTranslations?.(window.getLang?.());
}

// Arriving from the banner shows a subset of the collection, so the page has to
// say so — and offer a way back to everything, or it looks like the shop has
// shrunk.
function renderCampaignHeading(count) {
  const host = document.getElementById("campaignHeading");
  if (!host) return;
  if (!campaignParam) { host.hidden = true; host.innerHTML = ""; return; }

  const sample = PRODUCTS.find((p) => p.campaign?.campaign_id === campaignParam);
  const c = sample?.campaign;
  if (!c) {
    // The campaign has ended, or never covered anything.
    host.innerHTML = `<p class="campaign-banner-note">Esta promoção já terminou.
      <a href="colecao.html">Ver toda a colecção</a></p>`;
    host.hidden = false;
    return;
  }
  const off = c.discount_type === "percentage"
    ? `${Math.round(Number(c.discount_value))}%`
    : money(Number(c.discount_value));
  host.innerHTML = `<div class="campaign-banner-note">
    <strong>${escapeText(c.campaign_name)}</strong>
    <span>${off} de desconto &middot; ${count} perfume${count === 1 ? "" : "s"}</span>
    <a href="colecao.html">Ver toda a colecção</a>
  </div>`;
  host.hidden = false;
}

// Campaign names are admin-entered and land inside innerHTML here.
const escapeText = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );

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
// One continuous marquee that you can also drag.
//
// The drift is unchanged: constant linear speed, every card moving the same
// pixels at the same instant, looping seamlessly because the card set is
// duplicated once and the position wraps by exactly one copy's width. What is
// new is that the position lives in JS rather than in a CSS animation, so a
// finger and the clock write to the same number. As a CSS animation there was
// nothing to drag — touching it only paused a transform.
//
// Linear on purpose: an ease curve on a never-ending loop visibly speeds up
// and slows down each cycle, which is the acceleration this was built to
// remove in the first place.
(() => {
  const track = document.getElementById("reviewsTrack");
  const viewport = document.getElementById("reviewsGrid");
  if (!track || !viewport) return;

  // The clones are what make the wrap invisible: at exactly one copy's width
  // the second set sits where the first began. Decorative repeats, so they are
  // hidden from assistive tech.
  Array.from(track.children).forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.dataset.clone = "true";
    track.appendChild(clone);
  });

  const CYCLE_MS = 44000;   // time for one full copy to pass, as before
  const RESUME_MS = 2500;   // quiet time after a drag before drifting again
  const DRAG_THRESHOLD = 6; // px of horizontal travel before we claim the gesture
  const SETTLE_MS = 420;    // glide onto the nearest card after letting go
  // Past this much travel the gesture counts as "next one please" rather than
  // a nudge, so a short flick still advances a whole card.
  const FLICK_RATIO = 0.15;

  let offset = 0;       // current translate, in px (negative moves left)
  let copyWidth = 0;    // width of one copy of the set
  let lastFrame = null;
  let resumeAt = 0;
  let dragging = false;
  let claimed = false;  // committed to a horizontal drag
  let settling = false; // gliding onto a card boundary
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let lastDx = 0;
  let wheelTimer = null;

  // The marquee only exists in the mobile layout. On wider screens the reviews
  // are a static two-column grid with the clones hidden, so the track must not
  // be transformed at all — driving it there would slide the grid off-screen.
  const marqueeMedia = window.matchMedia("(max-width: 640px)");
  const isMarquee = () => marqueeMedia.matches;

  const measure = () => { copyWidth = track.scrollWidth / 2; };
  measure();
  window.addEventListener("resize", measure);
  marqueeMedia.addEventListener?.("change", measure);
  // Card widths are in vw and the fonts load late, so re-measure once things
  // have settled rather than trusting the first layout.
  window.addEventListener("load", measure);

  // Wrapping by exactly one copy in either direction keeps the strip endless
  // whichever way it is pushed.
  function normalise() {
    if (!copyWidth) return;
    while (offset <= -copyWidth) offset += copyWidth;
    while (offset > 0) offset -= copyWidth;
  }

  function paint() {
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
  }

  // One card plus its margin. The cards are laid out with margin-right rather
  // than a flex gap precisely so every card occupies the same step.
  function cardStep() {
    const card = track.querySelector(".review-card");
    if (!card) return 0;
    return card.getBoundingClientRect().width + parseFloat(getComputedStyle(card).marginRight || 0);
  }

  // Glides to a card boundary after a drag, so letting go lands on a review
  // instead of halfway between two. Deliberately not normalised mid-flight:
  // wrapping the offset during the animation would jump the strip a full copy
  // in the middle of the glide. It is wrapped once at the end instead.
  function settleTo(target) {
    const start = offset;
    const distance = target - start;
    resumeAt = performance.now() + SETTLE_MS + RESUME_MS;
    if (Math.abs(distance) < 0.5) {
      offset = target;
      normalise();
      paint();
      return;
    }
    settling = true;
    const t0 = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      // A new drag takes over immediately rather than fighting the glide.
      if (dragging) { settling = false; return; }
      const p = Math.min((now - t0) / SETTLE_MS, 1);
      offset = start + distance * easeOutCubic(p);
      paint();
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        settling = false;
        normalise();
        paint();
        resumeAt = performance.now() + RESUME_MS;
      }
    };
    requestAnimationFrame(step);
  }

  // Nearest boundary for a nudge; the next one along for a deliberate swipe.
  function settleToNearestCard(direction) {
    const step = cardStep();
    if (!step) {
      resumeAt = performance.now() + RESUME_MS;
      return;
    }
    const raw = offset / step;
    const index =
      Math.abs(direction) > step * FLICK_RATIO
        ? direction < 0
          ? Math.floor(raw)   // pushed left: the card after this one
          : Math.ceil(raw)    // pushed right: the card before it
        : Math.round(raw);
    settleTo(index * step);
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  function frame(now) {
    if (lastFrame === null) lastFrame = now;
    const dt = now - lastFrame;
    lastFrame = now;

    if (!isMarquee()) {
      // Leave the desktop grid exactly where CSS put it.
      if (offset !== 0) {
        offset = 0;
        track.style.transform = "";
      }
      requestAnimationFrame(frame);
      return;
    }

    const drifting = !dragging && !settling && now >= resumeAt && !reduceMotion?.matches;
    if (drifting && copyWidth) {
      offset -= (copyWidth / CYCLE_MS) * dt;
      normalise();
      paint();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- dragging ---
  // pointerdown only records where the finger landed. The gesture is not
  // claimed until it has travelled further horizontally than vertically, so a
  // vertical swipe still scrolls the page instead of being swallowed here.
  viewport.addEventListener("pointerdown", (e) => {
    if (!isMarquee()) return;
    dragging = true;
    claimed = false;
    startX = e.clientX;
    startY = e.clientY;
    startOffset = offset;
  });

  viewport.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!claimed) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical: let the page have it.
          dragging = false;
          return;
        }
        claimed = true;
        viewport.setPointerCapture?.(e.pointerId);
        viewport.classList.add("is-dragging");
      }

      lastDx = dx;
      offset = startOffset + dx;
      normalise();
      paint();
      e.preventDefault();
    },
    { passive: false }
  );

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    const wasClaimed = claimed;
    if (claimed) {
      viewport.releasePointerCapture?.(e.pointerId);
      viewport.classList.remove("is-dragging");
    }
    claimed = false;

    if (wasClaimed) {
      // Land on a review rather than stopping halfway between two.
      settleToNearestCard(lastDx);
    } else {
      resumeAt = performance.now() + RESUME_MS;
    }
    lastDx = 0;
  }
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", endDrag);

  // A card is a link-free block, but the browser still tries to drag images.
  viewport.addEventListener("dragstart", (e) => e.preventDefault());

  // Trackpad and wheel nudges move it too, and pause the drift the same way.
  viewport.addEventListener(
    "wheel",
    (e) => {
      if (!isMarquee()) return;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!dx) return;
      settling = false;
      offset -= dx;
      normalise();
      paint();
      resumeAt = performance.now() + RESUME_MS;
      // A wheel gesture arrives as a burst of events, so the settle waits for
      // the burst to stop rather than firing on every tick.
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => settleToNearestCard(-dx), 120);
      e.preventDefault();
    },
    { passive: false }
  );
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
  return cartLines().reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
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
    // A campaign can refuse to be combined with a cupão. The amostra credit is
    // the exception: it is money the customer already handed over, not a second
    // discount being granted, and it is recognisable by being tied to a product.
    const blocking = cartLines().find(
      (l) => activeDiscount(l.product, l.variant)?.campaign?.allow_coupons === false
    );

    // An amostra credit is only good against the full bottle of the same
    // perfume, so the server is told which full bottles are actually in the
    // cart. Sent every time: a normal coupon ignores it.
    const fullBottleIds = [
      ...new Set(cartLines().filter((l) => l.variant?.kind !== "amostra").map((l) => l.product.id)),
    ];
    const { data, error } = await supabaseClient.rpc("validate_coupon", {
      p_code: code,
      p_order_total: subtotal,
      p_full_bottle_product_ids: fullBottleIds,
    });
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
    // Checked after validation rather than before it, so a code that is expired
    // or mistyped is reported as such instead of being blamed on the campaign.
    // An amostra credit passes: validate_coupon only accepts it when the right
    // bottle is in the cart, so a valid product-scoped code is that credit.
    if (blocking && !result.product_scoped) {
      showCouponMessage(
        window.t?.("coupon.campaign_blocks", { campaign: blocking.product.campaign.campaign_name }),
        "error"
      );
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
  // Keeps the "entrega a partir de" line and the free-delivery progress honest.
  window.updateCartDeliveryHint?.();
  // Lines whose product or size no longer exists are dropped rather than
  // rendered as a blank row at zero.
  const lines = cartLines();
  const ids = Object.keys(cart);
  const totalCount = lines.reduce((sum, line) => sum + line.qty, 0);
  cartCountEl.textContent = totalCount;
  cartCountEl.style.display = totalCount > 0 ? "flex" : "none";

  if (lines.length === 0) {
    cartItemsEl.innerHTML = `<p class="cart-empty" data-i18n="cart.empty">O seu carrinho está vazio.</p>`;
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
  cartItemsEl.innerHTML = lines
    .map(({ key, product: p, variant, qty, unitPrice }) => {
      subtotal += unitPrice * qty;
      // The size goes next to the name, or the same perfume twice reads as a
      // duplicate line rather than two different bottles.
      const sizeTag = variant
        ? `<span class="cart-item-size">${variant.short}</span>`
        : "";
      return `
      <div class="cart-item" data-cart-view="${p.id}">
        <div class="cart-item-media ${p.image ? "" : p.tone}">${mediaContent(p)}</div>
        <div class="cart-item-info">
          <strong>${p.name}${sizeTag}</strong>
          <span>${money(unitPrice)}</span>
          <div class="qty-control">
            <button data-dec="${key}" aria-label="Diminuir quantidade">−</button>
            <span>${qty}</span>
            <button data-inc="${key}" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
        <button class="remove-btn" data-remove="${key}" aria-label="Remover item">
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

// kind is optional: without it the product's default choice is used, which is
// what the favourites drawer relies on.
function addToCart(productId, kind) {
  const product = PRODUCTS.find((x) => x.id === Number(productId));
  if (!product) return;
  const variant = kind === undefined || kind === null
    ? defaultOption(product)
    : findOption(product, kind);

  // Refuse an option with no stock here as well as in the markup: the button is
  // disabled, but the handler is what actually protects the cart.
  if (!variant || !optionInStock(variant)) return;

  const key = cartKey(product.id, variant.kind);
  cart[key] = (cart[key] || 0) + 1;
  saveCart();
  updateCartUI();
  // Keeps the "No carrinho" marker in the favourites drawer honest.
  renderWishlistDrawer();
  openCart();
}

function changeQty(key, delta) {
  const next = (cart[key] || 0) + delta;
  if (next <= 0) {
    delete cart[key];
  } else {
    cart[key] = next;
  }
  saveCart();
  updateCartUI();
  renderWishlistDrawer();
}

function removeFromCart(key) {
  // (see addToCart: the favourites marker follows the cart)
  delete cart[key];
  saveCart();
  updateCartUI();
  renderWishlistDrawer();
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
    wishlistItemsEl.innerHTML = `<p class="cart-empty" data-i18n="wishlist.empty">Ainda não adicionou favoritos.</p>`;
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
          ${inCart(p.id) ? `<span class="in-cart-tag" data-i18n="wishlist.incart">No carrinho</span>` : ""}
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
// Which option the modal currently has selected, so the add button agrees with
// the price on screen.
let productDetailOption = null;

function openProductDetail(p) {
  if (!productDetailOverlay) return;
  productDetailId = p.id;
  const mediaEl = document.getElementById("pdMedia");
  mediaEl.className = `pd-media${p.image ? "" : ` ${p.tone}`}`;
  mediaEl.innerHTML = mediaContent(p);
  document.getElementById("pdCategory").textContent = p.category;
  document.getElementById("pdName").textContent = p.name;
  document.getElementById("pdNotes").textContent = p.notes;
  // The modal is the other way into the cart, so it offers the same choice as
  // the card. Without this, adding from Favoritos would silently pick a size.
  const sizesEl = document.getElementById("pdSizes");
  if (sizesEl) sizesEl.innerHTML = optionPicker(p, false) + (hasAmostra(p) ? amostraNote() : "");
  productDetailOption = defaultOption(p).kind;
  document.getElementById("pdPrice").innerHTML = priceMarkup(p, "pd-price") + campaignEndNote(p);
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
    // Same rule here: buying something does not un-favourite it.
    addToCart(productDetailId, productDetailOption ?? undefined);
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
  // Choosing bottle or amostra: swaps the selection and reprices in place,
  // without rebuilding the card — a rebuild would flip it back over.
  //
  // data-option-pick, not data-option: the add button carries data-option to
  // remember the current choice, and matching on that once made this branch
  // swallow every click on Comprar so the button did nothing at all.
  const optionBtn = e.target.closest("[data-option-pick]");
  if (optionBtn) {
    e.stopPropagation();
    selectCardOption(optionBtn);
    return;
  }

  const addBtn = e.target.closest("[data-add]");
  if (addBtn) {
    return addToCart(Number(addBtn.dataset.add), addBtn.dataset.option || undefined);
  }

  const wishBtn = e.target.closest("[data-wishlist]");
  if (wishBtn) return toggleWishlist(Number(wishBtn.dataset.wishlist));

  const wishRemove = e.target.closest("[data-wishlist-remove]");
  if (wishRemove) return toggleWishlist(Number(wishRemove.dataset.wishlistRemove));

  const wishAdd = e.target.closest("[data-wishlist-add]");
  if (wishAdd) {
    const id = Number(wishAdd.dataset.wishlistAdd);
    // Deliberately does NOT remove it from the wishlist. A wishlist is
    // something the shopper saved on purpose, not a queue that empties itself
    // as things are bought.
    addToCart(id);
    renderWishlistDrawer();
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

  // These carry a cart key ("12:3"), not a product id, so they are used as-is.
  const inc = e.target.closest("[data-inc]");
  if (inc) return changeQty(inc.dataset.inc, 1);

  const dec = e.target.closest("[data-dec]");
  if (dec) return changeQty(dec.dataset.dec, -1);

  const rem = e.target.closest("[data-remove]");
  if (rem) return removeFromCart(rem.dataset.remove);

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

// ---------- Search ----------
// Search is navigation, not a product picker. Typing a category takes you to
// that section of the collection; typing a perfume takes you to the collection
// with only that perfume showing. Either way you land on colecao.html with the
// page already filtered — the search never opens a product on top of whatever
// you were reading.

// Resolves a query to one of the collection's filter buttons, or null when it
// isn't a category search. General words ("perfumes") are skipped rather than
// failing the match, so "perfumes femininos" still resolves to feminino, while
// two different categories in one query resolve to neither.
function categoryForQuery(normalizedQuery) {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  let found = null;
  for (const rawWord of words) {
    if (SEARCH_STOP_WORDS.has(rawWord)) continue;
    const stems = queryStems(rawWord);
    if (stems.some(matchesGenericTerm)) continue;
    const hit = Object.keys(CATEGORY_SEARCH_TERMS).find((cat) =>
      CATEGORY_SEARCH_TERMS[cat].some((term) =>
        stems.some((stem) => term.startsWith(stem) || singularize(term).startsWith(stem))
      )
    );
    if (!hit || (found && found !== hit)) return null;
    found = hit;
  }
  return found;
}

function setActiveFilterButton(name) {
  document.querySelectorAll("#filters [data-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === name);
  });
}

// Points the collection at a section (or at a single perfume) without leaving
// the page. Used both when searching from colecao.html itself and when landing
// on it from another page.
function applyCollectionTarget(category, query) {
  activeFilter = category || "todos";
  setActiveFilterButton(activeFilter);
  // When the query was a category it has become the filter, so it should not
  // also sit in the search box narrowing the grid a second time.
  if (searchInput) searchInput.value = category ? "" : query || "";
  renderProducts();
}

function runSearch() {
  if (!searchInput) return;
  const typed = searchInput.value.trim();
  if (!typed) return;
  const category = categoryForQuery(normalizeText(typed));

  // Already on the collection: retarget in place and scroll the grid up to
  // the top of the results rather than reloading the page.
  if (grid) {
    applyCollectionTarget(category, typed);
    searchBar?.classList.remove("open");
    document.getElementById("colecao")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const params = category ? `cat=${category}` : `q=${encodeURIComponent(typed)}`;
  document.body.classList.add("page-leaving");
  setTimeout(() => { window.location.href = `colecao.html?${params}`; }, 170);
}

// On the collection page the grid narrows as you type; everywhere else the
// search only acts when you submit it.
searchInput?.addEventListener("input", () => { if (grid) renderProducts(); });

searchInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  runSearch();
});

// The magnifier in the open search bar submits too, so there is a tappable way
// to run the search on a phone without reaching for the keyboard's Go key.
searchBar?.querySelector("svg")?.addEventListener("click", runSearch);

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
async function logOrder(name, phone, receiptPath, paymentMethod, address, city, delivery) {
  let subtotal = 0;
  const items = cartLines().map(({ product: p, variant, qty, unitPrice }) => {
    subtotal += unitPrice * qty;
    const lineDiscount = activeDiscount(p, variant);
    // The image is snapshotted onto the order line so "os meus pedidos" can
    // still show the bottle after the product is edited or delisted. The size
    // is snapshotted for the same reason: renaming or removing a size later
    // must never rewrite what was actually ordered.
    return {
      id: p.id,
      name: p.name,
      // "variant" is what the credit trigger reads to spot an amostra line.
      variant: variant?.kind || "full",
      // Recorded per line, not per order: one basket can hold products from
      // two campaigns and products from none, and the report has to be able to
      // tell them apart. Null unless a campaign actually set this price.
      campaign_id: lineDiscount?.source === "campaign" ? lineDiscount.campaign.campaign_id : null,
      campaign_name: lineDiscount?.source === "campaign" ? lineDiscount.campaign.campaign_name : null,
      size: variant?.short || null,
      volume_ml: variant?.kind === "amostra" ? AMOSTRA_ML : p.volume_ml ?? null,
      price: unitPrice,
      qty,
      image: p.image || null,
    };
  });
  const discount = couponDiscountAmount(subtotal);
  // The delivery fee is part of what the customer agreed to pay, so it
  // belongs in the order total: otherwise the amount to transfer and the
  // recorded order value disagree.
  const deliveryFee = Number(delivery?.fee || 0);
  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const usedCoupon = discount > 0 ? appliedCoupon.code : null;

  const { data: order, error } = await supabaseClient
    .from("orders")
    .insert({
      items,
      total,
      // Checkout requires the comprovativo up front, so an order arrives already
      // waiting for someone to validate it. This used to say "pending", which
      // migration_12 removed from the allowed set — every new order was being
      // rejected by the status check constraint.
      status: "comprovativo_recebido",
      payment_status: "pending",
      payment_method: paymentMethod || null,
      customer_id: currentCustomer?.id || null,
      customer_name: name,
      customer_phone: phone,
      customer_address: address || null,
      customer_city: city || null,
      // Snapshot of the zone and the fee charged, so a later price change in
      // Definições never rewrites what an old order actually cost.
      delivery_zone: delivery?.zone || null,
      delivery_fee: deliveryFee,
      delivery_on_request: Boolean(delivery?.onRequest),
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
    newsletterNote.textContent = window.t?.("msg.newsletter.success") || "Obrigado! A sua subscrição foi registada.";
    newsletterForm.reset();
  } catch (err) {
    console.error("Falha ao registar inscrição no Supabase:", err);
    newsletterNote.textContent = window.t?.("msg.newsletter.error") || "Não foi possível concluir a sua subscrição. Tente novamente.";
  } finally {
    submitBtn?.removeAttribute("disabled");
  }
});

// ---------- Header scroll state + hero parallax ----------
// Scroll events fire faster than the screen redraws, so writing a transform
// straight from the handler does the work several times per frame and hands the
// compositor a moving target. One write per frame, from requestAnimationFrame,
// is what makes the parallax smooth rather than stepped.
let scrollTicking = false;

// How tall the top bar is, and therefore how far down the fixed header has to
// start. Zero when there is no bar, which is what leaves no empty strip behind
// when it is switched off or dismissed.
let topbarHeight = 0;
let topbarEl = null;

function setTopbarHeight(px) {
  topbarHeight = Math.max(0, Math.round(px) || 0);
  document.documentElement.style.setProperty("--topbar-h", `${topbarHeight}px`);
}

function applyScroll() {
  scrollTicking = false;
  const y = window.scrollY;
  if (siteHeader) {
    // The bar is in normal flow above a fixed header, so the header starts
    // below it and rises as the bar scrolls off. Clamped at zero, which is
    // where it stays for the rest of the page.
    const offset = Math.max(0, topbarHeight - y);
    siteHeader.style.top = topbarHeight ? `${offset}px` : "";
    // Pages without a hero (e.g. sobre.html) have no transparent state to fall back to.
    if (heroMedia) siteHeader.classList.toggle("scrolled", y > 40);
    else siteHeader.classList.add("scrolled");
  }
  // translate3d, not translateY: it keeps the element on the layer the
  // stylesheet promoted rather than dropping back to a repaint.
  if (heroMedia) heroMedia.style.transform = `translate3d(0, ${Math.min(y * 0.25, 160)}px, 0)`;
}

function handleScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(applyScroll);
}

window.addEventListener("scroll", handleScroll, { passive: true });
applyScroll();

// ---------- Scroll-triggered reveal ----------
// Sections fade in and rise as they enter the viewport, with their contents
// arriving in sequence — heading, then text, then the cards or the button.
//
// The hidden state is applied by this script, never by the stylesheet alone.
// That is deliberate: the previous version set opacity:0 on .reveal in CSS, so
// if the script failed the sections stayed invisible for good. Now a page
// without working JS simply shows everything.
const RISE_CHILDREN = [
  ".section-head > *",
  ".historia-content > *",
  ".quiz-teaser-inner > *",
  ".newsletter-inner > *",
  ".contato-panel",
  ".contato-aside",
  ".featured-grid",
  ".product-grid",
  ".carousel",
  ".carousel-controls",
  ".reviews-grid",
  ".sobre-banner-text",
  ".sobre-stats",
  ".processo-media",
  ".processo-content > *",
  ".colecao-head > *",
  ".filter-bar",
  ".policies-intro > *",
  ".contacto-intro > *",
  ".contacto-grid > *",
  ".faq-block",
].join(", ");

const STAGGER_MS = 100;
const MAX_STAGGER_STEPS = 6; // past this the last item feels like it is lagging

(() => {
  const sections = document.querySelectorAll(".reveal");
  if (!sections.length) return;

  const noMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window);

  // Nothing is hidden under reduced motion, or where the observer is missing.
  if (noMotion) {
    sections.forEach((s) => s.classList.add("in-view"));
    return;
  }

  sections.forEach((section) => {
    const children = section.querySelectorAll(RISE_CHILDREN);
    // A section with nothing to stagger still fades in as a whole.
    const targets = children.length ? children : [section];
    targets.forEach((el, i) => {
      el.classList.add("rise");
      el.style.transitionDelay = `${Math.min(i, MAX_STAGGER_STEPS) * STAGGER_MS}ms`;
    });
  });

  const show = (section) => {
    section.classList.add("in-view");
    io.unobserve(section);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) show(entry.target);
      });
    },
    // threshold: 0, NOT a fraction. A threshold is a proportion of the TARGET's
    // own area, so on a section taller than about eight screens the fraction on
    // screen can never reach it and the observer never fires at all. That is
    // what left Termos e Condições blank: a 5508px section in a 606px viewport
    // tops out at 11% visible against a 12% threshold. Any intersection now
    // counts, whatever the section's height.
    { threshold: 0, rootMargin: "0px 0px -40px 0px" }
  );
  sections.forEach((s) => io.observe(s));

  // Nothing stays hidden. If the observer has not fired for a section within a
  // couple of seconds — because it never qualified, because the callback threw,
  // or for any reason at all — the section is shown anyway. Text must never
  // depend on an animation succeeding in order to be readable.
  setTimeout(() => {
    sections.forEach((s) => {
      if (!s.classList.contains("in-view")) show(s);
    });
  }, 2000);
})();

// ---------- Idle autoplay for the reviews strip (mobile) ----------
// Advances one card at a time while the shopper isn't touching it; any
// manual scroll/touch pauses it for a while so it doesn't fight the user.
// (initIdleCarousel removed.) It was a second, independent auto-scroller
// running on the very same reviews strip every 3.5s using the browser's own
// scrollTo({behavior:"smooth"}), while the marquee/step animation above ran on
// its own schedule. Two animations driving one element at different intervals
// and different speeds is what made the motion look uneven no matter how the
// other one was tuned. The marquee is now the only thing that moves it.

// Landing here from a search elsewhere on the site: ?cat= opens a section of
// the collection, ?q= narrows it to what was typed. renderProducts() reads
// activeFilter and the search field, so both just need setting before the
// products:ready pass below.
const collectionParams = new URLSearchParams(window.location.search);
const searchQueryParam = collectionParams.get("q");
const categoryParam = collectionParams.get("cat");
// ?campanha=<id> narrows the collection to exactly what a campaign covers,
// which is where the banner's button lands.
const campaignParam = Number(collectionParams.get("campanha")) || null;

if (categoryParam && CATEGORY_SEARCH_TERMS[categoryParam]) {
  activeFilter = categoryParam;
}
if (searchQueryParam && searchInput) {
  searchInput.value = searchQueryParam;
  searchBar?.classList.add("open");
}

document.addEventListener("products:ready", () => {
  // Has to run before anything reads the cart: a cart saved before sizes
  // existed is keyed by product id alone, and would otherwise be dropped.
  migrateLegacyCart();
  // The filter chip has to reflect ?cat= too, or the grid would show one
  // section while "Todos" still looks selected.
  setActiveFilterButton(activeFilter);
  renderProducts();
  renderFeatured();
  renderCarousel();
  updateCartUI();
  updateWishlistUI();
});

// ---------- Fade out before navigating to another page ----------
// The fade IN is pure CSS now (see the page-in keyframes): it must not depend
// on this script running, or a script failure leaves a blank site. This class
// only ever fades a page OUT, so it can never hide content that is staying.

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
  document.body.classList.add("page-leaving");
  setTimeout(() => { window.location.href = href; }, 170);
});

// Safety net for any other route to a stuck fade-out: a hash change means the
// document survived, so the page must be visible.
window.addEventListener("hashchange", () => document.body.classList.remove("page-leaving"));

// Using the browser's Back button restores the page exactly as the tab left
// it (from bfcache) rather than reloading it — including the opacity:0 state
// set right above just before navigating away. Without this, going back
// lands on a page that's technically there but invisible: a blank screen.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) document.body.classList.remove("page-leaving");
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

// ---------- Promotional banner ----------
// Read live from the database on every page load, so switching it on in
// Definições shows it on the next load — no deploy, no cache to clear.
//
// ---------- The one bar at the top of the site ----------
// There is exactly one slot above the header, never two. It reads
// public.site_banner, a view that resolves the whole decision server-side and
// hands back a mode: "off", "manual" or "campaign". payment_settings itself
// stays closed to anonymous visitors because it also holds the IBAN.
//
// The bar sits BEFORE the header in the document rather than inside it. The
// header is fixed, so a bar inside it was fixed too and could never scroll
// away; from out here it scrolls with the page while the header follows it down
// and then sticks to the top.
(async () => {
  if (!siteHeader) return;
  try {
    const { data, error } = await supabaseClient.from("site_banner").select("*").maybeSingle();
    if (error || !data || data.mode === "off") return;

    const text = (data.banner_text || "").trim();
    if (!text) return;

    // Dismissed for this visit only, and keyed to the message: putting up a new
    // one is not silently hidden because the last one was dismissed.
    const key = `mushy-topbar-${data.banner_key || "x"}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch (err) {
      // Private browsing can refuse sessionStorage. Showing the bar is the
      // right thing to do when we cannot tell.
    }

    const bar = document.createElement("div");
    bar.className = "site-topbar";

    const message = document.createElement("span");
    message.className = "site-topbar-text";
    // textContent, not innerHTML: these strings are admin-entered and have no
    // business being able to inject markup into every page of the site.
    message.textContent = text;
    bar.append(message);

    const label = (data.banner_cta_label || "").trim();
    const url = (data.banner_cta_url || "").trim();
    if (label && url) {
      const link = document.createElement("a");
      link.className = "site-topbar-cta";
      // Relative paths only: an admin-entered href is not somewhere to allow
      // javascript: or an outside host to appear on every page of the site.
      link.href = /^[a-z]+:/i.test(url) || url.startsWith("//") ? "colecao.html" : url;
      link.textContent = label;
      bar.append(link);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "site-topbar-close";
    close.setAttribute("aria-label", "Fechar aviso");
    close.textContent = "×";
    close.addEventListener("click", () => {
      try { sessionStorage.setItem(key, "1"); } catch (err) { /* see above */ }
      bar.remove();
      document.body.classList.remove("has-topbar");
      setTopbarHeight(0);
      applyScroll();
    });
    bar.append(close);

    siteHeader.parentNode.insertBefore(bar, siteHeader);
    document.body.classList.add("has-topbar");
    topbarEl = bar;
    // Measured rather than assumed: the message wraps to two lines on a narrow
    // screen, and the header has to sit below whatever height that turns out
    // to be.
    setTopbarHeight(bar.offsetHeight);
    if (window.ResizeObserver) {
      new ResizeObserver(() => { setTopbarHeight(bar.offsetHeight); applyScroll(); }).observe(bar);
    }
    applyScroll();
  } catch (err) {
    // A bar is decoration. It must never be the reason a page fails.
    console.warn("top bar:", err);
  }
})();

// The written fixação/projecção labels are generated in JS, so data-i18n can't
// reach them — the grids have to rebuild themselves when the language changes.
document.addEventListener("lang:changed", () => {
  if (typeof PRODUCTS === "undefined" || !PRODUCTS.length) return;
  renderProducts();
  renderFeatured();
  renderCarousel();
});
