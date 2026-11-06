import { con } from '../repository/connection.js';
import { tokenHash } from '../utils/security.js';
import { ensure } from '../utils/errors.js';
import { accountConfig } from '../repository/contasRepository.js';
export async function authenticate(req, res, next) {
  const match = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/);
  ensure(match, 401, 'Entre na sua conta para continuar.');
  const hash = tokenHash(match[1]);
  const [sessions] = await con.execute('SELECT * FROM sessoes WHERE token_hash = ? AND expira_em > UTC_TIMESTAMP()', [hash]);
  ensure(sessions.length, 401, 'Sessão inválida ou expirada. Entre novamente.');
  const session = sessions[0];
  const tipo = session.id_pessoal ? 'pessoa' : 'empresa';
  const cfg = accountConfig(tipo);
  const accountId = session[cfg.id];
  const [accounts] = await con.execute(`SELECT ${cfg.id} FROM ${cfg.table} WHERE ${cfg.id} = ? AND ativo = 1`, [accountId]);
  ensure(accounts.length, 401, 'Conta indisponível.');
  req.user = { id: accountId, tipo, column: cfg.id, tokenHash: hash };
  next();
}
export function authRateLimit() {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
    const key = req.ip;
    const entry = clients.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    clients.set(key, entry);
    if (++entry.count > 30) {
      res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    }
    next();
  };
}
