import { config } from "../config.js";

// A permissão pertence ao ID da conta, mesmo que o e-mail seja alterado.
export function isAdmin(tipo, id) {
  return config.adminContas.includes(tipo + ":" + id);
}
