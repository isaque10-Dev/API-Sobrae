
import { con, transaction } from "../repository/connection.js";
import { accountConfig, findAccount, publicAccount } from "../repository/contasRepository.js";
import * as v from "../utils/validation.js";
import { ensure } from "../utils/errors.js";
import { hashPassword, verifyPassword, newToken, tokenHash } from "../utils/security.js";
import { config } from "../config.js";



async function session(db, tipo, conta) {
    const cfg = accountConfig(tipo);
    const token = newToken();

    await db.execute(
        "DELETE FROM sessoes WHERE expira_em <= UTC_TIMESTAMP()"
    );

    const sql = `
        INSERT INTO sessoes (token_hash, ${cfg.id}, expira_em)
        VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))
    `;

    await db.execute(sql, [
        tokenHash(token),
        conta[cfg.id],
        config.sessionHours
    ]);

    const expiracao = new Date(
        Date.now() + config.sessionHours * 3600000
    ).toISOString();

    return {
        token: token,
        expira_em: expiracao,
        usuario: publicAccount(tipo, conta)
    };
}



export async function register(input, forcedType) {
    v.body(input);

    let tipo = input.tipo;

    if (forcedType) {
        tipo = forcedType;
    }

    tipo = v.type(tipo);

    const cfg = accountConfig(tipo);

    let nome = input[cfg.name];

    if (nome === undefined || nome === null) {
        nome = input.nome;
    }

    let documento = input[cfg.document];

    if (documento === undefined || documento === null) {
        documento = input.documento;
    }

    let tamanhoNome = 100;
    let tipoDocumento = "CPF";
    let documentoObrigatorio = false;

    if (tipo === "empresa") {
        tamanhoNome = 150;
        tipoDocumento = "CNPJ";
        documentoObrigatorio = true;
    }

    nome = v.text(nome, "Nome", tamanhoNome);

    documento = v.document(
        documento,
        tipoDocumento,
        documentoObrigatorio
    );

    const email = v.email(input.email);
    const telefone = v.text(input.num_telefone, "Telefone", 20, false);
    const senha = await hashPassword(v.password(input.senha));

    return transaction(async (db) => {
        const sql = `
            INSERT INTO ${cfg.table}
            (${cfg.name}, ${cfg.document}, num_telefone, email, senha)
            VALUES (?, ?, ?, ?, ?)
        `;

        const [resultado] = await db.execute(sql, [
            nome,
            documento,
            telefone,
            email,
            senha
        ]);

        const conta = await findAccount(
            tipo,
            resultado.insertId,
            db
        );

        return session(db, tipo, conta);
    });
}



export async function login(input) {
    v.body(input);

    const email = v.email(input.email);
    const senha = input.senha;

    ensure(
        typeof senha === "string",
        400,
        "Informe uma senha válida"
    );

    ensure(
        senha.length > 0 && senha.length <= 128,
        400,
        "Informe a senha (até 128 caracteres)"
    );

    let tipos = ["pessoa", "empresa"];

    if (input.tipo) {
        tipos = [v.type(input.tipo)];
    }

    return transaction(async (db) => {
        const contas = [];

        for (const tipo of tipos) {
            const cfg = accountConfig(tipo);

            const sql = `
                SELECT * FROM ${cfg.table}
                WHERE email = ? AND ativo = 1
                FOR UPDATE
            `;

            const [resultado] = await db.execute(sql, [email]);

            if (resultado.length > 0) {
                contas.push({
                    tipo: tipo,
                    conta: resultado[0]
                });
            }
        }

        ensure(
            contas.length <= 1,
            400,
            "Informe se sua conta é pessoal ou empresarial"
        );

        if (contas.length === 0) {
            await hashPassword(senha);
            ensure(false, 401, "E-mail ou senha incorretos");
        }

        const usuario = contas[0];

        const senhaCorreta = await verifyPassword(
            senha,
            usuario.conta.senha
        );

        ensure(senhaCorreta, 401, "E-mail ou senha incorretos");

        return session(db, usuario.tipo, usuario.conta);
    });
}



