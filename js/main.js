const WHATSAPP_NUMBER = "5511999999999"; // TODO: substitua pelo número real da loja

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
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");

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

const money = (v) => `${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

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

function productCardTemplate(p) {
  const toneClass = p.image ? "" : ` ${p.tone}`;
  const style = p.image ? ` style="--card-image:url('${cardImageUrl(p.image)}')"` : "";
  return `
    <article class="product-card">
      <div class="card-flip">
        <div class="card-face card-face-front${toneClass}"${style}>
          ${wishlistHeart(p.id)}
          ${p.image ? "" : `<div class="product-card-icon">${bottleIcon()}</div>`}
          <span class="card-flip-hint">Toque para ver detalhes</span>
        </div>
        <div class="card-face card-face-back">
          <span class="product-category">${p.category}</span>
          <h3>${p.name}</h3>
          <p class="product-notes">${p.notes}</p>
          <div class="product-footer">
            <span class="product-price">${money(p.price)}</span>
            <button class="btn btn-small" data-add="${p.id}">Adicionar</button>
          </div>
        </div>
      </div>
    </article>`;
}

function featuredCardTemplate(p) {
  const hasImage = Boolean(p.image);
  const style = hasImage ? ` style="--card-image:url('${cardImageUrl(p.image)}')"` : "";
  return `
    <article class="featured-card${hasImage ? " has-image" : ""}"${style}>
      ${wishlistHeart(p.id)}
      ${hasImage ? "" : `<div class="featured-media">${mediaContent(p)}</div>`}
      <div class="featured-body">
        <span class="featured-category">${p.category}</span>
        <h3 class="featured-name">${p.name}</h3>
        <span class="featured-price">${money(p.price)}</span>
        <button class="btn btn-small" data-add="${p.id}">Comprar</button>
      </div>
    </article>`;
}

function carouselCardTemplate(p) {
  const toneClass = p.image ? "" : ` ${p.tone}`;
  const style = p.image ? ` style="--card-image:url('${cardImageUrl(p.image)}')"` : "";
  return `
    <article class="carousel-card">
      <div class="card-flip">
        <div class="card-face card-face-front${toneClass}"${style}>
          ${wishlistHeart(p.id)}
          ${p.image ? "" : `<div class="product-card-icon">${bottleIcon()}</div>`}
          <span class="card-flip-hint">Toque para ver detalhes</span>
        </div>
        <div class="card-face card-face-back">
          <span class="carousel-category">${p.category}</span>
          <h3>${p.name}</h3>
          <p class="carousel-notes">${p.notes}</p>
          <div class="carousel-footer">
            <span class="carousel-price">${money(p.price)}</span>
            <button class="btn btn-small" data-add="${p.id}">Adicionar</button>
          </div>
        </div>
      </div>
    </article>`;
}

const CATEGORY_ORDER = { masculino: 0, feminino: 1, unissex: 2 };

function renderProducts() {
  if (!grid) return;
  const query = searchInput ? normalizeText(searchInput.value.trim()) : "";
  const items = PRODUCTS.filter((p) => {
    const matchesCategory = activeFilter === "todos" || p.category === activeFilter;
    return matchesCategory && productMatchesSearch(p, query);
  }).sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);
  grid.innerHTML = items.length
    ? items.map(productCardTemplate).join("")
    : `<p class="cart-empty">Nenhum perfume encontrado.</p>`;
}

function renderFeatured() {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = PRODUCTS.filter((p) => p.featured).map(featuredCardTemplate).join("");
}

function renderCarousel() {
  if (!carouselTrack) return;
  carouselTrack.innerHTML = PRODUCTS.filter((p) => p.bestseller).map(carouselCardTemplate).join("");
}

function updateCartUI() {
  const ids = Object.keys(cart);
  const totalCount = ids.reduce((sum, id) => sum + cart[id], 0);
  cartCountEl.textContent = totalCount;
  cartCountEl.style.display = totalCount > 0 ? "flex" : "none";

  if (ids.length === 0) {
    cartItemsEl.innerHTML = `<p class="cart-empty">Seu carrinho está vazio.</p>`;
    cartTotalEl.textContent = money(0);
    checkoutBtn.classList.add("disabled");
    return;
  }

  checkoutBtn.classList.remove("disabled");

  let total = 0;
  cartItemsEl.innerHTML = ids
    .map((id) => {
      const p = PRODUCTS.find((x) => x.id === Number(id));
      const qty = cart[id];
      const subtotal = p.price * qty;
      total += subtotal;
      return `
      <div class="cart-item">
        <div class="cart-item-media ${p.image ? "" : p.tone}">${mediaContent(p)}</div>
        <div class="cart-item-info">
          <strong>${p.name}</strong>
          <span>${money(p.price)}</span>
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
    wishlistItemsEl.innerHTML = `<p class="cart-empty">Você ainda não adicionou favoritos.</p>`;
    return;
  }
  wishlistItemsEl.innerHTML = wishlist
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean)
    .map(
      (p) => `
      <div class="cart-item">
        <div class="cart-item-media ${p.image ? "" : p.tone}">${mediaContent(p)}</div>
        <div class="cart-item-info">
          <strong>${p.name}</strong>
          <span>${money(p.price)}</span>
        </div>
        <button class="remove-btn" data-wishlist-remove="${p.id}" aria-label="Remover dos favoritos">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`
    )
    .join("");
}

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

