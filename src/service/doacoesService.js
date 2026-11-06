import { con, transaction } from '../repository/connection.js';
import { getDonation, lockDonation } from '../repository/doacoesRepository.js';
import { isOwner, ownerOf, notify } from '../repository/contasRepository.js';
import * as foods from '../repository/alimentosRepository.js';
import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';



export async function createDonation(user, input, imagem = null) {
    v.body(input);

    let local = input.retirada;

    if (local === undefined) {
        local = input.local_retirada;
    }

    const retirada = v.text(local, "Local de retirada", 255);
    const descricao = v.text(input.descricao, "Descrição", 1000, false);

    return transaction(async (db) => {

        let idAlimento;

        if (input.id_alimento !== undefined) {

            idAlimento = v.id(input.id_alimento, "id_alimento");

            const alimento = await foods.getAlimentos(idAlimento, db, true);

            ensure(alimento, 404, "Alimento não encontrado");
            ensure(isOwner(alimento, user), 403, "Este alimento não é seu");

            v.food(alimento);

            const [existentes] = await db.execute(
                "SELECT id_doacao FROM doacoes WHERE id_alimento = ?",
                [idAlimento]
            );

            ensure(
                existentes.length === 0,
                409,
                "Este alimento já possui uma doação"
            );

        } else {

            const alimento = v.food(input);

            idAlimento = await foods.saveAlimento(alimento, user, db);
        }

        const sql = `
            INSERT INTO doacoes
            (id_alimento, ${user.column}, local_retirada, descricao, imagem)
            VALUES (?, ?, ?, ?, ?)
        `;

        const [resultado] = await db.execute(sql, [
            idAlimento,
            user.id,
            retirada,
            descricao,
            imagem
        ]);

        await notify(db, user, "Sua doação foi publicada.");

        return getDonation(resultado.insertId, db);
    });
}



export async function updateDonation(user, id, input) {
    v.body(input);

    return transaction(async (db) => {
        const doacao = await lockDonation(db, id);

        ensure(isOwner(doacao, user), 403, "Essa doação não é sua");
        ensure(doacao.status === "disponivel", 409, "Doação indisponível");

        const [pedidos] = await db.execute(
            "SELECT id_solicitacao FROM solicitacoes WHERE id_doacao = ? AND status IN ('pendente', 'aprovada')",
            [id]
        );

        ensure(pedidos.length === 0, 409, "Essa doação possui solicitações");

        const alimento = await foods.getAlimentos(doacao.id_alimento, db, true);
        const dados = v.food(input, alimento);

        let retirada = input.retirada;
        if (retirada === undefined) {
            retirada = input.local_retirada;
        }
        if (retirada === undefined) {
            retirada = doacao.local_retirada;
        }

        let descricao = input.descricao;
        if (descricao === undefined) {
            descricao = doacao.descricao;
        }

        retirada = v.text(retirada, "Local de retirada", 255);
        descricao = v.text(descricao, "Descrição", 1000, false);

        await foods.updateAlimento(doacao.id_alimento, dados, db);

        await db.execute(
            "UPDATE doacoes SET local_retirada = ?, descricao = ? WHERE id_doacao = ?",
            [retirada, descricao, id]
        );

        return getDonation(id, db);
    });
}

export async function cancelDonation(user, id) {
    return transaction(async (db) => {
        const doacao = await lockDonation(db, id);

        ensure(isOwner(doacao, user), 403, "Essa doação não é sua");
        ensure(
            ["disponivel", "reservado"].includes(doacao.status),
            409,
            "Essa doação já foi encerrada"
        );

        const [pedidos] = await db.execute(
            "SELECT * FROM solicitacoes WHERE id_doacao = ? AND status IN ('pendente', 'aprovada')",
            [id]
        );

        for (const pedido of pedidos) {
            await notify(db, ownerOf(pedido), "O doador cancelou a doação");
        }

        await db.execute(
            "UPDATE solicitacoes SET status = 'cancelada' WHERE id_doacao = ? AND status IN ('pendente', 'aprovada')",
            [id]
        );

        await db.execute(
            "UPDATE doacoes SET status = 'cancelado' WHERE id_doacao = ?",
            [id]
        );

        await db.execute(
            "UPDATE alimentos SET status = 'cancelado' WHERE id_alimento = ?",
            [doacao.id_alimento]
        );

        return getDonation(id, db);
    });
}

export async function requestDonation(user, id) {
    return transaction(async (db) => {
        const doacao = await lockDonation(db, id);

        ensure(!isOwner(doacao, user), 409, "Você não pode reservar sua doação");
        ensure(doacao.status === "disponivel", 409, "Doação indisponível");

        const alimento = await foods.getAlimentos(doacao.id_alimento, db);

        ensure(alimento.data_vencimento >= v.today(), 409, "Alimento vencido");

        const sql = `
            SELECT id_solicitacao FROM solicitacoes
            WHERE id_doacao = ?
            AND ${user.column} = ?
            AND status IN ('pendente', 'aprovada')
        `;

        const [pedidos] = await db.execute(sql, [id, user.id]);

        ensure(pedidos.length === 0, 409, "Você já solicitou essa doação");

        const [resultado] = await db.execute(
            `INSERT INTO solicitacoes (id_doacao, ${user.column}) VALUES (?, ?)`,
            [id, user.id]
        );

        await notify(db, ownerOf(doacao), `Nova solicitação: ${alimento.nome}`);
        await notify(db, user, `Você solicitou: ${alimento.nome}. Aguarde aprovação.`);

        return {
            id_solicitacao: resultado.insertId,
            id_doacao: id,
            status: "pendente"
        };
    });
}






