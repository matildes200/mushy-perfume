// ---------- "Find Your Scent" quiz ----------
// Loaded after js/main.js, so it shares PRODUCTS, addToCart, openProductDetail,
// priceMarkup, mediaContent, familyLabel, normalizeText, addButton, money.

// Each answer nudges a set of fragrance-family tags. Question 2 maps
// directly onto the families themselves (weight 3, the strongest signal);
// the other two are softer hints (weight 1-2) toward the same tags, so a
// shopper who never answers "Floral" outright can still land on one.
const QUIZ_QUESTIONS = [
  {
    key: "mood",
    weights: {
      delicada: { floral: 2, fresca: 1 },
      elegante: { floral: 1, amadeirada: 2 },
      sensual: { oriental: 2, amadeirada: 1 },
      misteriosa: { oriental: 1, amadeirada: 2 },
    },
  },
  {
    key: "family",
    weights: {
      floral: { floral: 3 },
      frutada: { frutada: 3 },
      fresca: { fresca: 3 },
      amadeirada: { amadeirada: 3 },
      oriental: { oriental: 3 },
    },
  },
  {
    key: "moment",
    weights: {
      brunch: { fresca: 2, floral: 1 },
      date: { oriental: 2, amadeirada: 1 },
      evening: { amadeirada: 2, oriental: 1 },
      everyday: { floral: 1, fresca: 1 },
    },
  },
];

// Keyword stems (accent-folded, matched via normalizeText from js/main.js)
// used to read a product's existing fragrance_family/notes text as one of
// the five tags above. New products only need fragrance_family filled in
// for this to pick them up automatically — no code change required.
const FAMILY_KEYWORDS = {
  floral: ["floral", "flor"],
  frutada: ["frutad", "fruta"],
  fresca: ["fresc", "citric", "aquatic"],
  amadeirada: ["amadeirad", "madeira", "woody"],
  oriental: ["oriental", "ambar", "baunilha", "especiad", "oud"],
};

function scoreProductAgainstTags(p, tagScores) {
  const familyText = normalizeText(p.fragrance_family || "");
  const wideText = normalizeText([p.fragrance_family, p.notes, p.notes_top, p.notes_heart, p.notes_base, p.short_description].filter(Boolean).join(" "));
  let score = 0;
  Object.entries(tagScores).forEach(([tag, weight]) => {
    if (!weight) return;
    const keywords = FAMILY_KEYWORDS[tag] || [tag];
    if (keywords.some((kw) => familyText.includes(kw))) score += weight * 3;
    else if (keywords.some((kw) => wideText.includes(kw))) score += weight;
  });
  return score;
}

// Never a hard-coded product: scores every active product against the
// quiz's tag weights, and only falls back to the site's own curation
// signals (featured/bestseller) when nothing in the catalog's fragrance
// metadata matches at all.
function recommendProduct(tagScores) {
  const candidates = PRODUCTS.filter((p) => p.active !== false);
  if (!candidates.length) return null;

  let best = null;
  let bestScore = -1;
  candidates.forEach((p) => {
    const score = scoreProductAgainstTags(p, tagScores);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  });

  if (bestScore <= 0) {
    return candidates.find((p) => p.featured) || candidates.find((p) => p.bestseller) || candidates[0];
  }
  return best;
}

let quizAnswers = {};
let quizResultProduct = null;

function goToQuizStep(step) {
  document.querySelectorAll("[data-quiz-step]").forEach((el) => {
    el.classList.toggle("active", el.dataset.quizStep === String(step));
  });
  const filled = step === "result" ? 3 : step + 1;
  document.querySelectorAll(".quiz-dot").forEach((dot, i) => dot.classList.toggle("active", i < filled));
}

function finishQuiz() {
  const tagScores = {};
  QUIZ_QUESTIONS.forEach((q) => {
    const weights = quizAnswers[q.key] ? q.weights[quizAnswers[q.key]] : null;
    if (!weights) return;
    Object.entries(weights).forEach(([tag, w]) => { tagScores[tag] = (tagScores[tag] || 0) + w; });
  });

  quizResultProduct = recommendProduct(tagScores);
  renderQuizResult(quizResultProduct);
  goToQuizStep("result");
}

function renderQuizResult(p) {
  const mediaEl = document.getElementById("quizResultMedia");
  if (!p) {
    mediaEl.innerHTML = "";
    document.getElementById("quizResultName").textContent = "Catálogo indisponível de momento.";
    document.getElementById("quizResultFamily").textContent = "";
    document.getElementById("quizResultDesc").textContent = "";
    document.getElementById("quizResultPrice").innerHTML = "";
    return;
  }
  mediaEl.className = `quiz-result-media${p.image ? "" : ` ${p.tone}`}`;
  mediaEl.innerHTML = mediaContent(p);
  document.getElementById("quizResultName").textContent = p.name;
  document.getElementById("quizResultFamily").textContent = familyLabel(p);
  document.getElementById("quizResultDesc").textContent = p.short_description || p.notes || "";
  document.getElementById("quizResultPrice").innerHTML = priceMarkup(p, "quiz-result-price-value");
}

document.querySelectorAll(".quiz-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.closest(".quiz-options");
    quizAnswers[group.dataset.question] = btn.dataset.value;
    group.querySelectorAll(".quiz-option").forEach((o) => o.classList.remove("selected"));
    btn.classList.add("selected");

    const currentStep = Number(btn.closest("[data-quiz-step]").dataset.quizStep);
    setTimeout(() => {
      if (currentStep < 2) goToQuizStep(currentStep + 1);
      else finishQuiz();
    }, 180);
  });
});

document.getElementById("openQuizBtn")?.addEventListener("click", () => {
  quizAnswers = {};
  document.querySelectorAll(".quiz-option").forEach((o) => o.classList.remove("selected"));
  goToQuizStep(0);
  document.getElementById("quizOverlay")?.classList.add("open");
});

document.getElementById("quizClose")?.addEventListener("click", () => {
  document.getElementById("quizOverlay")?.classList.remove("open");
});
document.getElementById("quizOverlay")?.addEventListener("click", (e) => {
  if (e.target.id === "quizOverlay") e.currentTarget.classList.remove("open");
});

document.getElementById("quizRestartBtn")?.addEventListener("click", () => {
  quizAnswers = {};
  document.querySelectorAll(".quiz-option").forEach((o) => o.classList.remove("selected"));
  goToQuizStep(0);
});

document.getElementById("quizBuyBtn")?.addEventListener("click", () => {
  if (!quizResultProduct) return;
  document.getElementById("quizOverlay")?.classList.remove("open");
  addToCart(quizResultProduct.id);
});

document.getElementById("quizViewBtn")?.addEventListener("click", () => {
  if (!quizResultProduct) return;
  document.getElementById("quizOverlay")?.classList.remove("open");
  openProductDetail(quizResultProduct);
});
