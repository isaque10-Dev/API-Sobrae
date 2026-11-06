import mysql from 'mysql2/promise';
import { config } from '../config.js';

export const con = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 10 });

export async function transaction(work) {
  const connection = await con.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
