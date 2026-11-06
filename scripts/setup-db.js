import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config } from '../src/config.js';
import { hashPassword } from '../src/utils/security.js';

export async function setupDatabase(settings = config.db) {
  if (!/^[A-Za-z0-9_]+$/.test(settings.database)) throw new Error('DB_NAME deve conter apenas letras, números e sublinhado.');
  const { database, ...serverSettings } = settings;
  const db = await mysql.createConnection(serverSettings);
  try {
    await db.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await db.query(`USE \`${database}\``);
    const source = await readFile(new URL('../script.sql', import.meta.url), 'utf8');
    for (const statement of source.split(';').map(s => s.trim()).filter(Boolean)) {
      if (!/^(CREATE DATABASE|USE )/i.test(statement)) await db.query(statement);
    }
    // Compatibilidade com o script.sql antigo: acrescenta campos sem apagar dados.
    const columns = {
      conta_pessoal: { ativo: 'BOOLEAN NOT NULL DEFAULT TRUE', usar_localizacao: 'BOOLEAN NOT NULL DEFAULT FALSE', distancia_km: 'INT NOT NULL DEFAULT 10' },
      conta_empresarial: { ativo: 'BOOLEAN NOT NULL DEFAULT TRUE', usar_localizacao: 'BOOLEAN NOT NULL DEFAULT FALSE', distancia_km: 'INT NOT NULL DEFAULT 10' },
      alimentos: { id_pessoal: 'INT NULL', id_empresa: 'INT NULL' },
      doacoes: { local_retirada: 'VARCHAR(255) NULL', descricao: 'VARCHAR(1000) NULL' },
    };
    for (const [table, fields] of Object.entries(columns)) {
      for (const [column, definition] of Object.entries(fields)) {
        const [rows] = await db.execute('SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?', [database, table, column]);
        if (!rows.length) await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }
    const [quantity] = await db.execute("SELECT DATA_TYPE AS data_type FROM information_schema.columns WHERE table_schema = ? AND table_name = 'alimentos' AND column_name = 'quantidade'", [database]);
    if (quantity[0]?.data_type === 'int') await db.query('ALTER TABLE alimentos MODIFY quantidade DECIMAL(12,3)');
    // Contas antigas mantêm a mesma senha, agora armazenada como hash.
    for (const [table, key] of [['conta_pessoal', 'id_pessoal'], ['conta_empresarial', 'id_empresa']]) {
      const [rows] = await db.query(`SELECT ${key}, senha FROM ${table} WHERE senha IS NOT NULL AND senha <> ''`);
      for (const row of rows) {
        if (!row.senha.startsWith('scrypt$')) await db.execute(`UPDATE ${table} SET senha = ? WHERE ${key} = ? AND senha = ?`, [await hashPassword(row.senha), row[key], row.senha]);
      }
    }
  } finally { await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setupDatabase().then(() => console.log('Banco do Sobraê preparado. Dados existentes preservados.')).catch(error => {
    console.error('Não foi possível preparar o banco:', error.code || error.message);
    process.exitCode = 1;
  });
}
