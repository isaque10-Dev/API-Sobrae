
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { hashPassword } from "../src/utils/security.js";

export async function setupDatabase(settings = config.db) {

    if (!/^[A-Za-z0-9_]+$/.test(settings.database)) {
        throw new Error("Nome do banco inválido");
    }

    const { database, ...serverSettings } = settings;

    const db = await mysql.createConnection(serverSettings);

    try {

        // CRIAR O BANCO
        await db.query(
            `CREATE DATABASE IF NOT EXISTS \`${database}\``
        );

        await db.query(`USE \`${database}\``);


        // LER O SCRIPT SQL
        const source = await readFile(
            new URL("../script.sql", import.meta.url),
            "utf8"
        );

        // REMOVER COMENTARIOS
        const codigo = source.replace(/--[^\r\n]*/g, "");

        // CRIAR AS TABELAS
        const comandos = codigo.split(";");

        for (const comando of comandos) {

            const sql = comando.trim();

            if (/^CREATE TABLE\b/i.test(sql)) {
                await db.query(sql);
            }

        }


        // ADICIONAR COLUNAS QUE FALTAM
        const columns = {
            conta_pessoal: {
                ativo: "BOOLEAN NOT NULL DEFAULT TRUE",
                usar_localizacao: "BOOLEAN NOT NULL DEFAULT FALSE",
                distancia_km: "INT NOT NULL DEFAULT 10"
            },

            conta_empresarial: {
                ativo: "BOOLEAN NOT NULL DEFAULT TRUE",
                usar_localizacao: "BOOLEAN NOT NULL DEFAULT FALSE",
                distancia_km: "INT NOT NULL DEFAULT 10"
            },

            alimentos: {
                id_pessoal: "INT NULL",
                id_empresa: "INT NULL"
            },

            doacoes: {
                local_retirada: "VARCHAR(255) NULL",
                descricao: "VARCHAR(1000) NULL",
                imagem: "VARCHAR(255) NULL"
            }
        };

        for (const [tabela, campos] of Object.entries(columns)) {

            for (const [coluna, definicao] of Object.entries(campos)) {

                const sql = `
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = ?
                    AND table_name = ?
                    AND column_name = ?
                `;

                const [resultado] = await db.execute(sql, [
                    database,
                    tabela,
                    coluna
                ]);

                if (resultado.length === 0) {
                    await db.query(
                        `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`
                    );
                }
            }
        }


        // PERMITIR QUANTIDADES DECIMAIS
        const [quantidade] = await db.execute(
            `SELECT DATA_TYPE AS tipo
             FROM information_schema.columns
             WHERE table_schema = ?
             AND table_name = 'alimentos'
             AND column_name = 'quantidade'`,
            [database]
        );

        if (quantidade[0].tipo === "int") {
            await db.query(
                "ALTER TABLE alimentos MODIFY quantidade DECIMAL(12,3)"
            );
        }


        // PROTEGER SENHAS ANTIGAS
        const tabelas = [
            ["conta_pessoal", "id_pessoal"],
            ["conta_empresarial", "id_empresa"]
        ];

        for (const [tabela, coluna] of tabelas) {

            const [usuarios] = await db.query(
                `SELECT ${coluna}, senha
                 FROM ${tabela}
                 WHERE senha IS NOT NULL AND senha <> ''`
            );

            for (const usuario of usuarios) {

                if (!usuario.senha.startsWith("scrypt$")) {

                    const senha = await hashPassword(usuario.senha);

                    await db.execute(
                        `UPDATE ${tabela}
                         SET senha = ?
                         WHERE ${coluna} = ? AND senha = ?`,
                        [senha, usuario[coluna], usuario.senha]
                    );
                }
            }
        }

    } finally {
        await db.end();
    }
}


// EXECUTAR PELO TERMINAL
if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    setupDatabase()
        .then(() => {
            console.log("Banco do Sobraê preparado!");
        })
        .catch((erro) => {
            console.error("Erro ao preparar banco:", erro);
            process.exitCode = 1;
        });
}
