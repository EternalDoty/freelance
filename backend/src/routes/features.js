const express = require('express');
const featuresCatalog = require('../config/featuresCatalog');

const router = express.Router();

/**
 * @swagger
 * /api/features:
 *   get:
 *     summary: Get platform feature catalog
 *     tags: [Platform]
 *     responses:
 *       200:
 *         description: Feature catalog returned successfully
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      ...featuresCatalog,
      total: featuresCatalog.features.length,
      generatedAt: new Date().toISOString(),
    },
  });
});

module.exports = router;
