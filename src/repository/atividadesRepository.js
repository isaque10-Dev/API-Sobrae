import { con } from './connection.js';
import { page, today } from '../utils/validation.js';

export async function statistics(user) {
  const [donations] = await con.execute(`SELECT COUNT(*) AS publicadas,
    COALESCE(SUM(d.status = 'disponivel' AND a.data_vencimento >= ?), 0) AS disponiveis,
    COALESCE(SUM(d.status = 'reservado' AND a.data_vencimento >= ?), 0) AS reservadas,
    COALESCE(SUM(d.status = 'concluido'), 0) AS doacao_total,
    COALESCE(SUM(CASE WHEN d.status = 'concluido' AND LOWER(a.unidade) IN ('kg', 'quilo', 'quilos') THEN a.quantidade
      WHEN d.status = 'concluido' AND LOWER(a.unidade) IN ('g', 'grama', 'gramas') THEN a.quantidade / 1000 ELSE 0 END), 0) AS impacto_kg
    FROM doacoes d JOIN alimentos a ON a.id_alimento = d.id_alimento WHERE d.${user.column} = ?`, [today(), today(), user.id]);
  const [requests] = await con.execute(`SELECT COUNT(*) AS solicitacoes,
    COALESCE(SUM(status = 'pendente'), 0) AS pendentes,
    COALESCE(SUM(status = 'aprovada'), 0) AS aprovadas,
    COALESCE(SUM(status = 'concluida'), 0) AS total_arrecadado
    FROM solicitacoes WHERE ${user.column} = ?`, [user.id]);
  return { ...donations[0], ...requests[0], ativo: true };
}

export async function history(user, query) {
  const { limite, offset } = page(query);
  const [rows] = await con.query(`SELECT 'doacao' AS atividade, d.id_doacao AS id, d.status, d.data_doacao AS data,
      a.nome, a.quantidade, a.unidade FROM doacoes d JOIN alimentos a ON a.id_alimento = d.id_alimento
      WHERE d.${user.column} = ?
    UNION ALL
    SELECT 'solicitacao' AS atividade, s.id_solicitacao AS id, s.status, s.data_solicitacao AS data,
      a.nome, a.quantidade, a.unidade FROM solicitacoes s JOIN doacoes d ON d.id_doacao = s.id_doacao
      JOIN alimentos a ON a.id_alimento = d.id_alimento WHERE s.${user.column} = ?
    ORDER BY data DESC, atividade, id DESC LIMIT ? OFFSET ?`, [user.id, user.id, limite, offset]);
  return rows;
}
