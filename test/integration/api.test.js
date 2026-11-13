import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';

// Cada execução usa bancos novos. Nunca limpa o banco configurado do aplicativo.
const suffix = `${Date.now()}_${process.pid}`;
process.env.DB_NAME = `sobrae_test_${suffix}`;
const { config } = await import('../../src/config.js');
const { setupDatabase } = await import('../../scripts/setup-db.js');
const { con } = await import('../../src/repository/connection.js');
const { createApp } = await import('../../src/app.js');
const { verifyPassword } = await import('../../src/utils/security.js');

test('API com MySQL real: cadastro, permissões, doações e reservas concorrentes', async t => {
  await setupDatabase();
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const createdDatabases = [config.db.database];
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await con.end();
    const { database, ...settings } = config.db;
    const db = await mysql.createConnection(settings);
    try {
      for (const name of createdDatabases) {
        assert.match(name, /^sobrae_test_\d+_\d+(_legacy)?$/);
        await db.query(`DROP DATABASE \`${name}\``);
      }
    } finally { await db.end(); }
  });

  async function request(path, { method = 'GET', body, token, status = 200, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(value)}`);
    return value;
  }
  const pessoa = { tipo: 'pessoa', nome: 'Pessoa de teste', email: 'pessoa@example.test', senha: 'Teste123!', num_telefone: '11999990000' };
  const empresa = { tipo: 'empresa', nome_empresa: 'Empresa de teste', cnpj_empresa: '11.222.333/0001-81', email: 'empresa@example.test', senha: 'Teste123!' };
  let donor, recipient, other, donation, firstRequest, secondRequest;
  const food = { nome: 'Arroz', categoria: 'Outro', quantidade: '2,5 kg', validade: '2099-12-31', retirada: 'Portaria do local de teste' };

  await t.test('cadastro dos dois tipos, senha protegida e login', async () => {
    donor = await request('/auth/cadastro', { method: 'POST', body: empresa, status: 201 });
    recipient = await request('/auth/cadastro', { method: 'POST', body: pessoa, status: 201 });
    other = await request('/contapessoal', { method: 'POST', body: { ...pessoa, email: 'outra@example.test' }, status: 201 });
    assert.equal(donor.usuario.tipo, 'empresa');
    assert.equal(donor.usuario.senha, undefined);
    const [rows] = await con.execute('SELECT senha FROM conta_pessoal WHERE id_pessoal = ?', [recipient.usuario.id]);
    assert.match(rows[0].senha, /^scrypt\$/);
    await request('/auth/cadastro', { method: 'POST', body: pessoa, status: 409 });
    await request('/auth/login', { method: 'POST', body: { email: pessoa.email, senha: 'Incorreta!' }, status: 401 });
    await request('/auth/login', { method: 'POST', body: { email: pessoa.email, senha: pessoa.senha } });
    await request('/perfil', { status: 401 });
    assert.equal((await request('/perfil', { token: recipient.token })).email, pessoa.email);
    await request(`/contapessoal/${other.usuario.id}`, { token: recipient.token, status: 403 });
  });

  await t.test('admin exige sessão e ID autorizado, sem confiar no e-mail ou no cliente', async () => {
    config.adminEmails = [pessoa.email];
    config.adminContas = [];
    await request('/admin/contas', { status: 401 });
    await request('/admin/contas', { token: recipient.token, status: 403 });
    await request('/admin/doacoes', { token: recipient.token, status: 403 });
    await request('/admin/resumo', { token: recipient.token, status: 403 });
    assert.equal((await request('/auth/me', { token: recipient.token })).administrador, false);
    config.adminContas = [`pessoa:${other.usuario.id}`];
    assert.equal((await request('/auth/me', { token: other.token })).administrador, true);
    const contas = await request('/admin/contas', { token: other.token });
    assert.equal(contas.length, 3);
    assert.equal(contas.find(conta => conta.email === pessoa.email).num_telefone, pessoa.num_telefone);
    assert.equal(contas.find(conta => conta.tipo === 'empresa').documento, '11222333000181');
    for (const conta of contas) {
      assert.deepEqual(Object.keys(conta).sort(), ['id', 'tipo', 'nome', 'email', 'ativo', 'documento', 'num_telefone', 'usar_localizacao', 'distancia_km', 'administrador'].sort());
    }
    await request(`/admin/contas/pessoa/${other.usuario.id}/status`, { method: 'PATCH', token: other.token, body: { ativo: false }, status: 409 });
    await request(`/admin/contas/pessoa/${recipient.usuario.id}/status`, { method: 'PATCH', token: recipient.token, body: { ativo: false }, status: 403 });
    await request('/perfil', { method: 'PATCH', token: recipient.token, body: { nome: 'Pessoa de teste', administrador: true } });
    assert.equal((await request('/auth/me', { token: recipient.token })).administrador, false);
    await request(`/admin/contas/pessoa/${recipient.usuario.id}/status`, { method: 'PATCH', token: other.token, body: { ativo: false } });
    await request('/auth/me', { token: recipient.token, status: 401 });
    await request(`/admin/contas/pessoa/${recipient.usuario.id}/status`, { method: 'PATCH', token: other.token, body: { ativo: true } });
    config.adminContas = [];
  });

  await t.test('valida dados, JSON, IDs e publicação atômica', async () => {
    await request('/doacoes', { method: 'POST', body: food, status: 401 });
    await request('/doacoes', { method: 'POST', body: { ...food, quantidade: -1 }, token: donor.token, status: 400 });
    await request('/doacoes', { method: 'POST', body: { ...food, validade: '2020-01-01' }, token: donor.token, status: 400 });
    await request('/doacoes/abc', { status: 400 });
    const malformed = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    donation = await request('/doacoes', { method: 'POST', body: { ...food, id_pessoal: recipient.usuario.id }, token: donor.token, status: 201 });
    assert.equal(donation.quantidade, 2.5);
    assert.equal(donation.id_empresa, donor.usuario.id);
    assert.equal(donation.id_pessoal, null);
    assert.equal((await request('/doacoes?categoria=Outro&busca=Arroz')).length, 1);
    assert.equal((await request('/doacoes?categoria=P%C3%A3es')).length, 0);
    await request('/doacoes?limite=1000', { status: 400 });
    const [counts] = await con.query('SELECT COUNT(*) AS total FROM alimentos');
    assert.equal(counts[0].total, 1);
  });

  await t.test('somente o dono edita e alimento publicado não pode ser alterado por fora', async () => {
    await request(`/doacoes/${donation.id_doacao}`, { method: 'PUT', token: other.token, body: { nome: 'Mudança indevida' }, status: 403 });
    await request(`/alimentos/${donation.id_alimento}`, { method: 'PUT', token: donor.token, body: { quantidade: 10 }, status: 409 });
    await request(`/doacoes/${donation.id_doacao}`, { method: 'PUT', token: donor.token, body: { nome: 'Arroz integral' } });
    await request(`/doacoes/${donation.id_doacao}/solicitacoes`, { method: 'POST', token: donor.token, status: 409 });
  });

  await t.test('falha no fim da publicação desfaz alimento e doação', async () => {
    const [[before]] = await con.query('SELECT COUNT(*) AS total FROM alimentos');
    await con.query("CREATE TRIGGER test_notification_error BEFORE INSERT ON notificacoes FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'falha de teste'");
    try {
      await request('/doacoes', { method: 'POST', token: donor.token, body: food, status: 500 });
      const [[after]] = await con.query('SELECT COUNT(*) AS total FROM alimentos');
      assert.equal(after.total, before.total);
      assert.equal((await request('/doacoes')).length, 1);
    } finally { await con.query('DROP TRIGGER test_notification_error'); }
  });

  await t.test('solicitações duplicadas e aprovações concorrentes', async () => {
    firstRequest = await request(`/doacoes/${donation.id_doacao}/solicitacoes`, { method: 'POST', token: recipient.token, status: 201 });
    await request('/solicitacoes', { method: 'POST', token: recipient.token, body: { id_doacao: donation.id_doacao }, status: 409 });
    secondRequest = await request('/solicitacoes', { method: 'POST', token: other.token, body: { id_doacao: donation.id_doacao }, status: 201 });
    await request(`/doacoes/${donation.id_doacao}`, { method: 'PUT', token: donor.token, body: { quantidade: 3 }, status: 409 });
    await request(`/solicitacoes/${firstRequest.id_solicitacao}/status`, { method: 'PATCH', token: recipient.token, body: { status: 'aprovada' }, status: 403 });
    const responses = await Promise.all([firstRequest, secondRequest].map(item => fetch(`${base}/solicitacoes/${item.id_solicitacao}/status`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${donor.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'aprovada' }),
    })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const requests = await request('/solicitacoes?recebidas=true', { token: donor.token });
    assert.equal(requests.filter(s => s.status === 'aprovada').length, 1);
    assert.equal(requests.filter(s => s.status === 'recusada').length, 1);
    assert.equal((await request('/doacoes')).length, 0);
    firstRequest = requests.find(s => s.status === 'aprovada');
  });

  await t.test('retirada, histórico e estatísticas sem dupla contagem', async () => {
    await request(`/solicitacoes/${firstRequest.id_solicitacao}/status`, { method: 'PATCH', token: donor.token, body: { status: 'concluida' } });
    await request(`/solicitacoes/${firstRequest.id_solicitacao}/status`, { method: 'PATCH', token: donor.token, body: { status: 'concluida' }, status: 409 });
    const stats = await request('/statusempresa', { token: donor.token });
    assert.equal(stats.doacao_total, 1); assert.equal(stats.impacto_kg, 2.5);
    assert.equal((await request('/historico', { token: donor.token }))[0].status, 'concluido');
    await request(`/doacoes/${donation.id_doacao}`, { method: 'DELETE', token: donor.token, status: 409 });
  });

  await t.test('cancelar reserva aprovada libera a doação; cancelar doação preserva histórico', async () => {
    const donated = await request('/doacoes', { method: 'POST', token: recipient.token, body: food, status: 201 });
    const pending = await request(`/doacoes/${donated.id_doacao}/solicitacoes`, { method: 'POST', token: donor.token, status: 201 });
    await request(`/solicitacoes/${pending.id_solicitacao}/status`, { method: 'PATCH', token: recipient.token, body: { status: 'aprovada' } });
    await request(`/solicitacoes/${pending.id_solicitacao}/status`, { method: 'PATCH', token: donor.token, body: { status: 'cancelada' } });
    assert.equal((await request(`/doacoes/${donated.id_doacao}`)).status, 'disponivel');
    await request(`/doacoes/${donated.id_doacao}/solicitacoes`, { method: 'POST', token: other.token, status: 201 });
    await request(`/doacoes/${donated.id_doacao}`, { method: 'DELETE', token: recipient.token });
    const requests = await request('/solicitacoes', { token: other.token });
    assert.equal(requests.find(s => s.id_doacao === donated.id_doacao).status, 'cancelada');
  });

  await t.test('alimentos avulsos, reservas vencidas e notificações privadas', async () => {
    const draft = await request('/alimentos', { method: 'POST', token: donor.token, body: food, status: 201 });
    await request(`/alimentos/${draft.id}`, { method: 'PUT', token: donor.token, body: { quantidade: '500 g' } });
    await request(`/alimentos/${draft.id}`, { method: 'GET', token: other.token, status: 403 });
    await request(`/alimentos/${draft.id}`, { method: 'DELETE', token: donor.token, status: 204 });
    const expired = await request('/doacoes', { method: 'POST', token: donor.token, body: food, status: 201 });
    await con.execute("UPDATE alimentos SET data_vencimento = '2020-01-01' WHERE id_alimento = ?", [expired.id_alimento]);
    await request(`/doacoes/${expired.id_doacao}/solicitacoes`, { method: 'POST', token: recipient.token, status: 409 });
    assert.equal((await request('/doacoes')).length, 0);
    const notifications = await request('/notificacoes', { token: donor.token });
    assert.ok(notifications.length > 0);
    await request(`/notificacoes/${notifications[0].id_notificacao}/lida`, { method: 'PATCH', token: other.token, status: 404 });
    await request(`/notificacoes/${notifications[0].id_notificacao}/lida`, { method: 'PATCH', token: donor.token, status: 204 });
    await request('/notificacoes', { method: 'DELETE', token: donor.token, status: 204 });
    assert.equal((await request('/notificacoes', { token: donor.token })).length, 0);
  });

  await t.test('resumo administrativo considera vencimento e todo o histórico', async () => {
    config.adminContas = [`pessoa:${other.usuario.id}`];
    const resumo = await request('/admin/resumo', { token: other.token });
    assert.equal(Number(resumo.situacoes.find(item => item.situacao === 'expirado').total), 1);
    assert.equal(Number(resumo.situacoes.find(item => item.situacao === 'concluido').total), 1);
    assert.equal(Number(resumo.situacoes.find(item => item.situacao === 'cancelado').total), 1);
    const lista = await request('/admin/doacoes', { token: other.token });
    assert.equal(lista.filter(item => item.situacao === 'expirado').length, 1);
    const [[contagem]] = await con.query('SELECT COUNT(*) AS total FROM doacoes');
    assert.equal(resumo.situacoes.reduce((soma, item) => soma + Number(item.total), 0), contagem.total);
    config.adminContas = [];
  });

  await t.test('preferências, senha e logout revogam sessões', async () => {
    await request('/perfil', { method: 'PATCH', token: recipient.token, body: { nome: 'Nome atualizado', usar_localizacao: true, distancia_km: 20 } });
    await request('/perfil', { method: 'PATCH', token: recipient.token, body: { email: 'nova@example.test' }, status: 403 });
    await request('/perfil/senha', { method: 'PATCH', token: recipient.token, body: { senha_atual: pessoa.senha, nova_senha: 'NovaSenha123!' } });
    await request('/perfil', { token: recipient.token, status: 401 });
    const session = await request('/auth/login', { method: 'POST', body: { email: pessoa.email, senha: 'NovaSenha123!' } });
    await request('/auth/logout', { method: 'POST', token: session.token, status: 204 });
    await request('/perfil', { token: session.token, status: 401 });
    await con.execute('UPDATE sessoes SET expira_em = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE id_empresa = ?', [donor.usuario.id]);
    await request('/perfil', { token: donor.token, status: 401 });
  });

  await t.test('migração do banco original é repetível e preserva registros', async () => {
    const name = `${config.db.database}_legacy`;
    createdDatabases.push(name);
    const { database, ...settings } = config.db;
    const db = await mysql.createConnection(settings);
    try {
      await db.query(`CREATE DATABASE \`${name}\``);
      await db.query(`USE \`${name}\``);
      const source = await readFile(new URL('../fixtures/original-schema.sql', import.meta.url), 'utf8');
      for (const statement of source.split(';').map(s => s.trim()).filter(Boolean)) {
        if (!/^(create database|use )/i.test(statement)) await db.query(statement);
      }
      await db.execute("INSERT INTO alimentos (nome, quantidade) VALUES ('Legado', 5)");
      await db.execute("INSERT INTO conta_pessoal (nome, email, senha) VALUES ('Legado', 'legado@example.test', '1234')");
      await setupDatabase({ ...config.db, database: name });
      await setupDatabase({ ...config.db, database: name });
      const [foods] = await db.query('SELECT * FROM alimentos');
      assert.equal(foods[0].nome, 'Legado'); assert.equal(foods[0].quantidade, 5);
      assert.equal(foods[0].id_pessoal, null);
      const [accounts] = await db.query('SELECT * FROM conta_pessoal');
      assert.equal(await verifyPassword('1234', accounts[0].senha), true);
    } finally { await db.end(); }
  });
});
