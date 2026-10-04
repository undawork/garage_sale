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
  }).format(Number(value || 0));

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
    if (state.sort === "price-asc") return Number(a.price||0) - Number(b.price||0);
    if (state.sort === "price-desc") return Number(b.price||0) - Number(a.price||0);
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

  return `<article class="card">
    <div class="image-wrap">
      ${product.image ? `<img src="${product.image}" alt="${product.name}" loading="lazy">` : ""}
      ${product.availability === "Reservado" ? '<span class="badge">Reservado</span>' : ""}
    </div>
    <div class="card-body">
      <div class="meta">${[product.category, product.type].filter(Boolean).join(" · ")}</div>
      <h2>${product.name}</h2>
      <div class="attrs">${attrs.map(a => `<span class="attr">${a}</span>`).join("")}</div>
      <div class="bottom">
        <div class="price">${money(product.price, product.currency || config.currency)}</div>
        <a class="cta ${href ? "" : "disabled"}" href="${href || "#"}" target="_blank" rel="noopener">Me interesa</a>
      </div>
    </div>
  </article>`;
}

function render() {
  const items = visibleProducts();
  els.count.textContent = `${items.length} ${items.length === 1 ? "producto" : "productos"}`;
  els.grid.innerHTML = items.map(card).join("");
  els.empty.hidden = items.length !== 0;
  renderCategories();
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
