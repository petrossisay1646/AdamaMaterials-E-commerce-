const express = require('express');
const mapController = require('../controllers/mapController');

const router = express.Router();

// Public map routes
router.get('/places', mapController.getMarketplaceMapData);
router.get('/route', mapController.getRoadRoute);

module.exports = router;