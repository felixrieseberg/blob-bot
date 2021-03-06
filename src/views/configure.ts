import * as Router from 'koa-router';
import { Installation, StravaClub } from '../interfaces';
import { getClubs, getClubsForAthlete } from '../strava';
import { getStravaStatus } from '../utils/auth';
import { database } from '../database';
import { logger } from '../logger';

const lp = `:frame_with_picture: *View (Configure)*:`;

async function handleWatch(ctx: Router.IRouterContext, i: Installation) {
  if (!ctx.query.watch && !ctx.query.unwatch) return;

  const athlete = getStravaStatus(ctx);
  const watch = ctx.query.watch ? parseInt(ctx.query.watch, 10) : undefined;
  const unwatch = ctx.query.unwatch ? parseInt(ctx.query.unwatch, 10) : undefined;
  let updateRequired = false;

  if (watch) logger.log(`${lp} Asked to watch club: ${watch}`);
  if (unwatch) logger.log(`${lp} Asked to unwatch club: ${unwatch}`);

  if (watch && athlete && !i.strava.clubs.find(({ id }) => watch === id)) {
    i.strava.clubs.push({ id: watch, token: athlete.accessToken });
    updateRequired = true;
  }

  if (unwatch && i.strava.clubs.find(({ id }) => unwatch === id)) {
    i.strava.clubs = i.strava.clubs.filter(({ id }) => id !== unwatch);
    updateRequired = true;
  }

  if (updateRequired) {
    logger.log(`${lp} Updating installation due to watch change for team ${i.slack.teamId}`);

    try {
      await database.updateInstallation(i);
    } catch (error) {
      console.error(`Tried to update installation, but failed`);
    }
  }
}

export async function renderConfigure(ctx: Router.IRouterContext, install: Installation) {
  ctx.state.page = 'configure';

  let clubsAlreadyWatching: Array<StravaClub> = [];
  let stravaClubs: Array<StravaClub> = [];
  let hasNoClubs = false;

  // Should we watch or unwatch a club?
  await handleWatch(ctx, install);

  try {
    clubsAlreadyWatching = await getClubs(install.strava.clubs);
  } catch (error) {
    console.error(`${lp} Getting clubs for installation failed`, error);
  }

  const athlete = getStravaStatus(ctx);

  if (athlete) {
    try {
      const clubsForAthlete = await getClubsForAthlete(athlete);

      if (!clubsForAthlete || clubsForAthlete.length === 0) {
        hasNoClubs = true;
      } else {
        const notAlreadyWatching = clubsForAthlete.filter(({ id }) => {
          return !clubsAlreadyWatching.find((c) => c.id === id);
        });

        stravaClubs = notAlreadyWatching;
      }
    } catch (error) {
      console.error(`${lp} Getting clubs for athlete failed`, error);
    }
  }

  const details = `${clubsAlreadyWatching.length} clubs watching and ${stravaClubs.length} available`;
  logger.log(`${lp} Rendering view with ${details}`);

  ctx.state.clubs = clubsAlreadyWatching;
  ctx.state.stravaClubs = stravaClubs;
  ctx.state.hasNoClubs = hasNoClubs;

  return ctx.render('./configure.hbs');
}
