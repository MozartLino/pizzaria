const { PIZZA_SIZES, PIZZA_FLAVORS, DRINK_NAMES, PAYMENT_METHODS, MENU } = require("./menu");

const DRINK_SIZES = [...new Set(
  Object.values(MENU.drinks).flatMap(Object.keys)
)];

const PIZZA_MENU_TEXT = PIZZA_FLAVORS.map((flavor) => {
  const { ingredients, prices } = MENU.pizzas[flavor];
  const priceStr = Object.entries(prices)
    .map(([size, price]) => `${size} R$ ${price.toFixed(2).replace(".", ",")}`)
    .join(", ");
  return `  - ${flavor} (${priceStr}): ${ingredients.join(", ")}`;
}).join("\n");

const DRINK_MENU_TEXT = DRINK_NAMES.map((name) => {
  const sizes = Object.entries(MENU.drinks[name])
    .map(([size, price]) => `${size} R$ ${price.toFixed(2).replace(".", ",")}`)
    .join(", ");
  return `  - ${name}: ${sizes}`;
}).join("\n");

function buildSystemPrompt(savedAddress) {
  const deliveryFee = parseFloat(process.env.DELIVERY_FEE) || 0;
  const addressRule = savedAddress
    ? `- o endereço cadastrado é ${JSON.stringify(savedAddress)} — confirme com o cliente se continua o mesmo antes de prosseguir`
    : `- para coletar o endereço, siga a sequência: (1) peça o CEP, (2) o sistema consulta automaticamente o logradouro, (3) peça o número, (4) pergunte se tem complemento`;

  return `
Você é uma atendente de pizzaria no WhatsApp.

Objetivo:
- entender a mensagem do cliente
- atualizar o pedido atual
- responder SOMENTE com JSON válido
- nunca inventar itens fora do cardápio

Cardápio de pizzas (tamanhos: ${PIZZA_SIZES.join(", ")}):
${PIZZA_MENU_TEXT}

Bebidas:
${DRINK_MENU_TEXT}

Formas de pagamento aceitas: ${PAYMENT_METHODS.join(", ")}

Regras:
- nunca invente sabores, bebidas ou tamanhos
- cada pizza tem exatamente um sabor, ou dois sabores no caso de meia a meia
- meia a meia é permitida: o cliente pode pedir dois sabores do cardápio na mesma pizza (ex: "calabresa e mussarela")
- se o cliente pedir uma combinação de ingredientes que não existe como sabor no cardápio (ex: "calabresa com queijo extra"), informe que não temos esse sabor e sugira os sabores disponíveis; não confunda isso com meia a meia
- tamanho padrão de pizza é "grande" e de bebida é "2l" se o cliente não especificar
- o pedido pode ser para entrega (deliveryType "entrega") ou retirada na loja (deliveryType "retirada")
- taxa de entrega: R$ ${deliveryFee.toFixed(2).replace(".", ",")} (cobrada somente quando deliveryType for "entrega")
- se o cliente não especificar entrega ou retirada, aguarde a resposta do sistema via nextQuestion "deliveryType"
- quando nextQuestion for "deliveryType", o sistema já enviou a pergunta — apenas extraia a resposta do cliente em deliveryType
- ${addressRule}
- pergunte a forma de pagamento se não informada
- siga a ordem: sabor → entrega/retirada → endereço (CEP → número → complemento, somente se entrega) → pagamento
- pergunte apenas uma coisa por vez, conforme indicado em "nextQuestion"
- após confirmar os itens do pedido, pergunte naturalmente se o cliente deseja mais alguma coisa antes de pedir o endereço
- quando nextQuestion for "address.cep", o sistema já enviou a mensagem — processe apenas a resposta do cliente extraindo o CEP
- quando nextQuestion for "address.number", o sistema já perguntou número e complemento juntos — extraia o número em address.number e o complemento em address.complement se o cliente informar; se vier em mensagens separadas, acumule o que já está em currentOrder.address
- nunca invente rua, bairro ou cidade — esses campos já estão em currentOrder.address e vêm do sistema
- somente mude o status para "ready_to_confirm" quando houver itens, deliveryType, endereço (se entrega) e pagamento
- somente mude o status para "confirmed" após o cliente confirmar explicitamente
- nunca mencione o total do pedido na mensagem — o sistema injeta isso automaticamente via \${total}
- se o cliente perguntar o preço de um item, informe normalmente com base no cardápio
- ao atingir "ready_to_confirm", escreva a mensagem de confirmação com o placeholder literal \${total} onde o valor deve aparecer (ex: "Pedido confirmado! Total: \${total}. Confirma?")
- use o pedido atual e o histórico recente
- sempre responda em português do Brasil
- seja curta, natural e objetiva
- na saudação inicial, não liste os produtos — apenas cumprimente e pergunte o que o cliente deseja
- não use markdown
- não escreva nada fora do JSON

Formato obrigatório:
{
  "order": {
    "items": [
      {
        "type": "pizza",
        "size": "${PIZZA_SIZES.join("|")}",
        "flavors": []
      },
      {
        "type": "bebida",
        "name": "",
        "size": "${DRINK_SIZES.join("|")}"
      }
    ],
    "address": {
      "cep": "",
      "number": "",
      "complement": ""
    },
    "deliveryType": "entrega|retirada",
    "payment": "${PAYMENT_METHODS.join("|")}"
  },
  "nextQuestion": "items|deliveryType|address.cep|address.number|payment|null",
  "status": "collecting|ready_to_confirm|confirmed|invalid",
  "message": ""
}
`.trim();
}

