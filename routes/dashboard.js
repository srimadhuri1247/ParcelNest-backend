const express = require("express");
const db = require("../config/db");
const { protect } = require("../middleware/auth");

const router = express.Router();

// GET dashboard statistics
router.get("/", protect, async (req, res) => {
  try {
    let whereClause = "";
    const params = [];

    // Users see parcels addressed to their registered email.
    // Managers and Admins see all parcels.
    if (req.user.role === "USER") {
      whereClause = "WHERE LOWER(receiver_email) = LOWER(?)";
      params.push(req.user.email);
    }

    const sql = `
      SELECT
        COUNT(*) AS totalParcels,

        COALESCE(
          SUM(
            CASE
              WHEN status = 'IN_TRANSIT' THEN 1
              ELSE 0
            END
          ),
          0
        ) AS inTransit,

        COALESCE(
          SUM(
            CASE
              WHEN status = 'DELIVERED' THEN 1
              ELSE 0
            END
          ),
          0
        ) AS delivered,

        COALESCE(
          SUM(
            CASE
              WHEN status IN (
                'REGISTERED',
                'COLLECTED',
                'OUT_FOR_DELIVERY'
              )
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS pending

      FROM parcels
      ${whereClause}
    `;

    const [rows] = await db.execute(sql, params);
    const row = rows[0];

    res.status(200).json({
      message: "Dashboard statistics retrieved successfully.",
      stats: {
        totalParcels: Number(row.totalParcels),
        inTransit: Number(row.inTransit),
        delivered: Number(row.delivered),
        pending: Number(row.pending),
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    res.status(500).json({
      message: "Unable to retrieve dashboard statistics.",
    });
  }
});

module.exports = router;
