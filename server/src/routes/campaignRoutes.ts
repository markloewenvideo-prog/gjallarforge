import { Router } from 'express';
import { createCampaign, getCampaign, joinCampaign, getDefaultCampaign, getAllCampaigns, deleteCampaign, enlistHero, forgeAhead, retireHero } from '../controllers/campaignController';
import { performAction, logWorkout } from '../controllers/gameController';

const router = Router();

router.get('/', getAllCampaigns);
router.post('/', createCampaign);
router.get('/default', getDefaultCampaign);
router.get('/:id', getCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/enlist', enlistHero);
router.post('/:id/forge-ahead', forgeAhead);
router.delete('/:id/participant/:participantId', retireHero);
router.post('/join', joinCampaign);
router.post('/action', performAction);
router.post('/workout', logWorkout);

export default router;
