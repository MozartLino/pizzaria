const { PIZZA_SIZES } = require("./menu");

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const FLAVOR_ALIASES = {
  // calabresa
  "calabresa": "calabresa",
  "calabreza": "calabresa",
  "calabressa": "calabresa",
  "calabreza": "calabresa",
  "calaresa": "calabresa",
  "calabreca": "calabresa",

  // mussarela
  "mussarela": "mussarela",
  "musarela": "mussarela",
  "muzarela": "mussarela",
  "mucarela": "mussarela",
  "mozzarela": "mussarela",
  "mussarella": "mussarela",
  "mozarela": "mussarela",
  "mozarella": "mussarela",
  "muzzarela": "mussarela",

  // portuguesa
  "portuguesa": "portuguesa",
  "portugesa": "portuguesa",
  "portugessa": "portuguesa",

  // frango com catupiry
  "frango com catupiry": "frango com catupiry",
  "frango catupiry": "frango com catupiry",
  "frango": "frango com catupiry",
  "frango c/ catupiry": "frango com catupiry",
  "frango com catupiri": "frango com catupiry",
  "frango catupiri": "frango com catupiry",

  // quatro queijos
  "quatro queijos": "quatro queijos",
  "4 queijos": "quatro queijos",
  "4queijos": "quatro queijos",
  "quatro queijo": "quatro queijos",

  // bacon
  "bacon": "bacon",
  "baicon": "bacon",

  // atum
  "atum": "atum",

  // carne seca
  "carne seca": "carne seca",
  "carneseca": "carne seca",

  // costela
  "costela": "costela",
  "costella": "costela",

  // filé mignon
  "file mignon": "filé mignon",
  "filé mignon": "filé mignon",
  "file minhon": "filé mignon",
  "file minion": "filé mignon",
  "filé": "filé mignon",
  "file": "filé mignon",

  // brigadeiro
  "brigadeiro": "brigadeiro",
  "brigadero": "brigadeiro",

  // banana com canela
  "banana com canela": "banana com canela",
  "banana canela": "banana com canela",
  "banana c/ canela": "banana com canela",

  // banana nevada
  "banana nevada": "banana nevada",
  "banana": "banana nevada",

  // chocolate com morango
  "chocolate com morango": "chocolate com morango",
  "choco morango": "chocolate com morango",
  "chocolate morango": "chocolate com morango",
  "choco com morango": "chocolate com morango"
};

const DELIVERY_ALIASES = {
  "entrega": "entrega",
  "delivery": "entrega",
  "entregar": "entrega",
  "retirada": "retirada",
  "retirar": "retirada",
  "buscar": "retirada",
  "busco": "retirada",
  "vou buscar": "retirada",
  "vou retirar": "retirada",
  "no local": "retirada",
  "loja": "retirada"
};

const DRINK_ALIASES = {
  coca: "coca-cola",
  "coca cola": "coca-cola",
  "coca-cola": "coca-cola",
  guarana: "guaraná",
  "guaraná": "guaraná"
};

function normalizeFlavor(name) {
  const key = normalizeText(name);
  // Retorna o alias canônico ou o texto normalizado — nunca null.
  // Sabores desconhecidos passam adiante e são rejeitados pelo validator.
  return FLAVOR_ALIASES[key] || key;
}

function normalizeDrink(name) {
  const key = normalizeText(name);
  return DRINK_ALIASES[key] || null;
}

function normalizeSize(size) {
  const value = String(size || "").toLowerCase().trim();
  return PIZZA_SIZES.includes(value) ? value : null;
}

function normalizeOrder(order) {
  if (!order || !Array.isArray(order.items)) {
    return { items: [] };
  }

  const items = order.items
    .map((item) => {
      if (!item || !item.type) return null;

      if (item.type === "pizza") {
        return {
          type: "pizza",
          size: normalizeSize(item.size) || "grande",
          flavors: Array.isArray(item.flavors)
            ? item.flavors.map(normalizeFlavor).filter(Boolean)
            : []
        };
      }

      if (item.type === "bebida") {
        const drink = normalizeDrink(item.name);
        if (!drink) return null;

        return {
          type: "bebida",
          name: drink,
          size: item.size ? String(item.size).toLowerCase().trim() : "2l"
        };
      }

      return null;
    })
    .filter(Boolean);

  const PAYMENT_ALIASES = {
    "dinheiro": "dinheiro",
    "pix": "pix",
    "cartao": "cartão (crédito/débito)",
    "cartão": "cartão (crédito/débito)",
    "credito": "cartão (crédito/débito)",
    "crédito": "cartão (crédito/débito)",
    "debito": "cartão (crédito/débito)",
    "débito": "cartão (crédito/débito)",
    "cartao de credito": "cartão (crédito/débito)",
    "cartão de crédito": "cartão (crédito/débito)",
    "cartao de debito": "cartão (crédito/débito)",
    "cartão de débito": "cartão (crédito/débito)",
    "cartão (crédito/débito)": "cartão (crédito/débito)"
  };

  const payment = order.payment
    ? PAYMENT_ALIASES[normalizeText(order.payment)] || PAYMENT_ALIASES[order.payment] || null
    : null;

  let address = null;
  if (order.address && typeof order.address === "object") {
    address = {
      // campos vindos da IA
      cep: order.address.cep ? String(order.address.cep).replace(/\D/g, "") : null,
      number: order.address.number ? String(order.address.number).trim() : null,
      complement: order.address.complement ? String(order.address.complement).trim() : null,
      // campos do lookup — preserva se já estiverem presentes
      street: order.address.street || null,
      neighborhood: order.address.neighborhood || null,
      city: order.address.city || null,
      state: order.address.state || null
    };
  }

  const deliveryType = order.deliveryType
    ? DELIVERY_ALIASES[normalizeText(order.deliveryType)] || null
    : null;

  return {
    items,
    ...(deliveryType ? { deliveryType } : {}),
    ...(address ? { address } : {}),
    ...(payment ? { payment } : {})
  };
}

module.exports = {
  normalizeText,
  normalizeFlavor,
  normalizeDrink,
  normalizeSize,
  normalizeOrder
};