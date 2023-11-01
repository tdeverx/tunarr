import express from 'express';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';

const logger = createLogger(import.meta);

export const hdhrSettingsRouter = express.Router();

hdhrSettingsRouter.get('/api/hdhr-settings', (req, res) => {
  try {
    let hdhr = req.ctx.dbAccess.hdhrSettings();
    res.send(hdhr);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

hdhrSettingsRouter.put('/api/hdhr-settings', async (req, res) => {
  try {
    await req.ctx.dbAccess.updateSettings('hdhr', req.body);
    let hdhr = req.ctx.dbAccess.hdhrSettings();
    res.send(hdhr);
    req.ctx.eventService.push('settings-update', {
      message: 'HDHR configuration updated.',
      module: 'hdhr',
      detail: {
        action: 'update',
      },
      level: 'info',
    });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error updating HDHR configuration',
      module: 'hdhr',
      detail: {
        action: 'action',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});

hdhrSettingsRouter.post('/api/hdhr-settings', async (req, res) => {
  try {
    await req.ctx.dbAccess.updateSettings('hdhr', {
      // _id: req.body._id,
      tunerCount: 1,
      autoDiscoveryEnabled: true,
    });
    var hdhr = req.ctx.dbAccess.hdhrSettings();
    res.send(hdhr);
    req.ctx.eventService.push('settings-update', {
      message: 'HDHR configuration reset.',
      module: 'hdhr',
      detail: {
        action: 'reset',
      },
      level: 'warning',
    });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error reseting HDHR configuration',
      module: 'hdhr',
      detail: {
        action: 'reset',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});