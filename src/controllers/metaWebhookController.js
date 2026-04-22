const { getSession, saveSession, resetSession } = require("../services/sessionStore");
const { getUserData, saveUserData } = require("../services/userStore");
const { generateOrderResponse } = require("../services/openaiService");
const { applyAiResponse } = require("../services/orderService");
const { lookupCep } = require("../services/cepService");
const { computeNextQuestion, detectEscalation } = require("../utils/validator");
const { buildConfirmationMessage, buildSupportMessage, buildOrderSummaryLine } = require("../utils/promptBuilder");
const { sendMessage } = require("../services/metaService");

// GET /meta/webhook — verificação do webhook pela Meta
function metaVerify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

// POST /meta/webhook — mensagens recebidas
async function metaWebhook(req, res) {
  // Responde 200 imediatamente para a Meta não reenviar
  res.sendStatus(200);

  console.log("[meta] payload recebido:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value?.statuses) return; // ignora notificações de status (entregue, lido, etc)

    const incoming = value?.messages?.[0];
    if (!incoming) return;

    const userId = incoming.from; // número do cliente no formato 5511999999999
    const messageText = incoming.text?.body;

    if (!messageText) return; // ignora áudio, imagem, etc.

    const responseText = await processMessage(userId, messageText);

    await sendMessage(userId, responseText);
  } catch (error) {
    console.error("metaWebhook error:", error.message);
  }
}

async function processMessage(userId, message) {
  const session = getSession(userId);
  const userData = getUserData(userId);

  const SESSION_TTL_MS = (Number(process.env.SESSION_TTL_MINUTES) || 120) * 60 * 1000;

  if (session.confirmedAt && Date.now() - session.confirmedAt > SESSION_TTL_MS) {
    resetSession(userId);
    return "Olá! Pronto para um novo pedido. O que vai querer?";
  }

  if (session.status === "confirmed") {
    return buildSupportMessage(session.order, session.total, session.orderId);
  }

  // Detecta frustração antes de chamar a IA
  if (detectEscalation(message, session)) {
    session.status = "confirmed"; // trava a sessão para não processar mais pedidos
    session.confirmedAt = session.confirmedAt || Date.now();
    session.orderId = session.orderId || `suporte-${Date.now()}-${userId}`;
    saveSession(userId, session);
    return buildSupportMessage(session.order, session.total, session.orderId);
  }

  if (!session.order.address && userData.address) {
    session.order.address = userData.address;
  }

  session.messages.push({ role: "user", content: message });

  const aiResponse = await generateOrderResponse({
    order: session.order,
    messages: session.messages.slice(-8),
    customerMessage: message,
    savedAddress: userData.address || null,
    nextQuestion: session.nextQuestion || null
  });

  let updated = applyAiResponse(session.order, aiResponse);

  const hasCep = updated.order.address?.cep;
  const needsLookup = hasCep && !updated.order.address?.street;
  if (needsLookup) {
    const cepData = await lookupCep(updated.order.address.cep);
    if (cepData) {
      updated.order.address = { ...updated.order.address, ...cepData };
      updated.nextQuestion = computeNextQuestion(updated.order);
      if (updated.nextQuestion === null && updated.status === "collecting") {
        updated.status = "ready_to_confirm";
      }
      aiResponse.message = `Endereço encontrado: ${cepData.street}, ${cepData.neighborhood} - ${cepData.city}/${cepData.state}. Qual o número?`;
    } else {
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
  session.messages.push({ role: "assistant", content: aiResponse.message || "" });

  saveSession(userId, session);

  const addr = session.order.address;
  if (addr?.cep && addr?.street && addr?.number) {
    saveUserData(userId, { address: addr });
  }

  if (updated.status === "confirmed" && !session.confirmedAt) {
    session.confirmedAt = Date.now();
    session.orderId = `${Date.now()}-${userId}`;
    saveSession(userId, session);
  }

  if (session.status === "ready_to_confirm") {
    return buildConfirmationMessage(session.order, session.total);
  } else if (session.nextQuestion === "more_items") {
    session.order.moreItemsAsked = true;
    saveSession(userId, session);
    const summary = buildOrderSummaryLine(session.order);
    return `${summary}\n\nDeseja mais alguma coisa?`;
  } else if (session.nextQuestion === "deliveryType") {
    return "O pedido é para entrega ou retirada na loja?";
  } else if (session.nextQuestion === "address.number") {
    return `Qual o número do endereço em ${session.order.address?.street || ""}? Tem complemento? (apto, bloco, etc.)`;
  } else if (session.nextQuestion === "address.cep") {
    return "Qual o seu CEP?";
  } else {
    const totalFormatted = `R$ ${session.total.toFixed(2).replace(".", ",")}`;
    return (aiResponse.message || "Certo!").replace("${total}", totalFormatted);
  }
}

module.exports = { metaVerify, metaWebhook };
