const express = require("express");
const router = express.Router();
const { getServerStatus } = require("../controllers/serverController");

// Example route
router.get("/status", getServerStatus);

module.exports = router;
