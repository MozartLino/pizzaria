const express = require("express");
const { webhookController } = require("../controllers/webhookController");
const { metaVerify, metaWebhook } = require("../controllers/metaWebhookController");

const router = express.Router();

// Rota interna (testes via Postman/curl)
router.post("/webhook", webhookController);

// Rotas Meta WhatsApp Business
router.get("/meta/webhook", metaVerify);
router.post("/meta/webhook", metaWebhook);

module.exports = router;