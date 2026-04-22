const { getSession, saveSession, resetSession } = require("../services/sessionStore");
const { getUserData, saveUserData } = require("../services/userStore");
const { generateOrderResponse } = require("../services/openaiService");
const { applyAiResponse } = require("../services/orderService");
const { lookupCep } = require("../services/cepService");
const { computeNextQuestion, detectEscalation } = require("../utils/validator");
const { buildConfirmationMessage, buildSupportMessage, buildOrderSummaryLine } = require("../utils/promptBuilder");

async function webhookController(req, res) {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        error: "userId e message são obrigatórios"
      });
    }

    const session = getSession(userId);
    const userData = getUserData(userId);

    const SESSION_TTL_MS = (Number(process.env.SESSION_TTL_MINUTES) || 120) * 60 * 1000;

    // Sessão expirada após 2h da confirmação — reinicia
    if (session.confirmedAt && Date.now() - session.confirmedAt > SESSION_TTL_MS) {
      resetSession(userId);
      return res.json({ status: "collecting", message: "Olá! Pronto para um novo pedido. O que vai querer?" });
    }

    // Pedido já confirmado e dentro das 2h — redireciona para suporte
    if (session.status === "confirmed") {
      const supportMsg = buildSupportMessage(session.order, session.total, session.orderId);
      return res.json({ status: "confirmed", message: supportMsg });
    }

    // Detecta frustração antes de chamar a IA
    if (detectEscalation(message, session)) {
      session.status = "confirmed";
      session.confirmedAt = session.confirmedAt || Date.now();
      session.orderId = session.orderId || `suporte-${Date.now()}-${userId}`;
      saveSession(userId, session);
      const supportMsg = buildSupportMessage(session.order, session.total, session.orderId);
      return res.json({ status: "confirmed", message: supportMsg });
    }

    // Pré-preenche o endereço salvo se o pedido ainda não tem endereço
    if (!session.order.address && userData.address) {
      session.order.address = userData.address;
    }

    session.messages.push({
      role: "user",
      content: message
    });

    const aiResponse = await generateOrderResponse({
      order: session.order,
      messages: session.messages.slice(-8),
      customerMessage: message,
      savedAddress: userData.address || null,
      nextQuestion: session.nextQuestion || null
    });

    let updated = applyAiResponse(session.order, aiResponse);

    // Se a IA acabou de informar um CEP e ainda não temos o logradouro,
    // consulta a BrasilAPI e injeta os dados no pedido.
    const hasCep = updated.order.address?.cep;
    const needsLookup = hasCep && !updated.order.address?.street;
    if (needsLookup) {
      const cepData = await lookupCep(updated.order.address.cep);
      if (cepData) {
        updated.order.address = { ...updated.order.address, ...cepData };
        updated.nextQuestion = computeNextQuestion(updated.order);
        // Recalcula status após enriquecimento do endereço
        if (updated.nextQuestion === null && updated.status === "collecting") {
          updated.status = "ready_to_confirm";
        }
        // Sobrescreve a mensagem da IA com dado real do backend
        aiResponse.message = `Endereço encontrado: ${cepData.street}, ${cepData.neighborhood} - ${cepData.city}/${cepData.state}. Qual o número?`;
      } else {
        // CEP inválido — limpa e força nova pergunta
        updated.order.address = null;
        updated.nextQuestion = "address.cep";
        updated.status = "collecting";
      }
    }

    // Atualiza contadores de frustração
    if (updated.validationErrors?.length > 0) {
      session.invalidCount = (session.invalidCount || 0) + 1;
    } else {
      session.invalidCount = 0;
    }

    if (updated.nextQuestion && updated.nextQuestion === session.nextQuestion) {
      session.stuckCount = (session.stuckCount || 0) + 1;
    } else {
      session.stuckCount = 0;
    }

    session.order = updated.order;
    session.nextQuestion = updated.nextQuestion;
    session.status = updated.status;
    session.total = updated.total;
    session.messages.push({
      role: "assistant",
      content: aiResponse.message || ""
    });

    saveSession(userId, session);

    // Persiste o endereço assim que estiver completo (cep + street + number)
    const addr = session.order.address;
    if (addr?.cep && addr?.street && addr?.number) {
      saveUserData(userId, { address: addr });
    }

    // Registra momento da confirmação e gera orderId
    if (updated.status === "confirmed" && !session.confirmedAt) {
      session.confirmedAt = Date.now();
      session.orderId = `${Date.now()}-${userId}`;
    }

    let responseMessage;
    if (session.status === "ready_to_confirm") {
      responseMessage = buildConfirmationMessage(session.order, session.total);
    } else if (session.nextQuestion === "more_items") {
      session.order.moreItemsAsked = true;
      saveSession(userId, session);
      const summary = buildOrderSummaryLine(session.order);
      responseMessage = `${summary}\n\nDeseja mais alguma coisa?`;
    } else if (session.nextQuestion === "deliveryType") {
      responseMessage = "O pedido é para entrega ou retirada na loja?";
    } else if (session.nextQuestion === "address.number") {
      const street = session.order.address?.street || "";
      responseMessage = `Qual o número do endereço em ${street}? Tem complemento? (apto, bloco, etc.)`;
    } else if (session.nextQuestion === "address.cep") {
      responseMessage = "Qual o seu CEP?";
    } else {
      const totalFormatted = `R$ ${session.total.toFixed(2).replace(".", ",")}`;
      responseMessage = (aiResponse.message || "Certo!").replace("${total}", totalFormatted);
    }

    return res.json({
      order: session.order,
      nextQuestion: session.nextQuestion,
      status: session.status,
      total: session.total,
      message: responseMessage,
      validationErrors: updated.validationErrors
    });
  } catch (error) {
    console.error("webhookController error:", error.message);

    return res.status(500).json({
      error: "Erro interno no processamento do pedido"
    });
  }
}

module.exports = {
  webhookController
};