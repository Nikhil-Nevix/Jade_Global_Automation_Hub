import mariadb from 'mariadb';

async function main() {
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: 'localhost',
      user: 'tempuser',
      password: 'StrongPassword123',
      port: 3306
    });

    console.log("Connected to MariaDB!");

    await conn.query("CREATE DATABASE IF NOT EXISTS sampledb");
    console.log("Database created or already exists.");

    await conn.query("USE sampledb");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE
      )
    `);
    console.log("Table created or already exists.");
  } catch (err) {
    console.error("Error: ", err);
  } finally {
    if (conn) conn.end();
  }
}

main();
