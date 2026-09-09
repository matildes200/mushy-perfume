const WHATSAPP_NUMBER = "5511999999999"; // TODO: substitua pelo número real da loja

// Referral links point to conta.html?ref=CODE; the code is stashed until the
// visitor actually finishes creating an account (see showProfile() in conta.js).
const refParam = new URLSearchParams(window.location.search).get("ref");
if (refParam) localStorage.setItem("mushy-pending-ref", refParam.toUpperCase());

// Some mobile browsers restore the previous scroll position before this script
// runs, which can leave the fixed header rendered outside the visible viewport
// until the next manual scroll. Forcing a clean top-of-page load avoids that.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

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

function priceMarkup(p, className) {
  if (!p.discount_percent) return `<span class="${className}">${money(p.price)}</span>`;
  return `<span class="${className} price-discounted">
    <span class="price-original">${money(p.price)}</span>
    <span class="price-final">${money(effectivePrice(p))}</span>
    <span class="price-badge">-${p.discount_percent}%</span>
  </span>`;
}

function stockBadge(p) {
  return isOutOfStock(p) ? `<span class="stock-badge">Esgotado</span>` : "";
}

function addButton(p, label) {
  return isOutOfStock(p)
    ? `<button class="btn btn-small" disabled>Esgotado</button>`
    : `<button class="btn btn-small" data-add="${p.id}">${label}</button>`;
}

// Resolved to an absolute URL: a relative url() stored in a CSS custom property
// resolves against the stylesheet that reads it via var(), not against this page,
// so a plain relative path breaks once it's consumed from css/style.css.
const cardImageUrl = (path) => new URL(path, document.baseURI).href;

// Search terms that should match a category even though they never appear in the data
// (e.g. "perfume de mulher" should surface the feminino products).
const CATEGORY_SEARCH_TERMS = {
  feminino: ["feminino", "femininos", "feminina", "femininas", "mulher", "mulheres", "woman", "women"],
  masculino: ["masculino", "masculinos", "masculina", "masculinas", "homem", "homens", "man", "men"],
  unissex: ["unissex", "unisex"],
};