export async function listRequests(user, query) {
    const pagina = v.page(query);

    let tabela = "s";

    if (query.recebidas === "true") {
        tabela = "d";
    }

    const sql = `
        SELECT s.*, a.nome, a.quantidade, a.unidade,
        a.data_vencimento AS validade,
        d.status AS status_doacao,
        d.local_retirada,
        COALESCE(p.nome, e.nome_empresa) AS solicitante
        FROM solicitacoes s
        JOIN doacoes d ON d.id_doacao = s.id_doacao
        JOIN alimentos a ON a.id_alimento = d.id_alimento
        LEFT JOIN conta_pessoal p ON p.id_pessoal = s.id_pessoal
        LEFT JOIN conta_empresarial e ON e.id_empresa = s.id_empresa
        WHERE ${tabela}.${user.column} = ?
        ORDER BY s.id_solicitacao DESC
        LIMIT ? OFFSET ?
    `;

    const [resultado] = await con.query(sql, [
        user.id,
        pagina.limite,
        pagina.offset
    ]);

    return resultado;
}



export async function changeRequest(user, id, input) {
    v.body(input);

    const status = input.status;

    ensure(
        ["aprovada", "recusada", "cancelada", "concluida"].includes(status),
        400,
        "Status inválido"
    );

    return transaction(async (db) => {
        const [busca] = await db.execute(
            "SELECT id_doacao FROM solicitacoes WHERE id_solicitacao = ?",
            [id]
        );

        ensure(busca.length > 0, 404, "Solicitação não encontrada");

        const doacao = await lockDonation(db, busca[0].id_doacao);

        const [pedidos] = await db.execute(
            "SELECT * FROM solicitacoes WHERE id_solicitacao = ? FOR UPDATE",
            [id]
        );

        const pedido = pedidos[0];

        ensure(pedido, 404, "Solicitação não encontrada");

        if (status === "cancelada") {
            ensure(isOwner(pedido, user), 403, "Essa reserva não é sua");
        } else {
            ensure(isOwner(doacao, user), 403, "Essa doação não é sua");
        }

        const alimento = await foods.getAlimentos(doacao.id_alimento, db, true);

        if (status === "aprovada") {
            ensure(pedido.status === "pendente", 409, "Reserva não está pendente");
            ensure(doacao.status === "disponivel", 409, "Doação indisponível");
            ensure(alimento.data_vencimento >= v.today(), 409, "Alimento vencido");

            await db.execute(
                "UPDATE doacoes SET status = 'reservado' WHERE id_doacao = ?",
                [doacao.id_doacao]
            );

            await db.execute(
                "UPDATE alimentos SET status = 'reservado' WHERE id_alimento = ?",
                [alimento.id_alimento]
            );

            const [outros] = await db.execute(
                "SELECT * FROM solicitacoes WHERE id_doacao = ? AND status = 'pendente' AND id_solicitacao <> ?",
                [doacao.id_doacao, id]
            );

            for (const outro of outros) {
                await notify(db, ownerOf(outro), `Outra reserva foi aprovada: ${alimento.nome}`);
            }

            await db.execute(
                "UPDATE solicitacoes SET status = 'recusada' WHERE id_doacao = ? AND status = 'pendente' AND id_solicitacao <> ?",
                [doacao.id_doacao, id]
            );
        }

        if (status === "concluida") {
            ensure(pedido.status === "aprovada", 409, "Reserva não aprovada");
            ensure(doacao.status === "reservado", 409, "Doação não reservada");
            ensure(alimento.data_vencimento >= v.today(), 409, "Alimento vencido");

            await db.execute(
                "UPDATE doacoes SET status = 'concluido' WHERE id_doacao = ?",
                [doacao.id_doacao]
            );

            await db.execute(
                "UPDATE alimentos SET status = 'doado' WHERE id_alimento = ?",
                [alimento.id_alimento]
            );
        }

        if (status === "recusada") {
            ensure(pedido.status === "pendente", 409, "Reserva não está pendente");
        }

        if (status === "cancelada") {
            ensure(
                ["pendente", "aprovada"].includes(pedido.status),
                409,
                "Reserva já encerrada"
            );

            if (pedido.status === "aprovada") {
                await db.execute(
                    "UPDATE doacoes SET status = 'disponivel' WHERE id_doacao = ?",
                    [doacao.id_doacao]
                );

                await db.execute(
                    "UPDATE alimentos SET status = 'disponivel' WHERE id_alimento = ?",
                    [alimento.id_alimento]
                );
            }
        }

        await db.execute(
            "UPDATE solicitacoes SET status = ? WHERE id_solicitacao = ?",
            [status, id]
        );

        await notify(db, ownerOf(pedido), `Solicitação ${status}: ${alimento.nome}`);
        await notify(db, ownerOf(doacao), `Solicitação ${status}: ${alimento.nome}`);

        pedido.status = status;

        return pedido;
    });
}

