import mariadb from 'mariadb';

async function main() {
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: 'localhost',
      user: 'tempuser',
      password: 'StrongPassword123',
      database: 'sampledb',
      port: 3306
    });

    console.log("Connected to MariaDB!");

    const res = await conn.query(
      "INSERT INTO users (name, email) VALUES (?, ?), (?, ?), (?, ?)",
      [
        "Abhishek", "abhishek@example.com",
        "Nikhil", "nikhil@example.com",
        "Riya", "riya@example.com"
      ]
    );

    console.log("Rows inserted:", res.affectedRows);

  } catch (err) {
    console.error("Error inserting data:", err);
  } finally {
    if (conn) conn.end();
  }
}

main();
