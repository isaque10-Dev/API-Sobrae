import { Router } from 'express';
import { authenticate, authRateLimit } from '../middleware/auth.js';
import * as accounts from '../service/contasService.js';
import { ensure } from '../utils/errors.js';
import { id } from '../utils/validation.js';

export function accountRouter(tipo, path) {
  const router = Router();
  router.post(path, authRateLimit(), async (req, res) => res.status(201).json(await accounts.register(req.body, tipo)));
  const ownAccount = (req, res, next) => {
    ensure(req.user.tipo === tipo && req.user.id === id(req.params.id), 403, 'Você só pode acessar sua própria conta.');
    next();
  };
  router.get(`${path}/:id`, authenticate, ownAccount, async (req, res) => res.json(await accounts.profile(req.user)));
  router.put(`${path}/:id`, authenticate, ownAccount, async (req, res) => res.json(await accounts.updateProfile(req.user, req.body)));
  return router;
}
