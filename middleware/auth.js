const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function protect(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Please log in first.",
    });
  }

  let decoded;

  try {
    const token = header.slice(7);
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired login token.",
    });
  }

  try {
    const [users] = await db.execute(
      `SELECT id, name, email, role, active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].active) {
      return res.status(401).json({
        message: "User account is unavailable.",
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error("Authentication database error:", error.message);
    return res.status(500).json({
      message: "Unable to verify authentication.",
    });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

module.exports = { protect, allowRoles };
