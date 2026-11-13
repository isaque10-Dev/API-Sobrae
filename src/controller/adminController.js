import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { con } from "../repository/connection.js";
import { isAdmin } from "../utils/admin.js";
import { ensure } from "../utils/errors.js";
import { body, id, text, today } from "../utils/validation.js";

const router = Router();

async function administrador(req, res, next) {
  ensure(isAdmin(req.user.tipo, req.user.id), 403, "Acesso permitido somente para administradores.");
  next();
}

router.get("/admin/contas", authenticate, administrador, async (req, res) => {
  const [contas] = await con.query(`
    SELECT id_pessoal AS id, 'pessoa' AS tipo, nome, email, ativo,
      cpf AS documento, num_telefone, usar_localizacao, distancia_km FROM conta_pessoal
    UNION ALL
    SELECT id_empresa AS id, 'empresa' AS tipo, nome_empresa AS nome, email, ativo,
      cnpj_empresa AS documento, num_telefone, usar_localizacao, distancia_km FROM conta_empresarial
    ORDER BY nome
  `);
  res.json(contas.map(conta => ({ ...conta, ativo: Boolean(conta.ativo), administrador: isAdmin(conta.tipo, conta.id) })));
});

router.get("/admin/resumo", authenticate, administrador, async (req, res) => {
  // Conta todas as doações, não somente as 100 mais recentes da tabela.
  const [situacoes] = await con.execute(`
    SELECT CASE WHEN d.status IN ('disponivel', 'reservado') AND a.data_vencimento < ?
      THEN 'expirado' ELSE d.status END AS situacao, COUNT(*) AS total
    FROM doacoes d JOIN alimentos a ON a.id_alimento = d.id_alimento
    GROUP BY situacao
  `, [today()]);
  const [[pedidos]] = await con.query("SELECT COUNT(*) AS pendentes FROM solicitacoes WHERE status = 'pendente'");
  res.json({ situacoes, solicitacoes_pendentes: pedidos.pendentes });
});

router.get("/admin/doacoes", authenticate, administrador, async (req, res) => {
  const [doacoes] = await con.execute(`
    SELECT d.id_doacao, d.status, d.data_doacao, d.local_retirada, a.data_vencimento AS validade,
      CASE WHEN d.status IN ('disponivel', 'reservado') AND a.data_vencimento < ?
        THEN 'expirado' ELSE d.status END AS situacao,
      a.nome, a.quantidade, a.unidade, COALESCE(p.nome, e.nome_empresa) AS doador
    FROM doacoes d JOIN alimentos a ON a.id_alimento = d.id_alimento
    LEFT JOIN conta_pessoal p ON p.id_pessoal = d.id_pessoal
    LEFT JOIN conta_empresarial e ON e.id_empresa = d.id_empresa
    ORDER BY d.id_doacao DESC LIMIT 100
  `, [today()]);
  res.json(doacoes);
});

router.get("/admin/eventos-solidarios", authenticate, administrador, async (req, res) => {
  const [propostas] = await con.query(`
    SELECT p.id_proposta_evento, p.tipo_organizador, p.nome_organizacao,
      p.nome_responsavel, p.email, p.telefone, p.nome_evento, p.proposta,
      p.alimentos, p.publico_estimado, p.endereco, p.cidade, p.estado,
      p.data_evento, p.horario_evento, p.status, p.justificativa,
      p.criada_em, p.analisada_em,
      COALESCE(autor_pessoal.nome, autor_empresa.nome_empresa) AS autor,
      COALESCE(analista_pessoal.nome, analista_empresa.nome_empresa) AS analista
    FROM propostas_eventos p
    LEFT JOIN conta_pessoal autor_pessoal ON autor_pessoal.id_pessoal = p.id_pessoal
    LEFT JOIN conta_empresarial autor_empresa ON autor_empresa.id_empresa = p.id_empresa
    LEFT JOIN conta_pessoal analista_pessoal ON analista_pessoal.id_pessoal = p.id_analista_pessoal
    LEFT JOIN conta_empresarial analista_empresa ON analista_empresa.id_empresa = p.id_analista_empresa
    ORDER BY CASE p.status WHEN 'pendente' THEN 0 ELSE 1 END, p.criada_em DESC, p.id_proposta_evento DESC
  `);
  res.json(propostas);
});

router.patch("/admin/eventos-solidarios/:id/status", authenticate, administrador, async (req, res) => {
  body(req.body);
  const status = text(req.body.status, "Status", 20);
  ensure(["aprovada", "recusada"].includes(status), 400, "Status inválido. Use aprovada ou recusada.");
  const justificativa = text(req.body.justificativa, "Justificativa", 1000, false);
  const id_proposta_evento = id(req.params.id, "Proposta");
  const id_analista_pessoal = req.user.tipo === "pessoa" ? req.user.id : null;
  const id_analista_empresa = req.user.tipo === "empresa" ? req.user.id : null;
  const [resultado] = await con.execute(`
    UPDATE propostas_eventos
    SET status = ?, justificativa = ?, id_analista_pessoal = ?, id_analista_empresa = ?, analisada_em = UTC_TIMESTAMP()
    WHERE id_proposta_evento = ? AND status = 'pendente'
  `, [status, justificativa, id_analista_pessoal, id_analista_empresa, id_proposta_evento]);
  ensure(resultado.affectedRows, 409, "A proposta não existe ou já foi analisada.");
  res.json({ mensagem: "Proposta " + status + ".", status });
});

router.patch("/admin/contas/:tipo/:id/status", authenticate, administrador, async (req, res) => {
  ensure(["pessoa", "empresa"].includes(req.params.tipo), 400, "Tipo de conta inválido.");
  ensure(typeof req.body.ativo === "boolean", 400, "Informe se a conta ficará ativa.");
  ensure(req.body.ativo || !isAdmin(req.params.tipo, id(req.params.id)), 409, "Não é possível desativar uma conta administradora por este painel.");
  const tabela = req.params.tipo === "pessoa" ? "conta_pessoal" : "conta_empresarial";
  const coluna = req.params.tipo === "pessoa" ? "id_pessoal" : "id_empresa";
  const [resultado] = await con.execute(`UPDATE ${tabela} SET ativo = ? WHERE ${coluna} = ?`, [req.body.ativo ? 1 : 0, id(req.params.id)]);
  ensure(resultado.affectedRows, 404, "Conta não encontrada.");
  res.json({ mensagem: "Conta atualizada." });
});

export default router;
