
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getDonation, listDonations } from "../repository/doacoesRepository.js";
import * as doacoes from "../service/doacoesService.js";
import { id, today } from "../utils/validation.js";
import { ensure } from "../utils/errors.js";

const router = Router();

router.get("/doacoes", async (req, res) => {
    const lista = await listDonations(req.query);
    res.json(lista);
});

router.get("/doacoes/minhas", authenticate, async (req, res) => {
    const lista = await listDonations(req.query, req.user);
    res.json(lista);
});

router.get("/doacoes/:id", async (req, res) => {
    const codigo = id(req.params.id);
    const doacao = await getDonation(codigo);

    ensure(doacao, 404, "Doação não encontrada");
    ensure(doacao.situacao === "disponivel", 404, "Doação indisponível");
    ensure(doacao.data_vencimento >= today(), 404, "Doação vencida");

    res.json(doacao);
});

router.post("/doacoes", authenticate, async (req, res) => {
    const dados = req.body;
    const resultado = await doacoes.createDonation(req.user, dados);

    res.status(201).json(resultado);
});

router.put("/doacoes/:id", authenticate, async (req, res) => {
    const codigo = id(req.params.id);
    const resultado = await doacoes.updateDonation(req.user, codigo, req.body);

    res.json(resultado);
});

router.delete("/doacoes/:id", authenticate, async (req, res) => {
    const codigo = id(req.params.id);
    const resultado = await doacoes.cancelDonation(req.user, codigo);

    res.json(resultado);
});

router.post("/doacoes/:id/solicitacoes", authenticate, async (req, res) => {
    const codigo = id(req.params.id);
    const resultado = await doacoes.requestDonation(req.user, codigo);

    res.status(201).json(resultado);
});

export default router;
