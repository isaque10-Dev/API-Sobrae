import { con, transaction } from '../repository/connection.js';
import { getDonation, lockDonation } from '../repository/doacoesRepository.js';
import { isOwner, ownerOf, notify } from '../repository/contasRepository.js';
import * as foods from '../repository/alimentosRepository.js';
import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';

export async function createDonation(user, input) {
  v.body(input);
  const retirada = v.text(input.retirada ?? input.local_retirada, 'Local de retirada', 255);
  const descricao = v.text(input.descricao, 'Descrição', 1000, false);
  return transaction(async db => {
    let foodId;
    if (input.id_alimento !== undefined) {
      foodId = v.id(input.id_alimento, 'id_alimento');
      const food = await foods.getAlimentos(foodId, db, true);
      ensure(food, 404, 'Alimento não encontrado.');
      ensure(isOwner(food, user), 403, 'Este alimento pertence a outra conta.');
      v.food(food);
      const [links] = await db.execute('SELECT id_doacao FROM doacoes WHERE id_alimento = ?', [foodId]);
      ensure(!links.length, 409, 'Este alimento já está vinculado a uma doação.');
    } else {
      foodId = await foods.saveAlimento(v.food(input), user, db);
    }
    const [result] = await db.execute(`INSERT INTO doacoes (id_alimento, ${user.column}, local_retirada, descricao) VALUES (?, ?, ?, ?)`, [foodId, user.id, retirada, descricao]);
    await notify(db, user, 'Sua doação foi publicada.');
    return getDonation(result.insertId, db);
  });
}

export async function updateDonation(user, id, input) {
  v.body(input);
  return transaction(async db => {
    const current = await lockDonation(db, id);
    ensure(isOwner(current, user), 403, 'Você só pode editar suas doações.');
    ensure(current.status === 'disponivel', 409, 'Somente doações disponíveis podem ser editadas.');
    const [requests] = await db.execute("SELECT id_solicitacao FROM solicitacoes WHERE id_doacao = ? AND status IN ('pendente', 'aprovada')", [id]);
    ensure(!requests.length, 409, 'Resolva as solicitações antes de alterar esta doação.');
    const food = await foods.getAlimentos(current.id_alimento, db, true);
    const updated = v.food(input, food);
    const retirada = v.text(input.retirada ?? input.local_retirada ?? current.local_retirada, 'Local de retirada', 255);
    const descricao = v.text(input.descricao === undefined ? current.descricao : input.descricao, 'Descrição', 1000, false);
    await foods.updateAlimento(current.id_alimento, updated, db);
    await db.execute('UPDATE doacoes SET local_retirada = ?, descricao = ? WHERE id_doacao = ?', [retirada, descricao, id]);
    return getDonation(id, db);
  });
}

export async function cancelDonation(user, id) {
  return transaction(async db => {
    const current = await lockDonation(db, id);
    ensure(isOwner(current, user), 403, 'Você só pode cancelar suas doações.');
    ensure(['disponivel', 'reservado'].includes(current.status), 409, 'Esta doação já foi encerrada.');
    const [requests] = await db.execute("SELECT * FROM solicitacoes WHERE id_doacao = ? AND status IN ('pendente', 'aprovada')", [id]);
    for (const request of requests) await notify(db, ownerOf(request), 'O doador cancelou uma doação que você solicitou.');
    await db.execute("UPDATE solicitacoes SET status = 'cancelada' WHERE id_doacao = ? AND status IN ('pendente', 'aprovada')", [id]);
    await db.execute("UPDATE doacoes SET status = 'cancelado' WHERE id_doacao = ?", [id]);
    await db.execute("UPDATE alimentos SET status = 'cancelado' WHERE id_alimento = ?", [current.id_alimento]);
    return getDonation(id, db);
  });
}

export async function requestDonation(user, id) {
  return transaction(async db => {
    const donation = await lockDonation(db, id);
    ensure(!isOwner(donation, user), 409, 'Você não pode reservar a própria doação.');
    ensure(donation.status === 'disponivel', 409, 'Esta doação não está disponível.');
    const food = await foods.getAlimentos(donation.id_alimento, db);
    ensure(food.data_vencimento >= v.today(), 409, 'Esta doação está vencida.');
    const [existing] = await db.execute(`SELECT id_solicitacao FROM solicitacoes WHERE id_doacao = ? AND ${user.column} = ? AND status IN ('pendente', 'aprovada')`, [id, user.id]);
    ensure(!existing.length, 409, 'Você já possui uma solicitação para esta doação.');
    const [result] = await db.execute(`INSERT INTO solicitacoes (id_doacao, ${user.column}) VALUES (?, ?)`, [id, user.id]);
    await notify(db, ownerOf(donation), `Nova solicitação para: ${food.nome}.`);
    await notify(db, user, `Você solicitou: ${food.nome}. Aguarde a aprovação.`);
    return { id_solicitacao: result.insertId, id_doacao: id, status: 'pendente' };
  });
}

