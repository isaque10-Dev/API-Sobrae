import { con } from './connection.js';

export async function saveAlimento(alimento) {
    const command = `
        INSERT INTO alimentos (nome, quantidade)
        VALUES (?, ?)
    `;

    const [result] = await con.query(command, [
        alimento.nome,
        alimento.quantidade
    ]);

    return result.insertId;
}

export async function getAlimentos(id) {
    const command = `
        SELECT *
        FROM alimentos
        WHERE id_alimento = ?
    `;

    const [linhas] = await con.query(command, [id]);

    return linhas[0];
}

export async function listAlimentos() {
    const command = `
        SELECT *
        FROM alimentos
    `;

    const [linhas] = await con.query(command, []);

    return linhas;
}