function buildWhatsAppMessage() {
  const ids = Object.keys(cart);
  let total = 0;
  const lines = ids.map((id) => {
    const p = PRODUCTS.find((x) => x.id === Number(id));
    const qty = cart[id];
    const subtotal = p.price * qty;
    total += subtotal;
    return `• ${p.name} x${qty} — ${money(subtotal)}`;
  });
  const message = [
    "Olá! Gostaria de finalizar este pedido na Mushy Perfume:",
    "",
    ...lines,
    "",
    `Total: ${money(total)}`,
  ].join("\n");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ---------- Delegated click handling (grid / featured / carousel / cart / wishlist / filters) ----------
document.body.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) return addToCart(Number(addBtn.dataset.add));

  const wishBtn = e.target.closest("[data-wishlist]");
  if (wishBtn) return toggleWishlist(Number(wishBtn.dataset.wishlist));

  const wishRemove = e.target.closest("[data-wishlist-remove]");
  if (wishRemove) return toggleWishlist(Number(wishRemove.dataset.wishlistRemove));

  const inc = e.target.closest("[data-inc]");
  if (inc) return changeQty(Number(inc.dataset.inc), 1);

  const dec = e.target.closest("[data-dec]");
  if (dec) return changeQty(Number(dec.dataset.dec), -1);

  const rem = e.target.closest("[data-remove]");
  if (rem) return removeFromCart(Number(rem.dataset.remove));

  const filterBtn = e.target.closest(".filter-btn");
  if (filterBtn && filters && filters.contains(filterBtn)) {
    filters.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    filterBtn.classList.add("active");
    activeFilter = filterBtn.dataset.filter;
    renderProducts();
    return;
  }

  const flipCard = e.target.closest(".product-card, .carousel-card");
  if (flipCard) flipCard.classList.toggle("flipped");
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

checkoutBtn?.addEventListener("click", (e) => {
  if (Object.keys(cart).length === 0) {
    e.preventDefault();
    return;
  }
  checkoutBtn.setAttribute("href", buildWhatsAppMessage());
  checkoutBtn.setAttribute("target", "_blank");
  checkoutBtn.setAttribute("rel", "noopener");
});

menuBtn?.addEventListener("click", () => mainNav.classList.toggle("open"));

searchBtn?.addEventListener("click", () => {
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

newsletterForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!newsletterEmail.value) return;
  newsletterNote.textContent = "Obrigado! Você foi inscrito com sucesso.";
  newsletterForm.reset();
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

const searchQueryParam = new URLSearchParams(window.location.search).get("q");
if (searchQueryParam && searchInput) {
  searchInput.value = searchQueryParam;
  searchBar?.classList.add("open");
}

renderProducts();
renderFeatured();
renderCarousel();
updateCartUI();
updateWishlistUI();

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
