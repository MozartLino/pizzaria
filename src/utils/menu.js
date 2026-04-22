const MENU = {
  pizzas: {
    // TRADICIONAIS
    "calabresa": {
      ingredients: ["linguiça calabresa", "mussarela", "cebola", "azeitona"],
      prices: { broto: 39.9, grande: 69.9 }
    },
    "mussarela": {
      ingredients: ["mussarela", "tomate", "orégano"],
      prices: { broto: 37.9, grande: 67.9 }
    },
    "portuguesa": {
      ingredients: ["mussarela", "presunto", "ovo", "cebola", "azeitona", "pimentão"],
      prices: { broto: 42.9, grande: 72.9 }
    },
    "frango com catupiry": {
      ingredients: ["frango desfiado", "catupiry", "milho"],
      prices: { broto: 44.9, grande: 74.9 }
    },
    "quatro queijos": {
      ingredients: ["mussarela", "provolone", "parmesão", "catupiry"],
      prices: { broto: 46.9, grande: 76.9 }
    },
    "bacon": {
      ingredients: ["bacon", "mussarela", "cebola"],
      prices: { broto: 45.9, grande: 75.9 }
    },
    "atum": {
      ingredients: ["atum", "mussarela", "cebola", "azeitona"],
      prices: { broto: 43.9, grande: 73.9 }
    },

    // ESPECIAIS
    "carne seca": {
      ingredients: ["carne seca", "catupiry", "cebola caramelizada"],
      prices: { broto: 49.9, grande: 79.9 }
    },
    "costela": {
      ingredients: ["costela bovina desfiada", "mussarela", "cebola"],
      prices: { broto: 52.9, grande: 82.9 }
    },
    "filé mignon": {
      ingredients: ["filé mignon", "mussarela", "cebola caramelizada", "catupiry"],
      prices: { broto: 54.9, grande: 85.9 }
    },

    // DOCES
    "brigadeiro": {
      ingredients: ["chocolate ao leite", "granulado"],
      prices: { broto: 39.9, grande: 59.9 }
    },
    "banana com canela": {
      ingredients: ["banana", "canela", "açúcar"],
      prices: { broto: 37.9 }
    },
    "banana nevada": {
      ingredients: ["banana", "leite condensado", "coco ralado"],
      prices: { grande: 57.9 }
    },
    "chocolate com morango": {
      ingredients: ["chocolate ao leite", "morango"],
      prices: { broto: 42.9, grande: 62.9 }
    }
  },

  drinks: {
    "coca-cola": { lata: 5.5,  "600ml": 8.0,  "2l": 13.9 },
    "guaraná":   { lata: 5.0,  "600ml": 7.5,  "2l": 12.5 }
  }
};

const PIZZA_SIZES      = ["broto", "grande"];
const PIZZA_FLAVORS    = Object.keys(MENU.pizzas);
const DRINK_NAMES      = Object.keys(MENU.drinks);
const PAYMENT_METHODS  = ["dinheiro", "pix", "cartão (crédito/débito)"];

function calculateTotal(order) {
  let total = 0;

  for (const item of order.items || []) {
    if (item.type === "pizza" && item.size && item.flavors?.length) {
      const prices = item.flavors
        .map((f) => MENU.pizzas[f]?.prices?.[item.size])
        .filter(Boolean);
      if (prices.length) total += Math.max(...prices);
    }

    if (item.type === "bebida" && item.name && item.size) {
      total += MENU.drinks[item.name]?.[item.size] || 0;
    }
  }

  if (order.deliveryType === "entrega") {
    total += parseFloat(process.env.DELIVERY_FEE) || 0;
  }

  return Math.round(total * 100) / 100;
}

module.exports = { MENU, PIZZA_SIZES, PIZZA_FLAVORS, DRINK_NAMES, PAYMENT_METHODS, calculateTotal };
