const config = window.GARAGE_CONFIG || {};
const state = {
  products: [],
  category: "Todo",
  type: "Todo",
  brand: "Todo",
  size: "Todo",
  condition: "Todo",
  color: "Todo",
  search: "",
  sort: "order"
};

const els = {
  grid: document.querySelector("#grid"),
  empty: document.querySelector("#empty"),
  categories: document.querySelector("#categories"),
  search: document.querySelector("#search"),
  sort: document.querySelector("#sort"),
  type: document.querySelector("#typeFilter"),
  brand: document.querySelector("#brandFilter"),
  size: document.querySelector("#sizeFilter"),
  condition: document.querySelector("#conditionFilter"),
  color: document.querySelector("#colorFilter"),
  clear: document.querySelector("#clearFilters"),
  filterToggle: document.querySelector("#filterToggle"),
  filterPanel: document.querySelector("#filterPanel"),
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
  if (product.price === null || product.price === undefined || product.price === "") return "Consultar";
  const value = Number(product.price);
  return Number.isNaN(value) ? "Consultar" : money(value, product.currency || config.currency);
};

const productImage = (product) =>
  product.image || (product.id ? `/products/${product.id}.webp` : "");

function whatsappUrl(product) {
  if (!config.whatsappNumber) return "";
  const message = `Hola! Me interesa ${product.name} (${product.id}) de la venta de garage. ¿Sigue disponible? Quisiera coordinar para comprarlo.`;
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function uniqueValues(key) {
  return [...new Set(
    state.products
      .filter(p => p.publish !== false && p.availability !== "Vendido")
      .map(p => p[key])
      .filter(Boolean)
  )].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
}

function setOptions(select, label, values) {
  select.innerHTML = [
    `<option value="Todo">${label}</option>`,
    ...values.map(value => `<option value="${value}">${value}</option>`)
  ].join("");
}

function renderFilterOptions() {
  setOptions(els.type, "Tipo", uniqueValues("type"));
  setOptions(els.brand, "Marca", uniqueValues("brand"));
  setOptions(els.size, "Talle", uniqueValues("size"));
  setOptions(els.condition, "Estado", uniqueValues("condition"));
  setOptions(els.color, "Color", uniqueValues("color"));
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
  if (state.type !== "Todo") items = items.filter(p => p.type === state.type);
  if (state.brand !== "Todo") items = items.filter(p => p.brand === state.brand);
  if (state.size !== "Todo") items = items.filter(p => p.size === state.size);
  if (state.condition !== "Todo") items = items.filter(p => p.condition === state.condition);
  if (state.color !== "Todo") items = items.filter(p => p.color === state.color);

  if (state.search) {
    const q = normalize(state.search);
    items = items.filter(p => normalize([
      p.name, p.category, p.type, p.brand, p.size, p.color, p.condition, p.description
    ].filter(Boolean).join(" ")).includes(q));
  }

  items.sort((a, b) => {
    if (state.sort === "price-asc") return Number(a.price ?? Infinity) - Number(b.price ?? Infinity);
    if (state.sort === "price-desc") return Number(b.price ?? -Infinity) - Number(a.price ?? -Infinity);
    if (state.sort === "name") return String(a.name).localeCompare(String(b.name), "es");
    return Number(a.order || 9999) - Number(b.order || 9999);
  });

  return items;
}

function card(product) {
  const href = whatsappUrl(product);
  const attrs = [
    product.brand ? { value: product.brand, className: "" } : null,
    product.size ? { value: `Talle ${product.size}`, className: "" } : null,
    product.color ? { value: product.color, className: "" } : null,
    product.condition ? { value: product.condition, className: "condition" } : null,
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
      <div class="attrs">${attrs.map(a => `<span class="attr ${a.className}">${a.value}</span>`).join("")}</div>
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

function hasActiveFilters() {
  return ["category", "type", "brand", "size", "condition", "color"]
    .some(key => state[key] !== "Todo") || Boolean(state.search);
}

function render() {
  const items = visibleProducts();
  els.count.textContent = `${items.length} ${items.length === 1 ? "producto" : "productos"}`;
  els.grid.innerHTML = items.map(card).join("");
  els.empty.hidden = items.length !== 0;
  els.clear.disabled = !hasActiveFilters();
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

[
  ["type", els.type],
  ["brand", els.brand],
  ["size", els.size],
  ["condition", els.condition],
  ["color", els.color],
].forEach(([key, select]) => {
  select.addEventListener("change", e => {
    state[key] = e.target.value;
    render();
  });
});

els.filterToggle.addEventListener("click", () => {
  const willOpen = els.filterPanel.hidden;
  els.filterPanel.hidden = !willOpen;
  els.filterToggle.setAttribute("aria-expanded", String(willOpen));
  els.filterToggle.textContent = willOpen ? "Ocultar filtros" : "Mostrar filtros";
});

els.clear.addEventListener("click", () => {
  state.category = "Todo";
  state.type = "Todo";
  state.brand = "Todo";
  state.size = "Todo";
  state.condition = "Todo";
  state.color = "Todo";
  state.search = "";

  els.search.value = "";
  [els.type, els.brand, els.size, els.condition, els.color].forEach(select => {
    select.value = "Todo";
  });
  render();
});

fetch("/data/products.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error("No se pudo cargar el catálogo");
    return r.json();
  })
  .then(data => {
    state.products = Array.isArray(data) ? data : [];
    renderFilterOptions();
    render();
  })
  .catch(() => {
    state.products = [];
    els.count.textContent = "No pudimos cargar el catálogo";
    render();
  });
