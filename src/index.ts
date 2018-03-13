import * as Koa from 'koa';
import * as logger from 'koa-logger';
import * as Router from 'koa-router';
import * as bodyparser from 'koa-bodyparser';
import * as serve from 'koa-static';
import * as koaJson from 'koa-json';
import * as session from 'koa-session';
import * as views from 'koa-views';

import { Slack } from './slack';
import { authorizeSlack, authorizeStrava } from './oauth';
import { BB_SESSION_KEY, BB_ROOT_URL } from './config';
import { renderConfigure, renderMore, renderRoot } from './views/index';
import { signOut, getIsSignedIn } from './utils/auth';
import { database } from './database';

const app = new Koa();

app.use(views(__dirname + '/../views', {
  map: { hbs: 'handlebars' },
  options: {
    partials: {
      layoutBase: './layout_base',
      head: './partial_head',
      slackSignin: './partial_slack_signin',
      slackAdd: './partial_slack_add',
      stravaPowered: './partial_strava_powered',
      footer: './partial_footer',
      stravaAdd: './partial_strava_add'
    }
  }
}));

const router = new Router();
const slack = new Slack();

app.keys = [ BB_SESSION_KEY ];

app.use(session({ key: 'kona:sess', maxAge: 86400000 }, app));
app.use(bodyparser());
app.use(koaJson());
app.use(logger());
app.use(async (ctx, next) => {
  ctx.state.rootUrl = BB_ROOT_URL;
  ctx.state.rootUrlEncoded = encodeURIComponent(BB_ROOT_URL);
  await next();
});

// Pages you can _be_ on
router.get('/', (ctx) => renderRoot(ctx));
router.get('/more', (ctx) => renderMore(ctx));

// URLs that take you back home
router.get('/signout', (ctx) => signOut(ctx));
router.get('/debug/checknow', (ctx) => slack.handleCheckNowRequest(ctx));
router.get('/oauth/slack', authorizeSlack);
router.get('/oauth/strava', authorizeStrava);

// Service
router.post('/webhook', slack.handleSlackIncoming);

app.use(router.routes() as any);
app.use(serve('static', { maxage: 1000 * 60 * 60 * 30 }));

app.listen(process.env.PORT || 8082, () => {
  console.log(`Blobbot is now live on ${process.env.PORT || 8082}`);
});
