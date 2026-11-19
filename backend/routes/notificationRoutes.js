import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import * as c from '../controllers/notificationController.js';

const router = Router();
router.use(protect);

router.get('/', h(c.list));
router.get('/unread-count', h(c.unreadCount));
router.post('/read-all', h(c.readAll));
router.post('/:id/read', h(c.readOne));
router.patch('/settings', h(c.settings));
router.post('/push-token/remove', h(c.removeToken));

export default router;
