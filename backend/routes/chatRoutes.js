import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import * as c from '../controllers/chatController.js';

const router = Router();
router.use(protect);

router.get('/unread-count', h(c.unreadCount));
router.get('/conversations', h(c.conversations));
router.post('/conversations', h(c.openConversation));
router.get('/conversations/:id/messages', h(c.messages));
router.post('/conversations/:id/messages', h(c.send));
router.post('/conversations/:id/read', h(c.read));

export default router;
