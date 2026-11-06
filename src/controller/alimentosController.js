
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { transaction } from "../repository/connection.js";
import * as alimentos from "../repository/alimentosRepository.js";
import { isOwner } from "../repository/contasRepository.js";
import { ensure } from "../utils/errors.js";
import * as v from "../utils/validation.js";

const router = Router();


// LISTAR ALIMENTOS

router.get("/alimentos", authenticate, async (req, res) => {
    const pagina = v.page(req.query);

    const lista = await alimentos.listAlimentos(req.user, pagina);

    res.json(lista);
});


// BUSCAR ALIMENTO PELO ID

router.get("/alimentos/:id", authenticate, async (req, res) => {
    const codigo = v.id(req.params.id);

    const alimento = await alimentos.getAlimentos(codigo);

    ensure(alimento, 404, "Alimento não encontrado");
    ensure(isOwner(alimento, req.user), 403, "Esse alimento não é seu");

    res.json(alimento);
});


// CADASTRAR ALIMENTO

router.post("/alimentos", authenticate, async (req, res) => {
    const dados = v.food(req.body);

    const codigo = await alimentos.saveAlimento(dados, req.user);

    res.status(201).json({
        id: codigo,
        id_alimento: codigo
    });
});


// EDITAR ALIMENTO

router.put("/alimentos/:id", authenticate, async (req, res) => {
    const codigo = v.id(req.params.id);

    const resultado = await transaction(async (db) => {
        const alimento = await alimentos.getAlimentos(codigo, db, true);

        ensure(alimento, 404, "Alimento não encontrado");
        ensure(isOwner(alimento, req.user), 403, "Esse alimento não é seu");

        const [doacoes] = await db.execute(
            "SELECT id_doacao FROM doacoes WHERE id_alimento = ?",
            [codigo]
        );

        ensure(doacoes.length === 0, 409, "Alimento já vinculado a uma doação");

        const dados = v.food(req.body, alimento);

        await alimentos.updateAlimento(codigo, dados, db);

        return alimentos.getAlimentos(codigo, db);
    });

    res.json(resultado);
});


// EXCLUIR ALIMENTO

router.delete("/alimentos/:id", authenticate, async (req, res) => {
    const codigo = v.id(req.params.id);

    await transaction(async (db) => {
        const alimento = await alimentos.getAlimentos(codigo, db, true);

        ensure(alimento, 404, "Alimento não encontrado");
        ensure(isOwner(alimento, req.user), 403, "Esse alimento não é seu");

        const [doacoes] = await db.execute(
            "SELECT id_doacao FROM doacoes WHERE id_alimento = ?",
            [codigo]
        );

        ensure(doacoes.length === 0, 409, "Alimento já vinculado a uma doação");

        await db.execute(
            "DELETE FROM alimentos WHERE id_alimento = ?",
            [codigo]
        );
    });

    res.sendStatus(204);
});

export default router;
