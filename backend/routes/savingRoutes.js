import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTxPin, requireTxPinIf } from '../middleware/txPin.js';
import * as c from '../controllers/savingsController.js';

const router = express.Router();
router.use(protect);

router.get('/config', c.config);
router.get('/', c.list);
router.post('/', requireTxPinIf((req) => Number(req.body?.initialDeposit) > 0), c.create);

router.get('/:id', c.get);
router.patch('/:id', c.update);
router.get('/:id/withdraw-preview', c.preview);
router.post('/:id/deposit', requireTxPin, c.addMoney);
router.post('/:id/withdraw', requireTxPin, c.takeOut);

export default router;