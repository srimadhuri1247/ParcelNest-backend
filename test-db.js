require("dotenv").config();

const db = require("./config/db");

async function testConnection() {
  try {
    const [rows] = await db.query(
      "SELECT DATABASE() AS databaseName"
    );

    console.log("MySQL connected successfully!");
    console.log("Database:", rows[0].databaseName);

    const [tables] = await db.query("SHOW TABLES");
    console.log("Tables:", tables);
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
  } finally {
    await db.end();
  }
}

testConnection();
