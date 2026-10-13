
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "ParcelNest API",
      version: "1.0.0",
      description:
        "API documentation for the ParcelNest parcel management system.",
    },

    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
    ],

    // JWT Bearer authentication
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },

    paths: {
      // Health check
      "/api/health": {
        get: {
          summary: "Check backend health",
          tags: ["Health"],
          responses: {
            200: {
              description: "Backend is running",
              content: {
                "application/json": {
                  example: {
                    message: "ParcelNest backend is running!",
                  },
                },
              },
            },
          },
        },
      },

      // Login
      "/api/auth/login": {
        post: {
          summary: "Log in to ParcelNest",
          tags: ["Authentication"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: {
                      type: "string",
                      example: "admin@parcelnest.test",
                    },
                    password: {
                      type: "string",
                      example: "AdminDemo123!",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Login successful; returns a JWT token and user",
            },
            400: {
              description: "Email or password is missing",
            },
            401: {
              description: "Invalid email or password",
            },
          },
        },
      },

      // Current logged-in user
      "/api/auth/me": {
        get: {
          summary: "Get the logged-in user's details",
          tags: ["Authentication"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Current user details",
            },
            401: {
              description: "Missing or invalid authentication token",
            },
          },
        },
      },

      // List parcels and register a parcel
      "/api/parcels": {
        get: {
          summary: "Get accessible parcels",
          description:
            "Users see their own parcels. Managers and admins can see all parcels.",
          tags: ["Parcels"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Parcel list retrieved successfully",
            },
            401: {
              description: "Authentication required",
            },
            500: {
              description: "Server error",
            },
          },
        },

        post: {
          summary: "Register a new parcel",
          description:
            "Creates a parcel and its initial tracking-history record.",
          tags: ["Parcels"],
          security: [{ bearerAuth: [] }],

          // THIS MAKES THE REQUEST BODY VISIBLE IN SWAGGER
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "sender_name",
                    "sender_phone",
                    "receiver_name",
                    "receiver_phone",
                    "sender_address",
                    "receiver_address",
                    "parcel_type",
                    "weight",
                  ],
                  properties: {
                    sender_name: {
                      type: "string",
                      example: "Rahul",
                    },
                    sender_phone: {
                      type: "string",
                      example: "9876543210",
                    },
                    receiver_name: {
                      type: "string",
                      example: "Priya",
                    },
                    receiver_phone: {
                      type: "string",
                      example: "9876501234",
                    },
                    sender_address: {
                      type: "string",
                      example: "Hyderabad",
                    },
                    receiver_address: {
                      type: "string",
                      example: "Warangal",
                    },
                    parcel_type: {
                      type: "string",
                      example: "Documents",
                    },
                    weight: {
                      type: "number",
                      format: "float",
                      example: 1.5,
                    },
                  },
                },
              },
            },
          },

          responses: {
            201: {
              description: "Parcel registered successfully",
            },
            400: {
              description: "Invalid or missing parcel details",
            },
            401: {
              description: "Authentication required",
            },
            500: {
              description: "Server error",
            },
          },
        },
      },

      // Get parcel details and tracking history
      "/api/parcels/{id}": {
        get: {
          summary: "Get parcel details and tracking history",
          tags: ["Parcels"],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Parcel database ID",
              schema: {
                type: "integer",
              },
            },
          ],
          responses: {
            200: {
              description: "Parcel details and tracking history",
            },
            401: {
              description: "Authentication required",
            },
            403: {
              description: "Access denied",
            },
            404: {
              description: "Parcel not found",
            },
          },
        },
      },

      // Update parcel status
      "/api/parcels/{id}/status": {
        patch: {
          summary: "Update parcel status",
          tags: ["Parcels"],
          description: "Only managers and admins can update parcel status.",
          security: [{ bearerAuth: [] }],

          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Parcel database ID",
              schema: {
                type: "integer",
              },
            },
          ],

          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: {
                      type: "string",
                      enum: [
                        "REGISTERED",
                        "COLLECTED",
                        "IN_TRANSIT",
                        "OUT_FOR_DELIVERY",
                        "DELIVERED",
                        "CANCELLED",
                      ],
                      example: "IN_TRANSIT",
                    },
                    location: {
                      type: "string",
                      example: "Hyderabad sorting centre",
                    },
                    note: {
                      type: "string",
                      example: "Parcel dispatched",
                    },
                  },
                },
              },
            },
          },

          responses: {
            200: {
              description: "Parcel status updated successfully",
            },
            400: {
              description: "Invalid parcel status",
            },
            401: {
              description: "Authentication required",
            },
            403: {
              description: "Insufficient permissions",
            },
            404: {
              description: "Parcel not found",
            },
          },
        },
      },

      // Dashboard
      "/api/dashboard": {
        get: {
          summary: "Get dashboard statistics",
          tags: ["Dashboard"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Dashboard statistics retrieved",
            },
            401: {
              description: "Authentication required",
            },
            500: {
              description: "Server error",
            },
          },
        },
      },
    },
  },

  apis: [],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "ParcelNest backend is running!",
  });
});

// API routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/parcels", require("./routes/parcels"));
app.use("/api/dashboard", require("./routes/dashboard"));

// Start server after MySQL connection succeeds
async function startServer() {
  try {
    await db.query("SELECT 1");

    console.log("MySQL connected successfully!");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(
        `ParcelNest backend running on http://localhost:${PORT}`
      );
      console.log(
        `Swagger documentation: http://localhost:${PORT}/api-docs`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
