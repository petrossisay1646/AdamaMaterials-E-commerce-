const express = require('express');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Get all active categories (Public)
router.get('/', asyncHandler(async (req, res, next) => {
  const categories = await Category.find().sort({ name: 1 });
  res.status(200).json({
    success: true,
    categories,
  });
}));

module.exports = router;