function buildUserPrompt({ order, messages, customerMessage, nextQuestion }) {
  return JSON.stringify({
    currentOrder: order,
    nextQuestion: nextQuestion || null,
    recentMessages: messages,
    customerMessage
  });
}

function buildConfirmationMessage(order, total) {
  const lines = ["*Resumo do pedido:*\n"];

  const pizzas = order.items.filter((i) => i.type === "pizza");
  const drinks = order.items.filter((i) => i.type === "bebida");

  pizzas.forEach((p) => {
    const flavors = p.flavors.join(" e ");
    lines.push(`🍕 Pizza ${p.size} de ${flavors}`);
  });

  drinks.forEach((d) => {
    lines.push(`🥤 ${d.name} (${d.size})`);
  });

  if (order.deliveryType === "entrega") {
    const addr = order.address;
    lines.push(`\n📍 *Endereço:*`);
    lines.push(`${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""}`);
    lines.push(`${addr.neighborhood} - ${addr.city}/${addr.state}`);
    lines.push(`CEP: ${addr.cep}`);
    const fee = parseFloat(process.env.DELIVERY_FEE) || 0;
    if (fee > 0) lines.push(`🛵 *Taxa de entrega:* R$ ${fee.toFixed(2).replace(".", ",")}`);
  } else {
    lines.push(`\n🏪 *Retirada na loja*`);
  }

  lines.push(`\n💳 *Pagamento:* ${order.payment}`);
  lines.push(`\n💰 *Total: R$ ${total.toFixed(2).replace(".", ",")}*`);
  lines.push("\nConfirma o pedido? (sim/não)");

  return lines.join("\n");
}

function buildSupportMessage(order, total, orderId) {
  const supportNumber = process.env.SUPPORT_WHATSAPP;

  const pizzas = order.items.filter((i) => i.type === "pizza");
  const drinks = order.items.filter((i) => i.type === "bebida");
  const addr = order.address;

  const lines = [`*Pedido #${orderId}*`];
  pizzas.forEach((p) => lines.push(`🍕 Pizza ${p.size} de ${p.flavors.join(" e ")}`));
  drinks.forEach((d) => lines.push(`🥤 ${d.name} (${d.size})`));
  lines.push(`📍 ${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""} - ${addr.neighborhood}, ${addr.city}/${addr.state}`);
  lines.push(`💳 ${order.payment}`);
  lines.push(`💰 Total: R$ ${total.toFixed(2).replace(".", ",")}`);

  const waText = encodeURIComponent(lines.join("\n"));
  const waLink = `https://wa.me/${supportNumber}?text=${waText}`;

  return `Vamos verificar o status do seu pedido! Enquanto isso, você pode falar diretamente com a nossa equipe:\n${waLink}`;
}

function buildOrderSummaryLine(order) {
  const lines = [];
  const pizzas = order.items.filter((i) => i.type === "pizza");
  const drinks = order.items.filter((i) => i.type === "bebida");

  pizzas.forEach((p) => {
    const flavors = p.flavors.length === 2
      ? `meio ${p.flavors[0]} meio ${p.flavors[1]}`
      : p.flavors[0];
    lines.push(`🍕 ${p.size === "broto" ? "Broto" : "Pizza"} ${flavors}`);
  });

  drinks.forEach((d) => {
    lines.push(`🥤 ${d.name} (${d.size})`);
  });

  return lines.join("\n");
}

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
  buildConfirmationMessage,
  buildSupportMessage,
  buildOrderSummaryLine
};