export async function listRequests(user, query) {
  const { limite, offset } = v.page(query);
  const received = query.recebidas === 'true';
  const [rows] = await con.query(`SELECT s.*, a.nome, a.quantidade, a.unidade, a.data_vencimento AS validade,
    d.status AS status_doacao, d.local_retirada,
    COALESCE(p.nome, e.nome_empresa) AS solicitante
    FROM solicitacoes s JOIN doacoes d ON d.id_doacao = s.id_doacao
    JOIN alimentos a ON a.id_alimento = d.id_alimento
    LEFT JOIN conta_pessoal p ON p.id_pessoal = s.id_pessoal
    LEFT JOIN conta_empresarial e ON e.id_empresa = s.id_empresa
    WHERE ${received ? 'd' : 's'}.${user.column} = ?
    ORDER BY s.id_solicitacao DESC LIMIT ? OFFSET ?`, [user.id, limite, offset]);
  return rows;
}

export async function changeRequest(user, id, input) {
  v.body(input);
  const target = input.status;
  ensure(['aprovada', 'recusada', 'cancelada', 'concluida'].includes(target), 400, 'Status deve ser aprovada, recusada, cancelada ou concluida.');
  return transaction(async db => {
    const [lookup] = await db.execute('SELECT id_doacao FROM solicitacoes WHERE id_solicitacao = ?', [id]);
    ensure(lookup[0], 404, 'Solicitação não encontrada.');
    const donation = await lockDonation(db, lookup[0].id_doacao);
    const [rows] = await db.execute('SELECT * FROM solicitacoes WHERE id_solicitacao = ? FOR UPDATE', [id]);
    const request = rows[0];
    const donor = isOwner(donation, user);
    const requester = isOwner(request, user);
    if (target === 'cancelada') ensure(requester, 403, 'Somente o solicitante pode cancelar a reserva.');
    else ensure(donor, 403, 'Somente o doador pode aprovar, recusar ou confirmar a retirada.');
    const food = await foods.getAlimentos(donation.id_alimento, db, true);
    if (target === 'aprovada') {
      ensure(request.status === 'pendente' && donation.status === 'disponivel', 409, 'Esta solicitação não pode ser aprovada.');
      ensure(food.data_vencimento >= v.today(), 409, 'Esta doação está vencida.');
      await db.execute("UPDATE doacoes SET status = 'reservado' WHERE id_doacao = ?", [donation.id_doacao]);
      await db.execute("UPDATE alimentos SET status = 'reservado' WHERE id_alimento = ?", [food.id_alimento]);
      const [others] = await db.execute("SELECT * FROM solicitacoes WHERE id_doacao = ? AND status = 'pendente' AND id_solicitacao <> ?", [donation.id_doacao, id]);
      for (const other of others) await notify(db, ownerOf(other), `Outra solicitação foi aprovada para: ${food.nome}.`);
      await db.execute("UPDATE solicitacoes SET status = 'recusada' WHERE id_doacao = ? AND status = 'pendente' AND id_solicitacao <> ?", [donation.id_doacao, id]);
    } else if (target === 'concluida') {
      ensure(request.status === 'aprovada' && donation.status === 'reservado', 409, 'A retirada exige uma reserva aprovada.');
      ensure(food.data_vencimento >= v.today(), 409, 'Esta doação está vencida; cancele a doação.');
      await db.execute("UPDATE doacoes SET status = 'concluido' WHERE id_doacao = ?", [donation.id_doacao]);
      await db.execute("UPDATE alimentos SET status = 'doado' WHERE id_alimento = ?", [food.id_alimento]);
    } else if (target === 'recusada') {
      ensure(request.status === 'pendente', 409, 'Somente solicitações pendentes podem ser recusadas.');
    } else {
      ensure(['pendente', 'aprovada'].includes(request.status), 409, 'Esta solicitação já foi encerrada.');
      if (request.status === 'aprovada') {
        await db.execute("UPDATE doacoes SET status = 'disponivel' WHERE id_doacao = ?", [donation.id_doacao]);
        await db.execute("UPDATE alimentos SET status = 'disponivel' WHERE id_alimento = ?", [food.id_alimento]);
      }
    }
    await db.execute('UPDATE solicitacoes SET status = ? WHERE id_solicitacao = ?', [target, id]);
    await notify(db, ownerOf(request), `Solicitação ${target}: ${food.nome}.`);
    await notify(db, ownerOf(donation), `Solicitação ${target}: ${food.nome}.`);
    return { ...request, status: target };
  });
}
