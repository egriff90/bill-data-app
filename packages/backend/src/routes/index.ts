import { Router, type Router as RouterType } from 'express';
import sessionsRoutes from './sessions.routes';
import billsRoutes from './bills.routes';
import amendmentsRoutes from './amendments.routes';
import membersRoutes from './members.routes';
import syncRoutes from './sync.routes';
import stagesRoutes from './stages.routes';
import { isExpensive, rateLimit } from '../middleware/security';

const router: RouterType = Router();

// The site is public, so cap how hard one client can push the database. Ordinary browsing makes a
// handful of requests per page; whole-table queries (stats, timeline, CSV exports) are far fewer.
const generalLimit = rateLimit(60_000, 300);
const expensiveLimit = rateLimit(60_000, 30);
router.use(generalLimit);
router.use((req, res, next) => (isExpensive(req) ? expensiveLimit(req, res, next) : next()));

router.use('/sessions', sessionsRoutes);
router.use('/bills', billsRoutes);
router.use('/amendments', amendmentsRoutes);
router.use('/members', membersRoutes);
router.use('/sync', syncRoutes);
router.use('/stages', stagesRoutes);

export default router;
