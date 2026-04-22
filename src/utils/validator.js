const { MENU, PIZZA_SIZES, PIZZA_FLAVORS, DRINK_NAMES, PAYMENT_METHODS } = require("./menu");

function validateOrder(order) {
  const errors = [];

  if (!order || !Array.isArray(order.items)) {
    return {
      valid: false,
      errors: ["order.items ausente ou inválido"]
    };
  }

  for (const item of order.items) {
    if (!item || !item.type) {
      errors.push("Item inválido");
      continue;
    }

    if (!["pizza", "bebida"].includes(item.type)) {
      errors.push(`Tipo inválido: ${item.type}`);
      continue;
    }

    if (item.type === "pizza") {
      if (item.size && !PIZZA_SIZES.includes(item.size)) {
        errors.push(`Tamanho inválido: ${item.size}`);
      }

      if (item.flavors && !Array.isArray(item.flavors)) {
        errors.push("flavors deve ser array");
      }

      if (Array.isArray(item.flavors)) {
        for (const flavor of item.flavors) {
          if (!PIZZA_FLAVORS.includes(flavor)) {
            errors.push(`Sabor inválido: ${flavor}`);
          }
        }
      }
    }

    if (item.type === "bebida") {
      if (!item.name || !DRINK_NAMES.includes(item.name)) {
        errors.push(`Bebida inválida: ${item.name}`);
      } else if (item.size && !Object.keys(MENU.drinks[item.name]).includes(item.size)) {
        errors.push(`Tamanho inválido para bebida: ${item.size}`);
      }
    }
  }

  if (order.payment && !PAYMENT_METHODS.includes(order.payment)) {
    errors.push(`Forma de pagamento inválida: ${order.payment}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Retorna o próximo campo a perguntar, em ordem de prioridade.
// null = pedido completo.
function computeNextQuestion(order) {
  if (!order?.items?.length) return "items";

  const pizzas = order.items.filter((i) => i.type === "pizza");
  for (let i = 0; i < pizzas.length; i++) {
    if (!pizzas[i].flavors || pizzas[i].flavors.length === 0) {
      return `items[${i}].flavors`;
    }
  }

  if (!order.moreItemsAsked) return "more_items";
  if (!order.deliveryType) return "deliveryType";
  if (order.deliveryType === "entrega") {
    if (!order.address?.cep) return "address.cep";
    if (!order.address?.street) return "address.cep"; // CEP ainda não foi consultado
    if (!order.address?.number) return "address.number";
  }
  if (!order.payment) return "payment";

  return null;
}

const FRUSTRATION_KEYWORDS = [
  "atendente", "humano", "pessoa", "falar com alguem", "falar com alguém",
  "nao consigo", "não consigo", "nao entende", "não entende",
  "socorro", "ajuda", "help", "erro", "problema", "travou", "bugou",
  "cancelar", "desistir", "esquece", "esquece"
];

// Retorna true se deve escalar para suporte humano
function detectEscalation(message, session) {
  const normalized = String(message).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (FRUSTRATION_KEYWORDS.some((k) => normalized.includes(k))) return true;
  if (session.stuckCount >= 3) return true;
  if (session.invalidCount >= 3) return true;

  return false;
}

module.exports = {
  validateOrder,
  computeNextQuestion,
  detectEscalation
};