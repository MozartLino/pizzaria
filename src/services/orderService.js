const { normalizeOrder } = require("../utils/normalize");
const { computeNextQuestion, validateOrder } = require("../utils/validator");
const { calculateTotal } = require("../utils/menu");

function applyAiResponse(currentOrder, aiResponse) {
  const parsedOrder = normalizeOrder(aiResponse.order || { items: [] });

  // A IA devolve o estado completo do pedido a cada turno.
  // Substituímos diretamente — sem acumular em cima da sessão.
  // Mesclamos address: campos do lookup (street/city/etc.) só existem na sessão,
  // campos da IA (cep/number/complement) vêm do parsedOrder.
  // Flags de controle de fluxo setadas pelo backend — nunca pela IA
  if (currentOrder?.moreItemsAsked) parsedOrder.moreItemsAsked = true;
  // Preserva deliveryType se a IA não retornou
  if (!parsedOrder.deliveryType && currentOrder?.deliveryType) {
    parsedOrder.deliveryType = currentOrder.deliveryType;
  }

  if (currentOrder?.address) {
    // Mescla: campos da IA só sobrescrevem se tiverem valor — nunca apaga com null
    const aiAddress = parsedOrder.address || {};
    parsedOrder.address = { ...currentOrder.address };
    for (const [key, val] of Object.entries(aiAddress)) {
      if (val !== null && val !== "") {
        parsedOrder.address[key] = val;
      }
    }
  }

  const validation = validateOrder(parsedOrder);
  const nextQuestion = computeNextQuestion(parsedOrder);

  let status = aiResponse.status || "collecting";

  if (!validation.valid) {
    status = "invalid";
  } else if (nextQuestion !== null) {
    // Pedido incompleto — IA não pode avançar o status além de collecting
    status = "collecting";
  } else if (nextQuestion === null && status === "collecting") {
    status = "ready_to_confirm";
  }

  return {
    order: parsedOrder,
    nextQuestion,
    status,
    total: calculateTotal(parsedOrder),
    validationErrors: validation.errors
  };
}

module.exports = {
  applyAiResponse
};