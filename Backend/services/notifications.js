const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');

async function platformRecipients(roles, excludedUserId = null) {
  if (mongoose.connection.readyState !== 1) return [];
  const filter = {
    role: { $in: roles },
  };
  if (excludedUserId) filter._id = { $ne: excludedUserId };
  try {
    const users = await User.find(filter).select('_id').lean();
    return users.map((user) => user._id);
  } catch (error) {
    console.error('Unable to load platform notification recipients', error);
    return [];
  }
}

async function createNotifications({
  organizationId = null,
  recipientIds,
  title,
  message,
  type,
  relatedResourceType,
  relatedResourceId,
  dedupeKey,
}) {
  if (!recipientIds?.length) return;

  await Notification.bulkWrite(
    recipientIds.map((recipientId) => ({
      updateOne: {
        filter: {
          dedupeKey: `${dedupeKey}:${recipientId.toString()}`,
        },
        update: {
          $setOnInsert: {
            organization: organizationId,
            recipient: recipientId,
            title,
            message,
            type,
            relatedResourceType: relatedResourceType || null,
            relatedResourceId: relatedResourceId || null,
            read: false,
            dedupeKey: `${dedupeKey}:${recipientId.toString()}`,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

async function createWorkflowNotifications(details, eventName) {
  try {
    await createNotifications(details);
  } catch (error) {
    console.error(`Unable to create ${eventName} notifications`, error);
  }
}

module.exports = {
  createNotifications,
  createWorkflowNotifications,
  platformRecipients,
};
