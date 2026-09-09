// ---------- Language toggle (PT-PT default / EN) ----------
// Covers site chrome: header, hero, section headings, buttons, cart/wishlist/
// checkout drawers, the quiz, and the footer — the parts every page shares.
// Long-form paragraphs (the Sobre/Quem somos story, policy text, product
// descriptions from the database) are intentionally left Portuguese-only:
// translating flowing prose well is a different job than UI strings, and
// shipping a rushed machine-ish English version of that copy would read worse
// than not translating it at all.
const TRANSLATIONS = {
  pt: {
    "nav.colecoes": "Coleções",
    "nav.sobre": "Sobre",
    "nav.contato": "Contato",
    "nav.buscar": "Buscar",
    "nav.conta": "Minha conta",
    "search.placeholder": "Buscar perfumes por nome...",

    "hero.eyebrow": "Mushy Parfum",
    "hero.headline": "Deixa um rasto<br>de Mushy.",
    "hero.text": "Fragrâncias para quem não passa despercebida.",
    "hero.cta.primary": "Descobrir fragrâncias",
    "hero.cta.secondary": "Explorar coleção",

    "destaque.title": "Nossa Seleção",
    "destaque.subtitle": "Perfumes escolhidos a dedo pela nossa equipa",
    "historia.eyebrow": "Sobre nós",
    "historia.title": "Nossa história",
    "historia.text": "Inspirados pela elegância atemporal, por ingredientes raros e pelo luxo contemporâneo, criamos cada fragrância pensando em quem não se contenta em passar despercebido.",
    "historia.cta": "Saiba mais",

    "maisvendidos.title": "Mais Vendidos",
    "maisvendidos.subtitle": "Os favoritos de quem já perfumou a sua história connosco",
    "carousel.vertodos": "Ver todos<br>os produtos",

    "quiz.eyebrow": "Encontra o teu perfume",
    "quiz.title": "Não sabes qual escolher?",
    "quiz.subtitle": "Encontra o perfume que combina contigo.",
    "quiz.cta": "Encontrar a minha fragrância",
    "quiz.q1": "Como queres ser lembrada?",
    "quiz.q1.delicada": "Delicada",
    "quiz.q1.elegante": "Elegante",
    "quiz.q1.sensual": "Sensual",
    "quiz.q1.misteriosa": "Misteriosa",
    "quiz.q2": "Que tipo de fragrância combina mais contigo?",
    "quiz.q2.floral": "Floral",
    "quiz.q2.frutada": "Frutada",
    "quiz.q2.fresca": "Fresca",
    "quiz.q2.amadeirada": "Amadeirada",
    "quiz.q2.oriental": "Oriental",
    "quiz.q3": "Qual ambiente combina mais contigo?",
    "quiz.q3.brunch": "Brunch ao sol",
    "quiz.q3.date": "Noite a dois",
    "quiz.q3.evening": "Elegância noturna",
    "quiz.q3.everyday": "Chique do dia a dia",
    "quiz.result.eyebrow": "A tua fragrância Mushy",
    "quiz.result.buy": "Comprar agora",
    "quiz.result.view": "Ver fragrância",
    "quiz.result.restart": "Refazer o questionário",

    "notas.title": "Descubra as Fragrâncias",
    "notas.subtitle": "Conheça as notas aromáticas que compõem cada perfume e descubra a essência por trás de cada fragrância.",
    "reviews.title": "Experiências reais",
    "newsletter.title": "Faça parte da coleção",
    "newsletter.subtitle": "Receba lançamentos exclusivos e ofertas privadas.",
    "newsletter.placeholder": "Seu endereço de e-mail",
    "newsletter.cta": "Assinar",
    "contato.title": "Fale connosco",
    "contato.subtitle": "Dúvidas sobre um perfume, prazo de entrega ou o seu pedido? Fale connosco.",

    "footer.direitos": "Todos os direitos reservados.",
    "footer.tagline": "Feito com carinho para quem ama perfumaria.",

    "cart.title": "Seu carrinho",
    "cart.empty": "Seu carrinho está vazio.",
    "cart.coupon.toggle": "Tem um cupom de desconto?",
    "cart.coupon.apply": "Aplicar",
    "cart.subtotal": "Subtotal",
    "cart.total": "Total",
    "cart.checkout": "Finalizar Compra",
    "cart.note": "Pagamento por transferência bancária.",
    "wishlist.title": "Seus favoritos",
    "wishlist.empty": "Você ainda não adicionou favoritos.",

    "checkout.auth.title": "Entre para continuar",
    "checkout.auth.subtitle": "Você precisa estar conectado para finalizar o pedido.",
    "checkout.tab.login": "Entrar",
    "checkout.tab.register": "Criar conta",
    "checkout.payment.title": "Pagamento",
    "checkout.payment.subtitle": "Escolha como prefere pagar, transfira o valor e envie o comprovativo.",
    "checkout.method.bank": "Transferência Bancária",
    "checkout.method.express": "Express",
    "checkout.receipt.label": "Enviar comprovativo (imagem ou PDF) — obrigatório",
    "checkout.submit": "Confirmar pedido",
    "checkout.done.title": "Pedido confirmado!",
    "checkout.done.subtitle": "Obrigado pela sua compra. Você receberá um e-mail assim que confirmarmos o pagamento.",
    "checkout.done.cta": "Concluir",

    "pd.addToCart": "Adicionar ao carrinho",
    "product.add": "Adicionar",
    "product.buy": "Comprar",
    "product.soldout": "Esgotado",
    "badge.bestseller": "Mais Vendido",
    "badge.new": "Novidade",

    "colecao.title": "Nossa Coleção",
    "colecao.subtitle": "Filtre por categoria e encontre o seu perfume ideal",
    "filter.todos": "Todos",
    "filter.feminino": "Feminino",
    "filter.masculino": "Masculino",
    "filter.unissex": "Unissex",
  },
  en: {
    "nav.colecoes": "Collections",
    "nav.sobre": "About",
    "nav.contato": "Contact",
    "nav.buscar": "Search",
    "nav.conta": "My account",
    "search.placeholder": "Search perfumes by name...",

    "hero.eyebrow": "Mushy Parfum",
    "hero.headline": "Leave a little<br>Mushy behind.",
    "hero.text": "Fragrances for those who don't go unnoticed.",
    "hero.cta.primary": "Discover fragrances",
    "hero.cta.secondary": "Explore collection",

    "destaque.title": "Our Selection",
    "destaque.subtitle": "Perfumes hand-picked by our team",
    "historia.eyebrow": "About us",
    "historia.title": "Our story",
    "historia.text": "Inspired by timeless elegance, rare ingredients and contemporary luxury, we create every fragrance for those who refuse to go unnoticed.",
    "historia.cta": "Learn more",

    "maisvendidos.title": "Best Sellers",
    "maisvendidos.subtitle": "The favourites of those who've already scented their story with us",
    "carousel.vertodos": "See all<br>products",

    "quiz.eyebrow": "Find Your Scent",
    "quiz.title": "Not sure which one to choose?",
    "quiz.subtitle": "Find the perfume that matches you.",
    "quiz.cta": "Find my fragrance",
    "quiz.q1": "How do you want to be remembered?",
    "quiz.q1.delicada": "Delicate",
    "quiz.q1.elegante": "Elegant",
    "quiz.q1.sensual": "Sensual",
    "quiz.q1.misteriosa": "Mysterious",
    "quiz.q2": "Which fragrance type suits you most?",
    "quiz.q2.floral": "Floral",
    "quiz.q2.frutada": "Fruity",
    "quiz.q2.fresca": "Fresh",
    "quiz.q2.amadeirada": "Woody",
    "quiz.q2.oriental": "Oriental",
    "quiz.q3": "Which setting suits you most?",
    "quiz.q3.brunch": "Brunch & sunshine",
    "quiz.q3.date": "Date night",
    "quiz.q3.evening": "Evening elegance",
    "quiz.q3.everyday": "Everyday chic",
    "quiz.result.eyebrow": "Your Mushy fragrance",
    "quiz.result.buy": "Buy now",
    "quiz.result.view": "View fragrance",
    "quiz.result.restart": "Retake the quiz",

    "notas.title": "Discover the Fragrances",
    "notas.subtitle": "Get to know the aromatic notes behind every perfume and discover the essence of each fragrance.",
    "reviews.title": "Real experiences",
    "newsletter.title": "Join the collection",
    "newsletter.subtitle": "Get exclusive launches and private offers.",
    "newsletter.placeholder": "Your email address",
    "newsletter.cta": "Subscribe",
    "contato.title": "Get in touch",
    "contato.subtitle": "Questions about a perfume, delivery time or your order? Get in touch.",

    "footer.direitos": "All rights reserved.",
    "footer.tagline": "Made with care for those who love perfumery.",

    "cart.title": "Your cart",
    "cart.empty": "Your cart is empty.",
    "cart.coupon.toggle": "Have a discount code?",
    "cart.coupon.apply": "Apply",
    "cart.subtotal": "Subtotal",
    "cart.total": "Total",
    "cart.checkout": "Checkout",
    "cart.note": "Payment by bank transfer.",
    "wishlist.title": "Your favourites",
    "wishlist.empty": "You haven't added any favourites yet.",

    "checkout.auth.title": "Sign in to continue",
    "checkout.auth.subtitle": "You need to be signed in to complete your order.",
    "checkout.tab.login": "Sign in",
    "checkout.tab.register": "Create account",
    "checkout.payment.title": "Payment",
    "checkout.payment.subtitle": "Choose how you'd like to pay, transfer the amount and upload your receipt.",
    "checkout.method.bank": "Bank Transfer",
    "checkout.method.express": "Express",
    "checkout.receipt.label": "Upload receipt (image or PDF) — required",
    "checkout.submit": "Confirm order",
    "checkout.done.title": "Order confirmed!",
    "checkout.done.subtitle": "Thank you for your purchase. You'll receive an email once we confirm your payment.",
    "checkout.done.cta": "Done",

    "pd.addToCart": "Add to cart",
    "product.add": "Add",
    "product.buy": "Buy",
    "product.soldout": "Sold out",
    "badge.bestseller": "Best Seller",
    "badge.new": "New",

    "colecao.title": "Our Collection",
    "colecao.subtitle": "Filter by category and find your perfect perfume",
    "filter.todos": "All",
    "filter.feminino": "Feminine",
    "filter.masculino": "Masculine",
    "filter.unissex": "Unisex",
  },
};

function getLang() {
  return localStorage.getItem("mushy-lang") || "pt";
}

function applyTranslations(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
  });
  document.documentElement.lang = lang === "en" ? "en" : "pt-PT";
  document.querySelectorAll(".lang-toggle").forEach((btn) => { btn.textContent = lang === "en" ? "PT" : "EN"; });
}

function setLang(lang) {
  localStorage.setItem("mushy-lang", lang);
  applyTranslations(lang);
}

// This script loads at the end of <body>, after all markup — DOMContentLoaded
// has already fired by then, so waiting for it here would mean the callback
// never runs. Applying immediately is correct since every [data-i18n]
// element already exists in the DOM at this point.
applyTranslations(getLang());
document.querySelectorAll(".lang-toggle").forEach((btn) => {
  btn.addEventListener("click", () => setLang(getLang() === "en" ? "pt" : "en"));
});

// The bestseller carousel (js/main.js) renders its "Ver todos" card after
// products load asynchronously from Supabase — later than this script's
// first pass — so it needs its own translation pass once that markup exists.
document.addEventListener("products:ready", () => applyTranslations(getLang()));
