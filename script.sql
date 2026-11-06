CREATE DATABASE IF NOT EXISTS TCC_alimento CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE TCC_alimento;

CREATE TABLE IF NOT EXISTS conta_pessoal (
  id_pessoal INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100), cpf VARCHAR(11) UNIQUE, num_telefone VARCHAR(20),
  email VARCHAR(150) UNIQUE, senha VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  usar_localizacao BOOLEAN NOT NULL DEFAULT FALSE,
  distancia_km INT NOT NULL DEFAULT 10
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conta_empresarial (
  id_empresa INT AUTO_INCREMENT PRIMARY KEY,
  nome_empresa VARCHAR(150), cnpj_empresa VARCHAR(14) UNIQUE, num_telefone VARCHAR(20),
  email VARCHAR(150) UNIQUE, senha VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  usar_localizacao BOOLEAN NOT NULL DEFAULT FALSE,
  distancia_km INT NOT NULL DEFAULT 10
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS status_empresa (
  id_status INT AUTO_INCREMENT PRIMARY KEY, id_empresa INT,
  total_arrecadado INT DEFAULT 0, doacao_total INT DEFAULT 0, ativo BOOLEAN,
  FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS status_pessoal (
  id_status INT AUTO_INCREMENT PRIMARY KEY, id_pessoal INT,
  total_arrecadado INT DEFAULT 0, doacao_total INT DEFAULT 0, ativo BOOLEAN,
  FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alimentos (
  id_alimento INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(110), tipo VARCHAR(100), status VARCHAR(100) DEFAULT 'disponivel',
  data_vencimento DATE, quantidade DECIMAL(12,3), unidade VARCHAR(30),
  id_pessoal INT, id_empresa INT,
  FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
  FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doacoes (
  id_doacao INT AUTO_INCREMENT PRIMARY KEY,
  id_alimento INT, id_pessoal INT, id_empresa INT,
  data_doacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'disponivel',
  local_retirada VARCHAR(255), descricao VARCHAR(1000),
  FOREIGN KEY (id_alimento) REFERENCES alimentos(id_alimento),
  FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
  FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS solicitacoes (
  id_solicitacao INT AUTO_INCREMENT PRIMARY KEY,
  id_doacao INT, id_pessoal INT, id_empresa INT,
  data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pendente',
  FOREIGN KEY (id_doacao) REFERENCES doacoes(id_doacao),
  FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
  FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash CHAR(64) PRIMARY KEY,
  id_pessoal INT, id_empresa INT,
  expira_em DATETIME NOT NULL,
  FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
  FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa),
  INDEX ix_sessoes_expira (expira_em),
  CHECK ((id_pessoal IS NOT NULL) + (id_empresa IS NOT NULL) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notificacoes (
  id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
  id_pessoal INT, id_empresa INT,
  mensagem VARCHAR(500) NOT NULL, lida BOOLEAN NOT NULL DEFAULT FALSE,
  criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
  FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa),
  CHECK ((id_pessoal IS NOT NULL) + (id_empresa IS NOT NULL) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
