import { Router } from 'express';
import { createCampaign, getCampaign, joinCampaign, getDefaultCampaign, getAllCampaigns, deleteCampaign, enlistHero, forgeAhead, retireHero, renameEnemy, ascendCampaign, optInToEndless } from '../controllers/campaignController';
import { performAction, logWorkout, undoAction } from '../controllers/gameController';

const router = Router();

router.get('/', getAllCampaigns);
router.post('/', createCampaign);
router.get('/default', getDefaultCampaign);
router.get('/:id', getCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/enlist', enlistHero);
router.post('/:id/forge-ahead', forgeAhead);
router.post('/:id/ascend', ascendCampaign);
router.post('/:id/opt-in-endless', optInToEndless);
router.post('/:id/rename-enemy', renameEnemy);
router.delete('/:id/participant/:participantId', retireHero);
router.post('/join', joinCampaign);
router.post('/action', performAction);
router.post('/workout', logWorkout);
router.post('/undo', undoAction);

export default router;
