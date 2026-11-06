import { con } from './connection.js';
import { today, page, text } from '../utils/validation.js';
import { ensure } from '../utils/errors.js';

export const donationSelect = `SELECT d.*, a.nome, a.tipo AS categoria, a.tipo,
  a.data_vencimento, a.data_vencimento AS validade, a.quantidade, a.unidade,
  COALESCE(p.nome, e.nome_empresa) AS doador,
  CASE WHEN d.status IN ('disponivel', 'reservado') AND a.data_vencimento < ? THEN 'expirado' ELSE d.status END AS situacao
  FROM doacoes d JOIN alimentos a ON a.id_alimento = d.id_alimento
  LEFT JOIN conta_pessoal p ON p.id_pessoal = d.id_pessoal
  LEFT JOIN conta_empresarial e ON e.id_empresa = d.id_empresa`;

export async function getDonation(id, db = con) {
  const [rows] = await db.execute(`${donationSelect} WHERE d.id_doacao = ?`, [today(), id]);
  return rows[0];
}

export async function listDonations(query, user) {
  const pagination = page(query);
  const conditions = [];
  const args = [today()];
  if (user) { conditions.push(`d.${user.column} = ?`); args.push(user.id); }
  else {
    conditions.push("d.status = 'disponivel' AND a.data_vencimento >= ? AND (p.ativo = 1 OR e.ativo = 1)"); args.push(today());
  }
  if (query.categoria && query.categoria !== 'Todos') { conditions.push('a.tipo = ?'); args.push(text(query.categoria, 'Categoria', 100)); }
  if (query.busca) {
    conditions.push('(a.nome LIKE ? OR p.nome LIKE ? OR e.nome_empresa LIKE ?)');
    const term = `%${text(query.busca, 'Busca', 100)}%`; args.push(term, term, term);
  }
  if (query.status) {
    ensure(user, 400, 'O catálogo público mostra somente doações disponíveis.');
    ensure(['disponivel', 'reservado', 'concluido', 'cancelado'].includes(query.status), 400, 'Status inválido.');
    conditions.push('d.status = ?'); args.push(query.status);
  }
  const [rows] = await con.query(`${donationSelect} WHERE ${conditions.join(' AND ')} ORDER BY d.id_doacao DESC LIMIT ? OFFSET ?`, [...args, pagination.limite, pagination.offset]);
  return rows;
}

export async function lockDonation(db, id) {
  // Todas as mudanças de reservas travam primeiro a doação, evitando dupla aprovação.
  const [rows] = await db.execute('SELECT * FROM doacoes WHERE id_doacao = ? FOR UPDATE', [id]);
  ensure(rows[0], 404, 'Doação não encontrada.');
  return rows[0];
}
