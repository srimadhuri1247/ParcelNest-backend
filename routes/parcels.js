
const express = require("express");
const crypto = require("crypto");
const db = require("../config/db");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();

const VALID_STATUSES = [
  "REGISTERED",
  "COLLECTED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

// GET /api/parcels
// USER sees parcels addressed to their email.
// MANAGER and ADMIN see all parcels.
router.get("/", protect, async (req, res) => {
  try {
    let sql = `
      SELECT
        p.id,
        p.tracking_number,
        p.sender_name,
        p.sender_phone,
        p.receiver_name,
        p.receiver_phone,
        p.receiver_email,
        p.sender_address,
        p.receiver_address,
        p.parcel_type,
        p.weight,
        p.status,
        p.created_by,
        p.assigned_to,
        p.created_at,
        p.updated_at
      FROM parcels p
    `;

    const params = [];

    if (req.user.role === "USER") {
      sql += " WHERE LOWER(p.receiver_email) = LOWER(?)";
      params.push(req.user.email);
    }

    sql += " ORDER BY p.created_at DESC";

    const [parcels] = await db.execute(sql, params);

    res.status(200).json({
      message: "Parcels retrieved successfully.",
      count: parcels.length,
      parcels,
    });
  } catch (error) {
    console.error("Get parcels error:", error.message);
    res.status(500).json({
      message: "Unable to retrieve parcels.",
    });
  }
});

// POST /api/parcels
// Register a new parcel.
router.post("/", protect, async (req, res) => {
  const {
    sender_name,
    sender_phone,
    receiver_name,
    receiver_phone,
    receiver_email,
    sender_address,
    receiver_address,
    parcel_type,
    weight,
  } = req.body;

  const requiredFields = {
    sender_name,
    sender_phone,
    receiver_name,
    receiver_phone,
    receiver_email,
    sender_address,
    receiver_address,
    parcel_type,
    weight,
  };

  for (const [field, value] of Object.entries(requiredFields)) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      return res.status(400).json({
        message: `${field} is required.`,
      });
    }
  }

  const numericWeight = Number(weight);

  if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
    return res.status(400).json({
      message: "Weight must be a positive number.",
    });
  }

  const normalizedReceiverEmail = receiver_email.trim().toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedReceiverEmail)
  ) {
    return res.status(400).json({
      message: "Please provide a valid receiver email address.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const trackingNumber =
      "PN" +
      Date.now().toString(36).toUpperCase() +
      crypto.randomBytes(3).toString("hex").toUpperCase();

    const [result] = await connection.execute(
      `INSERT INTO parcels (
        tracking_number,
        sender_name,
        sender_phone,
        receiver_name,
        receiver_phone,
        receiver_email,
        sender_address,
        receiver_address,
        parcel_type,
        weight,
        status,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED', ?)`,
      [
        trackingNumber,
        sender_name.trim(),
        sender_phone.trim(),
        receiver_name.trim(),
        receiver_phone.trim(),
        normalizedReceiverEmail,
        sender_address.trim(),
        receiver_address.trim(),
        parcel_type.trim(),
        numericWeight,
        req.user.id,
      ]
    );

    await connection.execute(
      `INSERT INTO tracking_history (
        parcel_id,
        status,
        location,
        note,
        updated_by
      ) VALUES (?, 'REGISTERED', ?, ?, ?)`,
      [
        result.insertId,
        "Registration desk",
        "Parcel registered successfully.",
        req.user.id,
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: "Parcel registered successfully.",
      parcel: {
        id: result.insertId,
        tracking_number: trackingNumber,
        receiver_email: normalizedReceiverEmail,
        status: "REGISTERED",
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Register parcel error:", error.message);

    res.status(500).json({
      message: "Unable to register parcel.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET /api/parcels/:id
// Retrieve parcel details and tracking history.
router.get("/:id", protect, async (req, res) => {
  try {
    const [parcels] = await db.execute(
      "SELECT * FROM parcels WHERE id = ? LIMIT 1",
      [req.params.id]
    );

    if (parcels.length === 0) {
      return res.status(404).json({
        message: "Parcel not found.",
      });
    }

    const parcel = parcels[0];

    if (
      req.user.role === "USER" &&
      (
        !parcel.receiver_email ||
        parcel.receiver_email.toLowerCase() !==
          req.user.email.toLowerCase()
      )
    ) {
      return res.status(403).json({
        message: "You cannot access this parcel.",
      });
    }

    const [history] = await db.execute(
      `SELECT id, status, location, note, updated_by, created_at
       FROM tracking_history
       WHERE parcel_id = ?
       ORDER BY created_at DESC`,
      [parcel.id]
    );

    res.status(200).json({
      parcel,
      tracking_history: history,
    });
  } catch (error) {
    console.error("Get parcel details error:", error.message);

    res.status(500).json({
      message: "Unable to retrieve parcel details.",
    });
  }
});

// PATCH /api/parcels/:id/status
// Only MANAGER and ADMIN can update parcel status.
router.patch(
  "/:id/status",
  protect,
  allowRoles("MANAGER", "ADMIN"),
  async (req, res) => {
    const { status, location, note } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Please provide a valid parcel status.",
        validStatuses: VALID_STATUSES,
      });
    }

    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [parcels] = await connection.execute(
        "SELECT id FROM parcels WHERE id = ? FOR UPDATE",
        [req.params.id]
      );

      if (parcels.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          message: "Parcel not found.",
        });
      }

      await connection.execute(
        "UPDATE parcels SET status = ? WHERE id = ?",
        [status, req.params.id]
      );

      await connection.execute(
        `INSERT INTO tracking_history (
          parcel_id,
          status,
          location,
          note,
          updated_by
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          req.params.id,
          status,
          typeof location === "string" ? location.trim() || null : null,
          typeof note === "string" && note.trim()
            ? note.trim()
            : `Parcel status updated to ${status}.`,
          req.user.id,
        ]
      );

      await connection.commit();

      res.status(200).json({
        message: "Parcel status updated successfully.",
        parcel_id: Number(req.params.id),
        status,
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      console.error("Update parcel status error:", error.message);

      res.status(500).json({
        message: "Unable to update parcel status.",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;
