const express = require('express');
const MaterialType = require('../models/MaterialType');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Get all active material types (Public)
router.get('/', asyncHandler(async (req, res, next) => {
  const materialTypes = await MaterialType.find().sort({ name: 1 });
  res.status(200).json({
    success: true,
    materialTypes,
  });
}));

module.exports = router;
