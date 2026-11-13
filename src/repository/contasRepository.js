
import { con } from "./connection.js";
import { ensure } from "../utils/errors.js";
import { isAdmin } from "../utils/admin.js";


// IDENTIFICAR O TIPO DE CONTA

export function accountConfig(tipo) {

    if (tipo === "pessoa") {
        return {
            table: "conta_pessoal",
            id: "id_pessoal",
            name: "nome",
            document: "cpf"
        };
    }

    if (tipo === "empresa") {
        return {
            table: "conta_empresarial",
            id: "id_empresa",
            name: "nome_empresa",
            document: "cnpj_empresa"
        };
    }

    ensure(false, 400, "Tipo de conta inválido");
}


// BUSCAR UMA CONTA NO MYSQL

export async function findAccount(tipo, id, db = con, lock = false) {

    const cfg = accountConfig(tipo);

    let sql = `
        SELECT * FROM ${cfg.table}
        WHERE ${cfg.id} = ?
    `;

    if (lock === true) {
        sql += " FOR UPDATE";
    }

    const [resultado] = await db.execute(sql, [id]);

    return resultado[0];
}


// RETORNAR DADOS DA CONTA

export function publicAccount(tipo, conta) {

    const cfg = accountConfig(tipo);

    const dados = {
        id: conta[cfg.id],
        tipo: tipo,
        nome: conta[cfg.name],
        email: conta.email,
        num_telefone: conta.num_telefone,
        ativo: Boolean(conta.ativo),
        administrador: isAdmin(tipo, conta[cfg.id]),
        usar_localizacao: Boolean(conta.usar_localizacao),
        distancia_km: conta.distancia_km
    };

    if (tipo === "pessoa") {
        dados.id_pessoal = conta.id_pessoal;
        dados.cpf = conta.cpf;
    }

    if (tipo === "empresa") {
        dados.id_empresa = conta.id_empresa;
        dados.nome_empresa = conta.nome_empresa;
        dados.cnpj_empresa = conta.cnpj_empresa;
    }

    return dados;
}


// CRIAR NOTIFICACAO

export async function notify(db, user, mensagem) {

    const sql = `
        INSERT INTO notificacoes
        (${user.column}, mensagem)
        VALUES (?, ?)
    `;

    await db.execute(sql, [user.id, mensagem]);
}


// IDENTIFICAR O DONO DE UMA DOACAO

export function ownerOf(conta) {

    if (conta.id_pessoal) {
        return {
            id: conta.id_pessoal,
            tipo: "pessoa",
            column: "id_pessoal"
        };
    }

    return {
        id: conta.id_empresa,
        tipo: "empresa",
        column: "id_empresa"
    };
}


// VERIFICAR SE O USUARIO E O DONO

export function isOwner(conta, user) {

    if (conta[user.column] === user.id) {
        return true;
    }

    return false;
}
