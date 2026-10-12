import { prisma } from '../db.js';

export function notify(userId, message, link = null, db = prisma) {
  return db.notification.create({ data: { userId, message, link } });
}
