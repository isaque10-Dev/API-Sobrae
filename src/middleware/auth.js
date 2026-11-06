
import { con } from "../repository/connection.js";
import { tokenHash } from "../utils/security.js";
import { ensure } from "../utils/errors.js";
import { accountConfig } from "../repository/contasRepository.js";



export async function authenticate(req, res, next) {

    // Recebe o token enviado pelo usuario
    const autorizacao = req.headers.authorization;

    ensure(
        typeof autorizacao === "string",
        401,
        "Entre na sua conta para continuar"
    );

    const partes = autorizacao.split(" ");

    ensure(partes.length === 2, 401, "Token invalido");
    ensure(partes[0] === "Bearer", 401, "Token invalido");

    const token = partes[1];

    ensure(token.length === 64, 401, "Token invalido");

    // Protege o token antes de consultar o banco
    const hash = tokenHash(token);

    const sql = `
        SELECT * FROM sessoes
        WHERE token_hash = ?
        AND expira_em > UTC_TIMESTAMP()
    `;

    const [resultado] = await con.execute(sql, [hash]);

    ensure(
        resultado.length > 0,
        401,
        "Sessao invalida ou expirada"
    );

    const sessao = resultado[0];

 // descobre conta pessoal ou empresarial
    let tipo = "empresa";

    if (sessao.id_pessoal !== null) {
        tipo = "pessoa";
    }

    const cfg = accountConfig(tipo);
    const codigo = sessao[cfg.id];

// Verifica se a conta continua ativa
    const sqlConta = `
        SELECT ${cfg.id} FROM ${cfg.table}
        WHERE ${cfg.id} = ?
        AND ativo = 1
    `;

    const [contas] = await con.execute(sqlConta, [codigo]);

    ensure(
        contas.length > 0,
        401,
        "Conta indisponivel"
    );

//guarda dados
    req.user = {
        id: codigo,
        tipo: tipo,
        column: cfg.id,
        tokenHash: hash
    };

    next();
}











// Limitar login e cadastro

export function authRateLimit() {

    const clientes = new Map();

    return function (req, res, next) {

        const agora = Date.now();
        const ip = req.ip;

        for (const endereco of clientes.keys()) {
            const dados = clientes.get(endereco);

            if (dados.ate <= agora) {
                clientes.delete(endereco);
            }
        }

        let dados = clientes.get(ip);

        if (dados === undefined) {
            dados = {
                tentativas: 0,
                ate: agora + 15 * 60 * 1000
            };
        }

        dados.tentativas = dados.tentativas + 1;

        clientes.set(ip, dados);

        // Bloqueia excesso de tentativas
        if (dados.tentativas > 30) {

            const segundos = Math.ceil(
                (dados.ate - agora) / 1000
            );

            res.setHeader("Retry-After", segundos);

            return res.status(429).json({
                erro: "Muitas tentativas. Aguarde alguns minutos."
            });
        }

        next();
    };
}
