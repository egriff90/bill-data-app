import { Router, type Router as RouterType } from 'express';
import sessionsRoutes from './sessions.routes';
import billsRoutes from './bills.routes';
import amendmentsRoutes from './amendments.routes';
import membersRoutes from './members.routes';
import syncRoutes from './sync.routes';

const router: RouterType = Router();

router.use('/sessions', sessionsRoutes);
router.use('/bills', billsRoutes);
router.use('/amendments', amendmentsRoutes);
router.use('/members', membersRoutes);
router.use('/sync', syncRoutes);

export default router;
