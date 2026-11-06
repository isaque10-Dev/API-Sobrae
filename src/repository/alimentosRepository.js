import { con } from './connection.js';

export async function saveAlimento(alimento, user, db = con) {
  const [result] = await db.execute(`INSERT INTO alimentos
    (nome, tipo, status, data_vencimento, quantidade, unidade, ${user.column})
    VALUES (?, ?, 'disponivel', ?, ?, ?, ?)`,
  [alimento.nome, alimento.tipo, alimento.data_vencimento, alimento.quantidade, alimento.unidade, user.id]);
  return result.insertId;
}

export async function getAlimentos(id, db = con, lock = false) {
  const [rows] = await db.execute(`SELECT * FROM alimentos WHERE id_alimento = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0];
}

export async function listAlimentos(user, { limite, offset }) {
  const [rows] = await con.query(`SELECT * FROM alimentos WHERE ${user.column} = ? ORDER BY id_alimento DESC LIMIT ? OFFSET ?`, [user.id, limite, offset]);
  return rows;
}

export async function updateAlimento(id, alimento, db = con) {
  await db.execute('UPDATE alimentos SET nome = ?, tipo = ?, data_vencimento = ?, quantidade = ?, unidade = ? WHERE id_alimento = ?',
    [alimento.nome, alimento.tipo, alimento.data_vencimento, alimento.quantidade, alimento.unidade, id]);
}
