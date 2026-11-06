
import { con } from "./connection.js";


// CADASTRAR ALIMENTO

export async function saveAlimento(alimento, user, db = con) {

    const sql = `
        INSERT INTO alimentos
        (nome, tipo, status, data_vencimento, quantidade, unidade, ${user.column})
        VALUES (?, ?, 'disponivel', ?, ?, ?, ?)
    `;

    const [resultado] = await db.execute(sql, [
        alimento.nome,
        alimento.tipo,
        alimento.data_vencimento,
        alimento.quantidade,
        alimento.unidade,
        user.id
    ]);

    return resultado.insertId;
}


// BUSCAR ALIMENTO PELO ID

export async function getAlimentos(id, db = con, lock = false) {

    let sql = `
        SELECT * FROM alimentos
        WHERE id_alimento = ?
    `;

    if (lock === true) {
        sql += " FOR UPDATE";
    }

    const [resultado] = await db.execute(sql, [id]);

    return resultado[0];
}


// LISTAR ALIMENTOS DO USUARIO

export async function listAlimentos(user, paginacao) {

    const sql = `
        SELECT * FROM alimentos
        WHERE ${user.column} = ?
        ORDER BY id_alimento DESC
        LIMIT ? OFFSET ?
    `;

    const [resultado] = await con.query(sql, [
        user.id,
        paginacao.limite,
        paginacao.offset
    ]);

    return resultado;
}


// EDITAR ALIMENTO

export async function updateAlimento(id, alimento, db = con) {

    const sql = `
        UPDATE alimentos
        SET nome = ?,
            tipo = ?,
            data_vencimento = ?,
            quantidade = ?,
            unidade = ?
        WHERE id_alimento = ?
    `;

    await db.execute(sql, [
        alimento.nome,
        alimento.tipo,
        alimento.data_vencimento,
        alimento.quantidade,
        alimento.unidade,
        id
    ]);
}
