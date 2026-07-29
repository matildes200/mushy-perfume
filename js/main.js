const WHATSAPP_NUMBER = "5511999999999"; // TODO: substitua pelo número real da loja

const grid = document.getElementById("productGrid");
const filters = document.getElementById("filters");
const cartBtn = document.getElementById("cartBtn");
const cartClose = document.getElementById("cartClose");
const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");
const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

const money = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let cart = JSON.parse(localStorage.getItem("mushy-cart") || "{}");

function saveCart() {
  localStorage.setItem("mushy-cart", JSON.stringify(cart));
}

function bottleIcon() {
  return `<svg viewBox="0 0 100 130" class="bottle-icon"><path d="M40 10h20v9c5 3 8 8 8 15v75a7 7 0 0 1-7 7H39a7 7 0 0 1-7-7V34c0-7 3-12 8-15v-9z" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="44" y="4" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><line x1="32" y1="60" x2="68" y2="60" stroke="currentColor" stroke-width="1.4"/></svg>`;
}

function renderProducts(filter = "todos") {
  const items = filter === "todos" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);
  grid.innerHTML = items
    .map(
      (p) => `
    <article class="product-card">
      <div class="product-media ${p.tone}">${bottleIcon()}</div>
      <div class="product-body">
        <span class="product-category">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="product-notes">${p.notes}</p>
        <div class="product-footer">
          <span class="product-price">${money(p.price)}</span>
          <button class="btn btn-small" data-add="${p.id}">Adicionar</button>
        </div>
      </div>
    </article>`
    )
    .join("");
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
        <div class="cart-item-media ${p.tone}">${bottleIcon()}</div>
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

grid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (btn) addToCart(Number(btn.dataset.add));
});

cartItemsEl.addEventListener("click", (e) => {
  const inc = e.target.closest("[data-inc]");
  const dec = e.target.closest("[data-dec]");
  const rem = e.target.closest("[data-remove]");
  if (inc) changeQty(Number(inc.dataset.inc), 1);
  if (dec) changeQty(Number(dec.dataset.dec), -1);
  if (rem) removeFromCart(Number(rem.dataset.remove));
});

filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  filters.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderProducts(btn.dataset.filter);
});

cartBtn.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

checkoutBtn.addEventListener("click", (e) => {
  if (Object.keys(cart).length === 0) {
    e.preventDefault();
    return;
  }
  checkoutBtn.setAttribute("href", buildWhatsAppMessage());
  checkoutBtn.setAttribute("target", "_blank");
  checkoutBtn.setAttribute("rel", "noopener");
});

menuBtn.addEventListener("click", () => mainNav.classList.toggle("open"));

renderProducts();
updateCartUI();
