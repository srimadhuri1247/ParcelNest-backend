
require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../config/db");

const demoUsers = [
  {
    name: "ParcelNest User",
    email: "user@parcelnest.test",
    password: "UserDemo123!",
    role: "USER",
  },
  {
    name: "ParcelNest Manager",
    email: "manager@parcelnest.test",
    password: "ManagerDemo123!",
    role: "MANAGER",
  },
  {
    name: "ParcelNest Admin",
    email: "admin@parcelnest.test",
    password: "AdminDemo123!",
    role: "ADMIN",
  },
];

async function seedUsers() {
  try {
    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      await db.execute(
        `INSERT INTO users
          (name, email, password_hash, role, active)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           active = TRUE`,
        [
          user.name,
          user.email,
          passwordHash,
          user.role,
        ]
      );

      console.log(`Created/updated: ${user.email}`);
    }

    console.log("Demo users are ready.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

seedUsers();
