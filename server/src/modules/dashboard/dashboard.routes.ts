import { Router } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, async (req, res) => {
  res.json(await dashboardService.learnerDashboard(currentUser(req)));
});
