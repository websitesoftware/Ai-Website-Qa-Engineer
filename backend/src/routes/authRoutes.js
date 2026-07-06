const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  forgotPassword,
} = require("../controllers/authController");

// Router pipeline mapping structure definitions
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);

module.exports = router;
