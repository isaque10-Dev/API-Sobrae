import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as donations from '../service/doacoesService.js';
import { body, id } from '../utils/validation.js';
const endpoints = Router();
endpoints.get('/solicitacoes', authenticate, async (req, res) => res.json(await donations.listRequests(req.user, req.query)));
endpoints.post('/solicitacoes', authenticate, async (req, res) => { body(req.body); res.status(201).json(await donations.requestDonation(req.user, id(req.body.id_doacao, 'id_doacao'))); });
endpoints.patch('/solicitacoes/:id/status', authenticate, async (req, res) => res.json(await donations.changeRequest(req.user, id(req.params.id), req.body)));
export default endpoints;
