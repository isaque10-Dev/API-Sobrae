import { con } from './connection.js';
import { ensure } from '../utils/errors.js';
const configs = {
  pessoa: { table: 'conta_pessoal', id: 'id_pessoal', name: 'nome', document: 'cpf' },
  empresa: { table: 'conta_empresarial', id: 'id_empresa', name: 'nome_empresa', document: 'cnpj_empresa' },
};
export function accountConfig(tipo) {
  ensure(Object.hasOwn(configs, tipo), 400, 'Tipo de conta inválido.');
  return configs[tipo];
}
export async function findAccount(tipo, id, db = con, lock = false) {
  const cfg = accountConfig(tipo);
  const [rows] = await db.execute(`SELECT * FROM ${cfg.table} WHERE ${cfg.id} = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0];
}
export function publicAccount(tipo, row) {
  const cfg = accountConfig(tipo);
  return {
    id: row[cfg.id], tipo, nome: row[cfg.name], email: row.email,
    [cfg.id]: row[cfg.id], [cfg.name]: row[cfg.name], [cfg.document]: row[cfg.document],
    num_telefone: row.num_telefone, ativo: Boolean(row.ativo),
    usar_localizacao: Boolean(row.usar_localizacao), distancia_km: row.distancia_km,
  };
}
export async function notify(db, user, mensagem) {
  await db.execute(`INSERT INTO notificacoes (${user.column}, mensagem) VALUES (?, ?)`, [user.id, mensagem]);
}
export function ownerOf(row) {
  return row.id_pessoal ? { id: row.id_pessoal, tipo: 'pessoa', column: 'id_pessoal' } : { id: row.id_empresa, tipo: 'empresa', column: 'id_empresa' };
}
export function isOwner(row, user) { return row[user.column] === user.id; }
