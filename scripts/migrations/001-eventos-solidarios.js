// Migração incremental: não remove nem altera registros já existentes.
export async function migrateEventosSolidarios(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS propostas_eventos (
      id_proposta_evento INT AUTO_INCREMENT PRIMARY KEY,
      id_pessoal INT NULL,
      id_empresa INT NULL,
      tipo_organizador VARCHAR(20) NOT NULL,
      nome_organizacao VARCHAR(150) NULL,
      nome_responsavel VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      telefone VARCHAR(30) NOT NULL,
      nome_evento VARCHAR(150) NOT NULL,
      proposta TEXT NOT NULL,
      alimentos TEXT NOT NULL,
      publico_estimado INT NOT NULL,
      endereco VARCHAR(255) NOT NULL,
      cidade VARCHAR(100) NOT NULL,
      estado CHAR(2) NOT NULL,
      data_evento DATE NOT NULL,
      horario_evento TIME NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      justificativa VARCHAR(1000) NULL,
      id_analista_pessoal INT NULL,
      id_analista_empresa INT NULL,
      criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      analisada_em DATETIME NULL,
      FOREIGN KEY (id_pessoal) REFERENCES conta_pessoal(id_pessoal),
      FOREIGN KEY (id_empresa) REFERENCES conta_empresarial(id_empresa),
      FOREIGN KEY (id_analista_pessoal) REFERENCES conta_pessoal(id_pessoal),
      FOREIGN KEY (id_analista_empresa) REFERENCES conta_empresarial(id_empresa),
      INDEX idx_propostas_eventos_autor_pessoal (id_pessoal),
      INDEX idx_propostas_eventos_autor_empresa (id_empresa),
      INDEX idx_propostas_eventos_status (status)
    )
  `);
}
