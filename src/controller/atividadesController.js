import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { con } from '../repository/connection.js';
import { statistics, history } from '../repository/atividadesRepository.js';
import { page, id } from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
const endpoints = Router();
endpoints.get('/atividades/resumo', authenticate, async (req, res) => res.json(await statistics(req.user)));
endpoints.get('/historico', authenticate, async (req, res) => res.json(await history(req.user, req.query)));
endpoints.get('/notificacoes', authenticate, async (req, res) => {
  const { limite, offset } = page(req.query);
  const [rows] = await con.query(`SELECT id_notificacao, mensagem, lida, criada_em FROM notificacoes WHERE ${req.user.column} = ? ORDER BY id_notificacao DESC LIMIT ? OFFSET ?`, [req.user.id, limite, offset]);
  res.json(rows);
});
endpoints.patch('/notificacoes/:id/lida', authenticate, async (req, res) => {
  const [result] = await con.execute(`UPDATE notificacoes SET lida = 1 WHERE id_notificacao = ? AND ${req.user.column} = ?`, [id(req.params.id), req.user.id]);
  ensure(result.affectedRows, 404, 'Notificação não encontrada.'); res.sendStatus(204);
});
endpoints.delete('/notificacoes', authenticate, async (req, res) => {
  await con.execute(`DELETE FROM notificacoes WHERE ${req.user.column} = ?`, [req.user.id]); res.sendStatus(204);
});
export function statusRouter(tipo, path) {
  const router = Router();
  router.get([path, `${path}/:id`], authenticate, async (req, res) => {
    ensure(req.user.tipo === tipo && (req.params.id === undefined || id(req.params.id) === req.user.id), 403, 'Você só pode consultar suas próprias estatísticas.');
    res.json(await statistics(req.user));
  });
  return router;
}
export default endpoints;
