const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication
router.use(protect);

// Staff and Admin can view dashboard reports
router.get('/dashboard-stats', restrictTo('ADMIN', 'STAFF'), adminController.getDashboardStats);

// ADMIN ONLY ROUTES
router.use(restrictTo('ADMIN'));

// User Management
router.get('/users', adminController.getUsers);
router.post('/users/approve-seller', adminController.approveSeller);
router.post('/users/review-seller', adminController.reviewSellerApplication);
router.get('/sellers/:sellerId/bank-details', adminController.getSellerBankDetails);
router.post('/users/suspend', adminController.suspendUser);
router.post('/users/activate', adminController.activateUser);
router.post('/users/staff', adminController.createStaffAccount);
router.post('/users/staff/permissions', adminController.updateStaffPermissions);

// Map Places Management (Admin-managed local material hubs / scrap depots)
router.get('/map-places', adminController.getMapPlaces);
router.post('/map-places', adminController.createMapPlace);
router.put('/map-places/:id', adminController.updateMapPlace);
router.delete('/map-places/:id', adminController.deleteMapPlace);

// Product Approval
router.post('/products/review', adminController.reviewProduct);
router.get('/products', adminController.getAdminProducts);

// Category Management
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Material Type Management
router.post('/material-types', adminController.createMaterialType);
router.put('/material-types/:id', adminController.updateMaterialType);
router.delete('/material-types/:id', adminController.deleteMaterialType);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// Reset All Stats & Operational Data
router.post('/reset-stats', adminController.resetStats);

module.exports = router;

