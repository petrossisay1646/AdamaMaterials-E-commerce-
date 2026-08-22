const express = require('express');
const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/auth');
const multer = require('multer');

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 5, // max 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed.'), false);
    }
  },
});

const router = express.Router();

// Public routes
router.get('/', productController.getPublicProducts);
router.get('/:id', productController.getProductDetails);

// Protected routes (Sellers and Admins)
router.use(protect);

// Seller routes
router.get('/my/listings', restrictTo('SELLER'), productController.getMyProducts);
router.post('/', restrictTo('SELLER'), productController.createProduct);
router.put('/:id', restrictTo('SELLER'), productController.updateProduct);
router.post('/:id/submit', restrictTo('SELLER'), productController.submitForApproval);
router.post('/upload', restrictTo('SELLER'), upload.array('images', 5), productController.uploadProductImages);

// Delete route (Seller owns it or Admin)
router.delete('/:id', productController.deleteProduct);

module.exports = router;
