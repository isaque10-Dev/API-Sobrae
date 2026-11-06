import { con, transaction } from '../repository/connection.js';
import { accountConfig, findAccount, publicAccount } from '../repository/contasRepository.js';
import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { hashPassword, verifyPassword, newToken, tokenHash } from '../utils/security.js';
import { config } from '../config.js';

async function session(db, tipo, row) {
  const cfg = accountConfig(tipo);
  const token = newToken();
  await db.execute('DELETE FROM sessoes WHERE expira_em <= UTC_TIMESTAMP()');
  await db.execute(`INSERT INTO sessoes (token_hash, ${cfg.id}, expira_em) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`, [tokenHash(token), row[cfg.id], config.sessionHours]);
  return { token, expira_em: new Date(Date.now() + config.sessionHours * 3600000).toISOString(), usuario: publicAccount(tipo, row) };
}

export async function register(input, forcedType) {
  v.body(input);
  const tipo = v.type(forcedType || input.tipo);
  const cfg = accountConfig(tipo);
  const nome = v.text(input[cfg.name] ?? input.nome, 'Nome', tipo === 'pessoa' ? 100 : 150);
  const email = v.email(input.email);
  const documento = v.document(input[cfg.document] ?? input.documento, tipo === 'pessoa' ? 'CPF' : 'CNPJ', tipo === 'empresa');
  const telefone = v.text(input.num_telefone, 'Telefone', 20, false);
  const senha = await hashPassword(v.password(input.senha));
  return transaction(async db => {
    const [result] = await db.execute(`INSERT INTO ${cfg.table} (${cfg.name}, ${cfg.document}, num_telefone, email, senha) VALUES (?, ?, ?, ?, ?)`, [nome, documento, telefone, email, senha]);
    return session(db, tipo, await findAccount(tipo, result.insertId, db));
  });
}

export async function login(input) {
  v.body(input);
  const email = v.email(input.email);
  // Login aceita senhas legadas curtas; novos cadastros e trocas exigem 8 caracteres.
  ensure(typeof input.senha === 'string' && input.senha.length > 0 && input.senha.length <= 128, 400, 'Informe a senha (até 128 caracteres).');
  const senha = input.senha;
  const types = input.tipo ? [v.type(input.tipo)] : ['pessoa', 'empresa'];
  return transaction(async db => {
    const candidates = [];
    for (const tipo of types) {
      const cfg = accountConfig(tipo);
      const [rows] = await db.execute(`SELECT * FROM ${cfg.table} WHERE email = ? AND ativo = 1 FOR UPDATE`, [email]);
      if (rows[0]) candidates.push({ tipo, row: rows[0] });
    }
    ensure(candidates.length <= 1, 400, 'Informe tipo: pessoa ou empresa para acessar este e-mail.');
    const candidate = candidates[0];
    // Mesmo custo de hash quando a conta não existe, sem revelar o cadastro.
    if (!candidate) { await hashPassword(senha); ensure(false, 401, 'E-mail ou senha incorretos.'); }
    ensure(await verifyPassword(senha, candidate.row.senha), 401, 'E-mail ou senha incorretos.');
    return session(db, candidate.tipo, candidate.row);
  });
}

export async function profile(user) {
  const row = await findAccount(user.tipo, user.id);
  ensure(row, 404, 'Conta não encontrada.');
  return publicAccount(user.tipo, row);
}

export async function updateProfile(user, input) {
  v.body(input);
  ensure(input.tipo === undefined || v.type(input.tipo) === user.tipo, 400, 'Não é possível trocar o tipo da conta.');
  const cfg = accountConfig(user.tipo);
  const changes = {};
  if (input.nome !== undefined || input[cfg.name] !== undefined) changes[cfg.name] = v.text(input[cfg.name] ?? input.nome, 'Nome', user.tipo === 'pessoa' ? 100 : 150);
  if (input.email !== undefined) changes.email = v.email(input.email);
  if (input.num_telefone !== undefined) changes.num_telefone = v.text(input.num_telefone, 'Telefone', 20, false);
  if (input[cfg.document] !== undefined) changes[cfg.document] = v.document(input[cfg.document], user.tipo === 'pessoa' ? 'CPF' : 'CNPJ', user.tipo === 'empresa');
  if (input.usar_localizacao !== undefined) {
    ensure(typeof input.usar_localizacao === 'boolean', 400, 'usar_localizacao deve ser true ou false.');
    changes.usar_localizacao = input.usar_localizacao;
  }
  if (input.distancia_km !== undefined) {
    ensure([5, 10, 20].includes(input.distancia_km), 400, 'distancia_km deve ser 5, 10 ou 20.');
    changes.distancia_km = input.distancia_km;
  }
  ensure(Object.keys(changes).length, 400, 'Informe os campos do perfil que deseja alterar.');
  return transaction(async db => {
    const current = await findAccount(user.tipo, user.id, db, true);
    if (changes.email && changes.email !== current.email) ensure(await verifyPassword(input.senha_atual, current.senha), 403, 'Informe a senha atual para alterar o e-mail.');
    const setters = Object.keys(changes).map(key => `${key} = ?`).join(', ');
    await db.execute(`UPDATE ${cfg.table} SET ${setters} WHERE ${cfg.id} = ?`, [...Object.values(changes), user.id]);
    return publicAccount(user.tipo, await findAccount(user.tipo, user.id, db));
  });
}

export async function changePassword(user, input) {
  v.body(input);
  const hashed = await hashPassword(v.password(input.nova_senha));
  const cfg = accountConfig(user.tipo);
  await transaction(async db => {
    const current = await findAccount(user.tipo, user.id, db, true);
    ensure(await verifyPassword(input.senha_atual, current.senha), 403, 'Senha atual incorreta.');
    await db.execute(`UPDATE ${cfg.table} SET senha = ? WHERE ${cfg.id} = ?`, [hashed, user.id]);
    await db.execute(`DELETE FROM sessoes WHERE ${cfg.id} = ?`, [user.id]);
  });
}

export async function logout(user) {
  await con.execute('DELETE FROM sessoes WHERE token_hash = ?', [user.tokenHash]);
}
