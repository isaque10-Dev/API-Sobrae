import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { transaction } from '../repository/connection.js';
import * as repository from '../repository/alimentosRepository.js';
import { isOwner } from '../repository/contasRepository.js';
import { ensure } from '../utils/errors.js';
import * as v from '../utils/validation.js';
const endpoints = Router();
endpoints.get('/alimentos', authenticate, async (req, res) => res.json(await repository.listAlimentos(req.user, v.page(req.query))));
endpoints.get('/alimentos/:id', authenticate, async (req, res) => {
  const food = await repository.getAlimentos(v.id(req.params.id));
  ensure(food, 404, 'Alimento não encontrado.');
  ensure(isOwner(food, req.user), 403, 'Você só pode consultar seus alimentos.');
  res.json(food);
});
endpoints.post('/alimentos', authenticate, async (req, res) => {
  const id = await repository.saveAlimento(v.food(req.body), req.user);
  res.status(201).json({ id, id_alimento: id });
});
async function change(req, remove) {
  const id = v.id(req.params.id);
  return transaction(async db => {
    const food = await repository.getAlimentos(id, db, true);
    ensure(food, 404, 'Alimento não encontrado.');
    ensure(isOwner(food, req.user), 403, 'Você só pode alterar seus alimentos.');
    const [links] = await db.execute('SELECT id_doacao FROM doacoes WHERE id_alimento = ?', [id]);
    ensure(!links.length, 409, 'Alimento vinculado a uma doação. Use a rota /doacoes.');
    if (remove) { await db.execute('DELETE FROM alimentos WHERE id_alimento = ?', [id]); return; }
    await repository.updateAlimento(id, v.food(req.body, food), db);
    return repository.getAlimentos(id, db);
  });
}
endpoints.put('/alimentos/:id', authenticate, async (req, res) => res.json(await change(req, false)));
endpoints.delete('/alimentos/:id', authenticate, async (req, res) => { await change(req, true); res.sendStatus(204); });
export default endpoints;
