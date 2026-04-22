const axios = require("axios");

const cache = new Map();

async function lookupCep(cep) {
  const clean = String(cep).replace(/\D/g, "");

  if (clean.length !== 8) {
    return null;
  }

  if (cache.has(clean)) {
    return cache.get(clean);
  }

  try {
    const { data } = await axios.get(`https://brasilapi.com.br/api/cep/v1/${clean}`);
    const result = {
      cep: clean,
      street: data.street || "",
      neighborhood: data.neighborhood || "",
      city: data.city || "",
      state: data.state || ""
    };
    cache.set(clean, result);
    return result;
  } catch {
    return null;
  }
}

module.exports = { lookupCep };
