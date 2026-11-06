import { ensure } from './errors.js';
export function body(value) {
  ensure(value && typeof value === 'object' && !Array.isArray(value), 400, 'Envie um objeto JSON.');
  return value;
}
export function text(value, field, max = 255, required = true) {
  if (!required && (value === undefined || value === null || value === '')) return null;
  ensure(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, 400, `${field} deve conter entre 1 e ${max} caracteres.`);
  return value.trim();
}
export function id(value, field = 'id') {
  ensure(['number', 'string'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)), 400, `${field} deve ser um inteiro positivo.`);
  return Number(value);
}
export function email(value) {
  const normalized = text(value, 'E-mail', 150).toLowerCase();
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized), 400, 'E-mail inválido.');
  return normalized;
}
export function password(value) {
  ensure(typeof value === 'string' && value.length >= 8 && value.length <= 128, 400, 'A senha deve ter entre 8 e 128 caracteres.');
  return value;
}
export function type(value) {
  if (value === 'pessoal') return 'pessoa';
  if (value === 'empresarial') return 'empresa';
  ensure(['pessoa', 'empresa'].includes(value), 400, 'Tipo de conta deve ser pessoa ou empresa.');
  return value;
}
export function document(value, kind, required = false) {
  if (!required && (value === undefined || value === null || value === '')) return null;
  ensure(typeof value === 'string', 400, `${kind} inválido.`);
  const digits = value.replace(/[.\-/\s]/g, '');
  const length = kind === 'CPF' ? 11 : 14;
  ensure(new RegExp(`^\\d{${length}}$`).test(digits) && !/^(\d)\1+$/.test(digits), 400, `${kind} inválido.`);
  const check = (base, weights) => {
    const sum = [...base].reduce((total, digit, i) => total + Number(digit) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = kind === 'CPF' ? [10,9,8,7,6,5,4,3,2] : [5,4,3,2,9,8,7,6,5,4,3,2];
  const second = kind === 'CPF' ? [11,10,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
  ensure(check(digits.slice(0, -2), first) === Number(digits.at(-2)) && check(digits.slice(0, -1), second) === Number(digits.at(-1)), 400, `${kind} inválido.`);
  return digits;
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function date(value) {
  ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 400, 'Validade deve estar no formato AAAA-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  ensure(!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value, 400, 'Data de validade inválida.');
  ensure(value >= today(), 400, 'Não é possível publicar um alimento vencido.');
  return value;
}
export function food(input, previous = {}) {
  body(input);
  const value = { ...previous, ...input };
  let quantity = value.quantidade;
  let unit = value.unidade;
  if (typeof quantity === 'string') {
    const match = quantity.trim().match(/^(\d+(?:[.,]\d{1,3})?)\s*([\p{L}\s]+)?$/u);
    ensure(match, 400, 'Quantidade inválida. Exemplo: 5 kg.');
    quantity = Number(match[1].replace(',', '.'));
    if (match[2]) unit = match[2].trim();
  }
  ensure(typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= 999999 && Math.abs(quantity * 1000 - Math.round(quantity * 1000)) < 1e-7, 400, 'Quantidade deve ser positiva, até 999999 e com no máximo 3 casas decimais.');
  return {
    nome: text(value.nome, 'Nome', 110),
    tipo: text(input.categoria ?? input.tipo ?? previous.tipo, 'Categoria', 100),
    data_vencimento: date(input.validade ?? input.data_vencimento ?? previous.data_vencimento),
    quantidade: quantity, unidade: text(unit || 'unidades', 'Unidade', 30),
  };
}
export function page(query) {
  const pagina = query.pagina === undefined ? 1 : id(query.pagina, 'pagina');
  const limite = query.limite === undefined ? 20 : id(query.limite, 'limite');
  ensure(limite <= 100 && pagina <= 1000000, 400, 'Limite máximo: 100; página máxima: 1000000.');
  return { pagina, limite, offset: (pagina - 1) * limite };
}