export async function profile(user) {
    const conta = await findAccount(user.tipo, user.id);

    ensure(conta, 404, "Conta não encontrada");

    return publicAccount(user.tipo, conta);
}



export async function updateProfile(user, input) {
    v.body(input);

    if (input.tipo !== undefined) {
        ensure(
            v.type(input.tipo) === user.tipo,
            400,
            "Não é possível mudar o tipo da conta"
        );
    }

    const cfg = accountConfig(user.tipo);
    const alteracoes = {};

    if (input.nome !== undefined || input[cfg.name] !== undefined) {
        let nome = input[cfg.name];

        if (nome === undefined || nome === null) {
            nome = input.nome;
        }

        let tamanho = 100;

        if (user.tipo === "empresa") {
            tamanho = 150;
        }

        alteracoes[cfg.name] = v.text(nome, "Nome", tamanho);
    }

    if (input.email !== undefined) {
        alteracoes.email = v.email(input.email);
    }

    if (input.num_telefone !== undefined) {
        alteracoes.num_telefone = v.text(
            input.num_telefone,
            "Telefone",
            20,
            false
        );
    }

    if (input[cfg.document] !== undefined) {
        let documento = "CPF";
        let obrigatorio = false;

        if (user.tipo === "empresa") {
            documento = "CNPJ";
            obrigatorio = true;
        }

        alteracoes[cfg.document] = v.document(
            input[cfg.document],
            documento,
            obrigatorio
        );
    }

    if (input.usar_localizacao !== undefined) {
        ensure(
            typeof input.usar_localizacao === "boolean",
            400,
            "Localização inválida"
        );

        alteracoes.usar_localizacao = input.usar_localizacao;
    }

    if (input.distancia_km !== undefined) {
        ensure(
            [5, 10, 20].includes(input.distancia_km),
            400,
            "Distância inválida"
        );

        alteracoes.distancia_km = input.distancia_km;
    }

    ensure(
        Object.keys(alteracoes).length > 0,
        400,
        "Informe o que deseja alterar"
    );

    return transaction(async (db) => {
        const conta = await findAccount(
            user.tipo,
            user.id,
            db,
            true
        );

        if (alteracoes.email !== undefined) {
            if (alteracoes.email !== conta.email) {
                const senhaCorreta = await verifyPassword(
                    input.senha_atual,
                    conta.senha
                );

                ensure(senhaCorreta, 403, "Senha atual incorreta");
            }
        }

        const campos = [];
        const valores = [];

        for (const campo of Object.keys(alteracoes)) {
            campos.push(campo + " = ?");
            valores.push(alteracoes[campo]);
        }

        valores.push(user.id);

        const sql = `
            UPDATE ${cfg.table}
            SET ${campos.join(", ")}
            WHERE ${cfg.id} = ?
        `;

        await db.execute(sql, valores);

        const atualizado = await findAccount(
            user.tipo,
            user.id,
            db
        );

        return publicAccount(user.tipo, atualizado);
    });
}



export async function changePassword(user, input) {
    v.body(input);

    const novaSenha = v.password(input.nova_senha);
    const senhaProtegida = await hashPassword(novaSenha);
    const cfg = accountConfig(user.tipo);

    await transaction(async (db) => {
        const conta = await findAccount(
            user.tipo,
            user.id,
            db,
            true
        );

        const senhaCorreta = await verifyPassword(
            input.senha_atual,
            conta.senha
        );

        ensure(senhaCorreta, 403, "Senha atual incorreta");

        await db.execute(
            `UPDATE ${cfg.table} SET senha = ? WHERE ${cfg.id} = ?`,
            [senhaProtegida, user.id]
        );

        await db.execute(
            `DELETE FROM sessoes WHERE ${cfg.id} = ?`,
            [user.id]
        );
    });
}




export async function logout(user) {
    await con.execute(
        "DELETE FROM sessoes WHERE token_hash = ?",
        [user.tokenHash]
    );
}
