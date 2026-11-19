import { Router } from 'express';
import { protect } from '../middleware/auth.js'; // <- your existing auth middleware (must set req.user)
import { h } from '../utils/asyncHandler.js';
import * as c from '../controllers/cartController.js';

const router = Router();
router.use(protect);

router.get('/', h(c.getCart));
router.delete('/', h(c.clearCart));
router.post('/items', h(c.addItem));
router.patch('/items/:itemId', h(c.updateItem));
router.delete('/items/:itemId', h(c.removeItem));
router.patch('/options', h(c.updateOptions));
router.post('/merge', h(c.mergeCart));

export default router;
