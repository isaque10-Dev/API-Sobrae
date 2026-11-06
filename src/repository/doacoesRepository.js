
import { con } from "./connection.js";
import { today, page, text } from "../utils/validation.js";
import { ensure } from "../utils/errors.js";


// CONSULTA DOS DADOS DAS DOACOES

export const donationSelect = `
    SELECT
        d.*,
        a.nome,
        a.tipo AS categoria,
        a.tipo,
        a.data_vencimento,
        a.data_vencimento AS validade,
        a.quantidade,
        a.unidade,

        COALESCE(p.nome, e.nome_empresa) AS doador,

        CASE
            WHEN d.status IN ('disponivel', 'reservado')
            AND a.data_vencimento < ?
            THEN 'expirado'
            ELSE d.status
        END AS situacao

    FROM doacoes d

    JOIN alimentos a
    ON a.id_alimento = d.id_alimento

    LEFT JOIN conta_pessoal p
    ON p.id_pessoal = d.id_pessoal

    LEFT JOIN conta_empresarial e
    ON e.id_empresa = d.id_empresa
`;


// busca pelo id

export async function getDonation(id, db = con) {

    const sql = donationSelect + " WHERE d.id_doacao = ?";

    const [resultado] = await db.execute(sql, [
        today(),
        id
    ]);

    return resultado[0];
}


//listar

export async function listDonations(query, user) {

    const paginacao = page(query);

    let sql = donationSelect;
    const valores = [today()];

    // Mostra as doacoes do usuario logado
    if (user) {
        sql += ` WHERE d.${user.column} = ?`;

        valores.push(user.id);
    } else {
        // Mostra somente as doacoes publicas
        sql += `
            WHERE d.status = 'disponivel'
            AND a.data_vencimento >= ?
            AND (p.ativo = 1 OR e.ativo = 1)
        `;

        valores.push(today());
    }

//categoria filtro

    if (query.categoria) {
        if (query.categoria !== "Todos") {
            sql += " AND a.tipo = ?";

            valores.push(
                text(query.categoria, "Categoria", 100)
            );
        }
    }

//pesquisa nome

    if (query.busca) {
        sql += `
            AND (
                a.nome LIKE ?
                OR p.nome LIKE ?
                OR e.nome_empresa LIKE ?
            )
        `;

        const busca = "%" + text(query.busca, "Busca", 100) + "%";

        valores.push(busca);
        valores.push(busca);
        valores.push(busca);
    }

//filtrar
    if (query.status) {

        ensure(
            user,
            400,
            "O catalogo publico mostra somente doacoes disponiveis"
        );

        const statusPermitidos = [
            "disponivel",
            "reservado",
            "concluido",
            "cancelado"
        ];

        ensure(
            statusPermitidos.includes(query.status),
            400,
            "Status invalido"
        );

        sql += " AND d.status = ?";

        valores.push(query.status);
    }


    sql += `
        ORDER BY d.id_doacao DESC
        LIMIT ? OFFSET ?
    `;

    valores.push(paginacao.limite);
    valores.push(paginacao.offset);

    const [resultado] = await con.query(sql, valores);

    return resultado;
}


// BLOQUEAR DOACAO DURANTE UMA RESERVA

export async function lockDonation(db, id) {

    const sql = `
        SELECT * FROM doacoes
        WHERE id_doacao = ?
        FOR UPDATE
    `;

    const [resultado] = await db.execute(sql, [id]);

    ensure(
        resultado[0],
        404,
        "Doacao nao encontrada"
    );

    return resultado[0];
}
