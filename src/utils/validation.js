
import { ensure } from "./errors.js";


// VERIFICAR OS DADOS RECEBIDOS

export function body(valor) {
    ensure(valor !== null, 400, "Envie um JSON válido");
    ensure(typeof valor === "object", 400, "Envie um JSON válido");
    ensure(Array.isArray(valor) === false, 400, "Envie um objeto JSON");

    return valor;
}


// VERIFICAR TEXTOS

export function text(valor, campo, max = 255, obrigatorio = true) {

    if (obrigatorio === false) {
        if (valor === undefined || valor === null || valor === "") {
            return null;
        }
    }

    ensure(typeof valor === "string", 400, campo + " inválido");

    const texto = valor.trim();

    ensure(texto.length > 0, 400, campo + " não pode estar vazio");
    ensure(texto.length <= max, 400, campo + " muito grande");

    return texto;
}


// VERIFICAR ID

export function id(valor, campo = "id") {

    const tipo = typeof valor;

    ensure(
        tipo === "string" || tipo === "number",
        400,
        campo + " inválido"
    );

    const texto = String(valor);

    ensure(/^[1-9]\d*$/.test(texto), 400, campo + " inválido");

    const numero = Number(texto);

    ensure(Number.isSafeInteger(numero), 400, campo + " inválido");

    return numero;
}


// VERIFICAR EMAIL

export function email(valor) {

    const resultado = text(valor, "E-mail", 150).toLowerCase();

    ensure(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resultado),
        400,
        "E-mail inválido"
    );

    return resultado;
}


// VERIFICAR SENHA

export function password(valor) {

    ensure(typeof valor === "string", 400, "Senha inválida");
    ensure(valor.length >= 8, 400, "A senha precisa ter 8 caracteres");
    ensure(valor.length <= 128, 400, "Senha muito grande");

    return valor;
}


// VERIFICAR TIPO DE CONTA

export function type(valor) {

    if (valor === "pessoa" || valor === "pessoal") {
        return "pessoa";
    }

    if (valor === "empresa" || valor === "empresarial") {
        return "empresa";
    }

    ensure(false, 400, "Tipo de conta inválido");
}


// CALCULAR DIGITO DO CPF OU CNPJ

function calcularDigito(numeros, pesos) {

    let soma = 0;

    for (let i = 0; i < pesos.length; i++) {
        soma = soma + Number(numeros[i]) * pesos[i];
    }

    const resto = soma % 11;

    if (resto < 2) {
        return 0;
    }

    return 11 - resto;
}


// VERIFICAR CPF OU CNPJ

export function document(valor, tipo, obrigatorio = false) {

    if (obrigatorio === false) {
        if (valor === undefined || valor === null || valor === "") {
            return null;
        }
    }

    ensure(typeof valor === "string", 400, tipo + " inválido");

    const numeros = valor.replace(/[.\-/\s]/g, "");

    let tamanho = 11;
    let peso1 = [10,9,8,7,6,5,4,3,2];
    let peso2 = [11,10,9,8,7,6,5,4,3,2];

    if (tipo === "CNPJ") {
        tamanho = 14;
        peso1 = [5,4,3,2,9,8,7,6,5,4,3,2];
        peso2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    }

    ensure(numeros.length === tamanho, 400, tipo + " inválido");
    ensure(/^\d+$/.test(numeros), 400, tipo + " inválido");

    // Não aceita todos os dígitos iguais
    let iguais = true;

    for (let i = 1; i < numeros.length; i++) {
        if (numeros[i] !== numeros[0]) {
            iguais = false;
        }
    }

    ensure(iguais === false, 400, tipo + " inválido");

    const primeiro = calcularDigito(numeros, peso1);
    const segundo = calcularDigito(numeros, peso2);

    ensure(
        primeiro === Number(numeros[numeros.length - 2]),
        400,
        tipo + " inválido"
    );

    ensure(
        segundo === Number(numeros[numeros.length - 1]),
        400,
        tipo + " inválido"
    );

    return numeros;
}


// PEGAR DATA ATUAL

export function today() {

    const data = new Date();

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(data);
}


// VERIFICAR VALIDADE DO ALIMENTO

export function date(valor) {

    ensure(typeof valor === "string", 400, "Data inválida");

    ensure(
        /^\d{4}-\d{2}-\d{2}$/.test(valor),
        400,
        "Use o formato AAAA-MM-DD"
    );

    const data = new Date(valor + "T00:00:00Z");

    ensure(
        Number.isNaN(data.getTime()) === false,
        400,
        "Data inválida"
    );

    ensure(
        data.toISOString().slice(0, 10) === valor,
        400,
        "Data inválida"
    );

    ensure(valor >= today(), 400, "O alimento está vencido");

    return valor;
}


// VERIFICAR ALIMENTO

export function food(input, previous = {}) {

    body(input);

    let nome = previous.nome;
    let categoria = previous.tipo;
    let validade = previous.data_vencimento;
    let quantidade = previous.quantidade;
    let unidade = previous.unidade;

    if (input.nome !== undefined) {
        nome = input.nome;
    }

    if (input.tipo !== undefined && input.tipo !== null) {
        categoria = input.tipo;
    }

    if (input.categoria !== undefined && input.categoria !== null) {
        categoria = input.categoria;
    }

    if (input.data_vencimento !== undefined && input.data_vencimento !== null) {
        validade = input.data_vencimento;
    }

    if (input.validade !== undefined && input.validade !== null) {
        validade = input.validade;
    }

    if (input.quantidade !== undefined) {
        quantidade = input.quantidade;
    }

    if (input.unidade !== undefined) {
        unidade = input.unidade;
    }

    // Permitir quantidade como "5 kg" ou "2,5 kg"
    if (typeof quantidade === "string") {

        const resultado = quantidade.trim().match(
            /^(\d+(?:[.,]\d{1,3})?)\s*([\p{L}\s]+)?$/u
        );

        ensure(resultado, 400, "Quantidade inválida");

        quantidade = Number(resultado[1].replace(",", "."));

        if (resultado[2]) {
            unidade = resultado[2].trim();
        }
    }

    ensure(typeof quantidade === "number", 400, "Quantidade inválida");
    ensure(Number.isFinite(quantidade), 400, "Quantidade inválida");
    ensure(quantidade > 0, 400, "Quantidade deve ser positiva");
    ensure(quantidade <= 999999, 400, "Quantidade muito grande");

    const casas = quantidade * 1000;

    ensure(
        Math.abs(casas - Math.round(casas)) < 0.0000001,
        400,
        "Use no máximo 3 casas decimais"
    );

    return {
        nome: text(nome, "Nome", 110),
        tipo: text(categoria, "Categoria", 100),
        data_vencimento: date(validade),
        quantidade: quantidade,
        unidade: text(unidade || "unidades", "Unidade", 30)
    };
}


// ORGANIZAR PAGINAS DAS LISTAS

export function page(query) {

    let pagina = 1;
    let limite = 20;

    if (query.pagina !== undefined) {
        pagina = id(query.pagina, "pagina");
    }

    if (query.limite !== undefined) {
        limite = id(query.limite, "limite");
    }

    ensure(pagina <= 1000000, 400, "Página inválida");
    ensure(limite <= 100, 400, "O limite máximo é 100");

    const offset = (pagina - 1) * limite;

    return {
        pagina: pagina,
        limite: limite,
        offset: offset
    };
}
