import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import * as c from '../controllers/postController.js';

const router = Router();
router.use(protect);

router.get('/', h(c.list));
router.post('/', h(c.create));
router.get('/mine', h(c.mine));       // keep these two ABOVE '/:id'
router.get('/saved', h(c.saved));

router.get('/:id', h(c.getOne));
router.patch('/:id', h(c.update));
router.delete('/:id', h(c.remove));

router.post('/:id/like', h(c.toggleLike));
router.post('/:id/save', h(c.toggleSave));
router.post('/:id/repost', h(c.toggleRepost));
router.post('/:id/share', h(c.share));

router.get('/:id/comments', h(c.listComments));
router.post('/:id/comments', h(c.addComment));
router.delete('/:id/comments/:commentId', h(c.deleteComment));

export default router;
