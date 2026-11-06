
CREATE DATABASE IF NOT EXISTS TCC;
USE TCC;


CREATE TABLE IF NOT EXISTS conta_pessoal (
    id_pessoal INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    cpf VARCHAR(11) UNIQUE,
    num_telefone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    senha VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    usar_localizacao BOOLEAN DEFAULT FALSE,
    distancia_km INT DEFAULT 10
);


CREATE TABLE IF NOT EXISTS conta_empresarial (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    nome_empresa VARCHAR(150),
    cnpj_empresa VARCHAR(14) UNIQUE,
    num_telefone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    senha VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    usar_localizacao BOOLEAN DEFAULT FALSE,
    distancia_km INT DEFAULT 10
);


CREATE TABLE IF NOT EXISTS alimentos (
    id_alimento INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(110),
    tipo VARCHAR(100),
    status VARCHAR(100) DEFAULT 'disponivel',
    data_vencimento DATE,
    quantidade DECIMAL(12,3),
    unidade VARCHAR(30),
    id_pessoal INT,
    id_empresa INT,

    FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
    FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
);


CREATE TABLE IF NOT EXISTS doacoes (
    id_doacao INT AUTO_INCREMENT PRIMARY KEY,
    id_alimento INT,
    id_pessoal INT,
    id_empresa INT,
    data_doacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'disponivel',
    local_retirada VARCHAR(255),
    descricao VARCHAR(1000),

    FOREIGN KEY (id_alimento) REFERENCES alimentos(id_alimento),
    FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
    FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
);


CREATE TABLE IF NOT EXISTS solicitacoes (
    id_solicitacao INT AUTO_INCREMENT PRIMARY KEY,
    id_doacao INT,
    id_pessoal INT,
    id_empresa INT,
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pendente',

    FOREIGN KEY (id_doacao) REFERENCES doacoes(id_doacao),
    FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
    FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
);



CREATE TABLE IF NOT EXISTS sessoes (
    token_hash CHAR(64) PRIMARY KEY,
    id_pessoal INT,
    id_empresa INT,
    expira_em DATETIME NOT NULL,

    FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
    FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
);


CREATE TABLE IF NOT EXISTS notificacoes (
    id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
    id_pessoal INT,
    id_empresa INT,
    mensagem VARCHAR(500),
    lida BOOLEAN DEFAULT FALSE,
    criada_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
    FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
);