const ACCENT_FOLD = { á: "a", à: "a", â: "a", ã: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", õ: "o", ö: "o", ú: "u", ù: "u", û: "u", ü: "u", ç: "c" };
const normalizeText = (str) =>
  str
    .toLowerCase()
    .split("")
    .map((ch) => ACCENT_FOLD[ch] || ch)
    .join("");

function productMatchesSearch(p, normalizedQuery) {
  if (!normalizedQuery) return true;
  if (normalizeText(p.name).includes(normalizedQuery)) return true;
  if (normalizeText(p.notes).includes(normalizedQuery)) return true;
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const categoryTerms = CATEGORY_SEARCH_TERMS[p.category] || [];
  return queryWords.some((word) => categoryTerms.includes(word));
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

// "Floral · Feminino" — whichever of these two pieces of metadata exist.
// fragrance_family is admin-entered free text and often blank on older
// products, so this degrades gracefully to just the category, or nothing.
function familyLabel(p) {
  return [p.fragrance_family, p.category ? capitalize(p.category) : null].filter(Boolean).join(" · ");
}

// Only ever one badge (never both at once, to avoid cluttering the corner),
// and only when the product's own flag supports it — never hard-coded.
function badgeMarkup(p) {
  if (p.bestseller) return `<span class="perfume-badge badge-bestseller">Mais Vendido</span>`;
  if (p.new_arrival) return `<span class="perfume-badge badge-new">Novidade</span>`;
  return "";
}

// Shared by .product-card / .carousel-card / .featured-card: a bordered
// image panel (zoom on hover) plus a body where name/family/description/
// price stay visible at all times — no flip, nothing hidden behind hover.
function perfumeCardTemplate(p, wrapClass, addLabel) {
  const toneClass = p.image ? "" : ` ${p.tone}`;
  const style = p.image ? ` style="--card-image:url('${cardImageUrl(p.image)}')"` : "";
  const description = p.short_description || p.notes || "";
  const family = familyLabel(p);
  return `
    <article class="${wrapClass}" data-open="${p.id}">
      <div class="perfume-card-media-wrap">
        <div class="perfume-card-media${toneClass}"${style}>
          ${p.image ? "" : `<div class="product-card-icon">${bottleIcon()}</div>`}
        </div>
        ${badgeMarkup(p)}
        ${stockBadge(p)}
        ${wishlistHeart(p.id)}
      </div>
      <div class="perfume-card-body">
        ${family ? `<span class="perfume-card-family">${family}</span>` : ""}
        <h3 class="perfume-card-name">${p.name}</h3>
        ${description ? `<p class="perfume-card-desc">${description}</p>` : ""}
        <div class="perfume-card-footer">
          ${priceMarkup(p, "perfume-card-price")}
          ${addButton(p, addLabel)}
        </div>
      </div>
    </article>`;
}

function productCardTemplate(p) { return perfumeCardTemplate(p, "product-card", "Adicionar"); }
function featuredCardTemplate(p) { return perfumeCardTemplate(p, "featured-card", "Comprar"); }
function carouselCardTemplate(p) { return perfumeCardTemplate(p, "carousel-card", "Adicionar"); }

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
    : `<p class="cart-empty">Nenhum perfume encontrado.</p>`;
}

function renderFeatured() {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = PRODUCTS.filter((p) => isVisible(p) && p.featured).map(featuredCardTemplate).join("");
}

function renderCarousel() {
  if (!carouselTrack) return;
  const cards = PRODUCTS.filter((p) => isVisible(p) && p.bestseller).map(carouselCardTemplate).join("");
  carouselTrack.innerHTML = `${cards}
    <a href="colecao.html" class="carousel-end-card">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <span data-i18n="carousel.vertodos">Ver todos<br>os produtos</span>
    </a>`;
}

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

const COUPON_REASON_MESSAGES = {
  not_found: "Cupom não encontrado.",
  inactive: "Este cupom não está mais ativo.",
  not_started: "Este cupom ainda não é válido.",
  expired: "Este cupom expirou.",
  max_uses: "Este cupom atingiu o limite de usos.",
};

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
      showCouponMessage("Não foi possível validar este cupom. Tente novamente.", "error");
      return;
    }
    if (!result.valid) {
      if (result.reason_code === "min_order") {
        showCouponMessage(`Pedido mínimo de ${money(result.min_order_value)} para usar este cupom.`, "error");
      } else {
        showCouponMessage(COUPON_REASON_MESSAGES[result.reason_code] || "Cupom inválido.", "error");
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
    showCouponMessage(`Cupom ${appliedCoupon.code} aplicado!`, "success");
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
      if (appliedCoupon) showCouponMessage(`Adicione mais ${money(appliedCoupon.min_order_value - subtotal)} para usar o cupom ${appliedCoupon.code}.`, "error");
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

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
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
  const waBtn = document.getElementById("pdWhatsAppBtn");
  if (waBtn) {
    const message = `Olá, Mushy! Tenho interesse no perfume ${p.name}. Podem ajudar-me com a compra?`;
    waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
  productDetailOverlay.classList.add("open");
}

function closeProductDetail() {
  productDetailOverlay?.classList.remove("open");
  productDetailId = null;
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
}
function closeWishlist() {
  wishlistDrawer.classList.remove("open");
  wishlistOverlay.classList.remove("open");
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

searchInput?.addEventListener("input", renderProducts);
searchInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;
  if (grid) return renderProducts();
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
async function logOrder(name, phone, receiptPath, paymentMethod) {
  const ids = Object.keys(cart);
  let subtotal = 0;
  const items = ids.map((id) => {
    const p = PRODUCTS.find((x) => x.id === Number(id));
    const qty = cart[id];
    const unitPrice = effectivePrice(p);
    subtotal += unitPrice * qty;
    return { id: p.id, name: p.name, price: unitPrice, qty };
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
    newsletterNote.textContent = "Obrigado! Você foi inscrito com sucesso.";
    newsletterForm.reset();
  } catch (err) {
    console.error("Falha ao registrar inscrição no Supabase:", err);
    newsletterNote.textContent = "Não foi possível concluir sua inscrição. Tente novamente.";
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
function initIdleCarousel(container, intervalMs) {
  if (!container) return;
  let paused = false;
  let resumeTimer = null;
  const pause = () => {
    paused = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { paused = false; }, intervalMs * 2);
  };
  ["touchstart", "pointerdown", "wheel"].forEach((evt) => container.addEventListener(evt, pause, { passive: true }));

  setInterval(() => {
    if (paused || container.scrollWidth <= container.clientWidth + 4) return;
    const card = container.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(container).gap || "0");
    const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
    container.scrollTo({ left: atEnd ? 0 : container.scrollLeft + step, behavior: "smooth" });
  }, intervalMs);
}
initIdleCarousel(document.getElementById("reviewsGrid"), 3500);

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

  e.preventDefault();
  document.body.classList.remove("page-loaded");
  setTimeout(() => { window.location.href = href; }, 170);
});

// Using the browser's Back button restores the page exactly as the tab left
// it (from bfcache) rather than reloading it — including the opacity:0 state
// set right above just before navigating away. Without this, going back
// lands on a page that's technically there but invisible: a blank screen.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) document.body.classList.add("page-loaded");
});
