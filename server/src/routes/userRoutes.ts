import { Router } from 'express';
import { register, login, getAllUsers, enterWorld } from '../controllers/userController';

const router = Router();

router.get('/', getAllUsers);
router.post('/register', register);
router.post('/login', login);
router.post('/enter', enterWorld);

export default router;
