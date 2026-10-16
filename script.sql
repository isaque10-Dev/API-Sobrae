create database TCC_alimento;
use TCC_alimento;



CREATE TABLE conta_pessoal (
    id_pessoal INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    cpf VARCHAR(11) UNIQUE,
    num_telefone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    senha VARCHAR(255)
);



CREATE TABLE conta_empresarial (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    nome_empresa VARCHAR(150),
    cnpj_empresa VARCHAR(14) UNIQUE,
    num_telefone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    senha VARCHAR(255)
);



CREATE TABLE status_empresa (
    id_status INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa INT,
    total_arrecadado INT DEFAULT 0,
    doacao_total INT DEFAULT 0,
    ativo BOOLEAN,

    FOREIGN KEY (id_empresa)
    REFERENCES conta_empresarial(id_empresa)
);



CREATE TABLE status_pessoal (
    id_status INT AUTO_INCREMENT PRIMARY KEY,
    id_pessoal INT,
    total_arrecadado INT DEFAULT 0,
    doacao_total INT DEFAULT 0,
    ativo BOOLEAN ,

    FOREIGN KEY (id_pessoal)
    REFERENCES conta_pessoal(id_pessoal)
);



CREATE TABLE alimentos (
    id_alimento INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(110),
    tipo VARCHAR(100),
    status VARCHAR(100),
    data_vencimento DATE,
    quantidade INT,
    unidade VARCHAR(30)
);



CREATE TABLE doacoes (
    id_doacao INT AUTO_INCREMENT PRIMARY KEY,
    id_alimento INT,
    id_pessoal INT,
    id_empresa INT,
    data_doacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'disponivel',

    FOREIGN KEY (id_alimento)
    REFERENCES alimentos(id_alimento),

    FOREIGN KEY (id_pessoal)
    REFERENCES conta_pessoal(id_pessoal),

    FOREIGN KEY (id_empresa)
    REFERENCES conta_empresarial(id_empresa)
);




CREATE TABLE solicitacoes (
    id_solicitacao INT AUTO_INCREMENT PRIMARY KEY,
    id_doacao INT,
    id_pessoal INT,
    id_empresa INT,
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pendente',

    FOREIGN KEY (id_doacao)
    REFERENCES doacoes(id_doacao),

    FOREIGN KEY (id_pessoal)
    REFERENCES conta_pessoal(id_pessoal),

    FOREIGN KEY (id_empresa)
    REFERENCES conta_empresarial(id_empresa)
);  