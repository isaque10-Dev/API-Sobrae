import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDonation, listDonations } from '../repository/doacoesRepository.js';
import * as donations from '../service/doacoesService.js';
import { id, today } from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
const endpoints = Router();
endpoints.get('/doacoes', async (req, res) => res.json(await listDonations(req.query)));
endpoints.get('/doacoes/minhas', authenticate, async (req, res) => res.json(await listDonations(req.query, req.user)));
endpoints.get('/doacoes/:id', async (req, res) => {
  const donation = await getDonation(id(req.params.id));
  ensure(donation && donation.situacao === 'disponivel' && donation.data_vencimento >= today(), 404, 'Doação disponível não encontrada.');
  res.json(donation);
});
endpoints.post('/doacoes', authenticate, async (req, res) => res.status(201).json(await donations.createDonation(req.user, req.body)));
endpoints.put('/doacoes/:id', authenticate, async (req, res) => res.json(await donations.updateDonation(req.user, id(req.params.id), req.body)));
endpoints.delete('/doacoes/:id', authenticate, async (req, res) => res.json(await donations.cancelDonation(req.user, id(req.params.id))));
endpoints.post('/doacoes/:id/solicitacoes', authenticate, async (req, res) => res.status(201).json(await donations.requestDonation(req.user, id(req.params.id))));
export default endpoints;
