const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const Notification = require('../models/Notification');

const router = express.Router();
const notificationAccess = authorize({
  roles: ['admin', 'user'],
  organization: false,
});

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function safeNotification(notification) {
  return {
    id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    read: notification.read,
    relatedResource:
      notification.relatedResourceType && notification.relatedResourceId
        ? {
            type: notification.relatedResourceType,
            id: notification.relatedResourceId.toString(),
          }
        : null,
    createdAt: notification.createdAt,
  };
}

router.use(authenticate, notificationAccess);

router.get('/', async (req, res, next) => {
  const limit = Number.parseInt(req.query.limit || '50', 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return sendError(res, 400, 'INVALID_LIMIT', 'limit must be between 1 and 100');
  }

  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
    })
      .sort({ createdAt: -1 })
      .limit(limit);
    return res.json({
      success: true,
      data: { notifications: notifications.map(safeNotification) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false,
    });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 400, 'INVALID_NOTIFICATION_ID', 'Notification ID is invalid');
  }
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id,
      },
      { $set: { read: true } },
      { new: true },
    );
    if (!notification) {
      return sendError(res, 404, 'NOT_FOUND', 'Notification not found');
    }
    return res.json({
      success: true,
      data: { notification: safeNotification(notification) },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/read-all', async (req, res, next) => {
  if (
    req.body === undefined ||
    req.body === null ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length !== 0
  ) {
    return sendError(res, 400, 'INVALID_REQUEST', 'An empty JSON object is required');
  }
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user.id,
        read: false,
      },
      { $set: { read: true } },
    );
    return res.json({
      success: true,
      data: { updated: result.modifiedCount || result.nModified || 0 },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
