require("dotenv").config();
const express = require("express");
const webhookRoutes = require("./routes/webhook");

const app = express();

app.use(express.json());
app.use(webhookRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});