const express = require('express');
const { authenticate, requireRole } = require('./auth');
const { getAdminSettings, getPublicSettings, updateSettings } = require('../settings');

const router = express.Router();

router.get('/public', (req, res) => {
  res.json({ settings: getPublicSettings() });
});

router.get('/', authenticate, requireRole('admin'), (req, res) => {
  res.json({ settings: getAdminSettings() });
});

router.put('/', authenticate, requireRole('admin'), (req, res) => {
  const settings = updateSettings(req.body || {});
  res.json({ message: '系统设置已保存', settings });
});

module.exports = router;
