import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import * as c from '../controllers/followController.js';

const router = Router();
router.use(protect);

router.get('/following', h(c.myFollowing));
router.post('/:userId', h(c.toggleFollow));

export default router;
