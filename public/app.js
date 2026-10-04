const config = window.GARAGE_CONFIG || {};
const state = { products: [], category: "Todo", search: "", sort: "order" };

const els = {
  grid: document.querySelector("#grid"),
  empty: document.querySelector("#empty"),
  categories: document.querySelector("#categories"),
  search: document.querySelector("#search"),
  sort: document.querySelector("#sort"),
  count: document.querySelector("#resultCount"),
};

const normalize = (value = "") =>
  String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const money = (value, currency = config.currency || "ARS") =>
  new Intl.NumberFormat(config.locale || "es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));

const priceLabel = (product) => {
  if (product.price === null || product.price === undefined || product.price === "") {
    return "Consultar";
  }
  const value = Number(product.price);
  if (Number.isNaN(value)) return "Consultar";
  return money(value, product.currency || config.currency);
};

const productImage = (product) =>
  product.image || (product.id ? `/products/${product.id}.webp` : "");

function whatsappUrl(product) {
  if (!config.whatsappNumber) return "";
  const message = `Hola! Me interesa ${product.name} (${product.id}) de la venta de garage. ¿Sigue disponible? Quisiera coordinar para comprarlo.`;
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function renderCategories() {
  const cats = ["Todo", ...new Set(state.products.map(p => p.category).filter(Boolean))];
  els.categories.innerHTML = cats.map(cat =>
    `<button class="chip ${cat === state.category ? "active" : ""}" data-category="${cat}">${cat}</button>`
  ).join("");
}

function visibleProducts() {
  let items = state.products.filter(p => p.publish !== false && p.availability !== "Vendido");
  if (state.category !== "Todo") items = items.filter(p => p.category === state.category);
  if (state.search) {
    const q = normalize(state.search);
    items = items.filter(p => normalize([
      p.name,p.category,p.type,p.brand,p.size,p.color,p.description
    ].filter(Boolean).join(" ")).includes(q));
  }
  items.sort((a,b) => {
    if (state.sort === "price-asc") return Number(a.price ?? Infinity) - Number(b.price ?? Infinity);
    if (state.sort === "price-desc") return Number(b.price ?? -Infinity) - Number(a.price ?? -Infinity);
    if (state.sort === "name") return String(a.name).localeCompare(String(b.name),"es");
    return Number(a.order||9999) - Number(b.order||9999);
  });
  return items;
}

function card(product) {
  const href = whatsappUrl(product);
  const attrs = [
    product.brand,
    product.size ? `Talle ${product.size}` : "",
    product.color,
    product.condition
  ].filter(Boolean);
  const image = productImage(product);

  return `<article class="card">
    <div class="image-wrap">
      <div class="image-placeholder" aria-hidden="true">
        <span>${product.id || ""}</span>
        <strong>Foto próximamente</strong>
      </div>
      ${image ? `<img src="${image}" alt="${product.name}" loading="lazy" decoding="async">` : ""}
      ${product.availability === "Reservado" ? '<span class="badge">Reservado</span>' : ""}
    </div>
    <div class="card-body">
      <div class="meta">${[product.category, product.type].filter(Boolean).join(" · ")}</div>
      <h2>${product.name}</h2>
      ${product.description ? `<p class="description">${product.description}</p>` : ""}
      <div class="attrs">${attrs.map(a => `<span class="attr">${a}</span>`).join("")}</div>
      <div class="bottom">
        <div class="price">${priceLabel(product)}</div>
        <a class="cta ${href ? "" : "disabled"}" href="${href || "#"}" target="_blank" rel="noopener">Me interesa</a>
      </div>
    </div>
  </article>`;
}

function bindImageFallbacks() {
  els.grid.querySelectorAll(".image-wrap img").forEach(img => {
    img.addEventListener("error", () => img.remove(), { once: true });
  });
}

function render() {
  const items = visibleProducts();
  els.count.textContent = `${items.length} ${items.length === 1 ? "producto" : "productos"}`;
  els.grid.innerHTML = items.map(card).join("");
  els.empty.hidden = items.length !== 0;
  renderCategories();
  bindImageFallbacks();
}

els.categories.addEventListener("click", e => {
  const button = e.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  render();
});
els.search.addEventListener("input", e => { state.search = e.target.value; render(); });
els.sort.addEventListener("change", e => { state.sort = e.target.value; render(); });

fetch("/data/products.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error("No se pudo cargar el catálogo");
    return r.json();
  })
  .then(data => {
    state.products = Array.isArray(data) ? data : [];
    render();
  })
  .catch(() => {
    state.products = [];
    els.count.textContent = "No pudimos cargar el catálogo";
    render();
  });
