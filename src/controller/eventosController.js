import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { con } from "../repository/connection.js";
import { body, id, text, email, today } from "../utils/validation.js";
import { ensure } from "../utils/errors.js";

const router = Router();
const estados = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);

function dataDoEvento(valor) {
  const data = text(valor, "Data do evento", 10);
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(data), 400, "Use o formato AAAA-MM-DD para a data do evento");
  const convertida = new Date(data + "T00:00:00Z");
  ensure(!Number.isNaN(convertida.getTime()) && convertida.toISOString().slice(0, 10) === data, 400, "Data do evento inválida");
  ensure(data >= today(), 400, "A data do evento não pode estar no passado");
  return data;
}

function horarioDoEvento(valor) {
  const horario = text(valor, "Horário do evento", 5);
  ensure(/^([01]\d|2[0-3]):[0-5]\d$/.test(horario), 400, "Horário do evento inválido");
  return horario;
}

function propostaDoEvento(input) {
  body(input);
  const tipo_organizador = text(input.tipoOrganizador, "Tipo do organizador", 20);
  ensure(["pessoa", "empresa", "instituicao"].includes(tipo_organizador), 400, "Tipo do organizador inválido");
  const estado = text(input.estado, "Estado", 2).toUpperCase();
  ensure(estados.has(estado), 400, "Estado inválido");
  const publico = Number(input.publicoEstimado);
  ensure(Number.isSafeInteger(publico) && publico > 0 && publico <= 1000000, 400, "Público estimado inválido");

  return {
    tipo_organizador,
    nome_organizacao: tipo_organizador === "pessoa" ? null : text(input.nomeOrganizacao, "Nome da organização", 150),
    nome_responsavel: text(input.nomeResponsavel, "Nome do responsável", 100),
    email: email(input.email),
    telefone: text(input.telefone, "Telefone", 30),
    nome_evento: text(input.nomeEvento, "Nome do evento", 150),
    proposta: text(input.proposta, "Proposta", 4000),
    alimentos: text(input.alimentos, "Alimentos", 2000),
    publico_estimado: publico,
    endereco: text(input.endereco, "Local previsto", 255),
    cidade: text(input.cidade, "Cidade", 100),
    estado,
    data_evento: dataDoEvento(input.data),
    horario_evento: horarioDoEvento(input.horario),
  };
}

function valoresDoAutor(usuario) {
  return usuario.tipo === "pessoa"
    ? [usuario.id, null]
    : [null, usuario.id];
}

router.post("/eventos-solidarios", authenticate, async (req, res) => {
  const proposta = propostaDoEvento(req.body);
  const [id_pessoal, id_empresa] = valoresDoAutor(req.user);
  const [resultado] = await con.execute(`
    INSERT INTO propostas_eventos (
      id_pessoal, id_empresa, tipo_organizador, nome_organizacao, nome_responsavel,
      email, telefone, nome_evento, proposta, alimentos, publico_estimado, endereco,
      cidade, estado, data_evento, horario_evento
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id_pessoal, id_empresa, proposta.tipo_organizador, proposta.nome_organizacao,
    proposta.nome_responsavel, proposta.email, proposta.telefone, proposta.nome_evento,
    proposta.proposta, proposta.alimentos, proposta.publico_estimado, proposta.endereco,
    proposta.cidade, proposta.estado, proposta.data_evento, proposta.horario_evento]);
  res.status(201).json({ id_proposta_evento: resultado.insertId, status: "pendente", mensagem: "Proposta enviada para análise." });
});

router.get("/eventos-solidarios/minhas", authenticate, async (req, res) => {
  const [id_pessoal, id_empresa] = valoresDoAutor(req.user);
  const [propostas] = await con.execute(`
    SELECT id_proposta_evento, tipo_organizador, nome_organizacao, nome_responsavel,
      nome_evento, data_evento, horario_evento, cidade, estado, status, justificativa,
      criada_em, analisada_em
    FROM propostas_eventos
    WHERE (id_pessoal <=> ?) AND (id_empresa <=> ?)
    ORDER BY criada_em DESC, id_proposta_evento DESC
  `, [id_pessoal, id_empresa]);
  res.json(propostas);
});

router.get("/eventos-solidarios/:id", authenticate, async (req, res) => {
  const [id_pessoal, id_empresa] = valoresDoAutor(req.user);
  const [propostas] = await con.execute(`
    SELECT id_proposta_evento, tipo_organizador, nome_organizacao, nome_responsavel,
      nome_evento, proposta, alimentos, publico_estimado, endereco, cidade, estado,
      data_evento, horario_evento, status, justificativa, criada_em, analisada_em
    FROM propostas_eventos
    WHERE id_proposta_evento = ? AND (id_pessoal <=> ?) AND (id_empresa <=> ?)
  `, [id(req.params.id), id_pessoal, id_empresa]);
  ensure(propostas.length, 404, "Proposta não encontrada.");
  res.json(propostas[0]);
});

export default router;
