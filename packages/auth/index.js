require('dotenv').config();
const express = require('express');
const { Ooth } = require('ooth');
const { OothMongo } = require('ooth-mongo');
const oothLocal = require('ooth-local').default;
const oothUser = require('ooth-user').default;
const oothFacebook = require('ooth-facebook').default;
const oothGoogle = require('ooth-google').default;
const oothTwitter = require('ooth-twitter').default;
const emailer = require('ooth-local-emailer').default;
const morgan = require('morgan');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const connectRedis = require('connect-redis');
const session = require('express-session');
const mail = require('./mail');

async function start() {
	try {
		const app = express();
		app.use(morgan('dev'));
		const corsMiddleware = cors({
			origin: process.env.ORIGIN_URL,
			credentials: true,
			preflightContinue: false,
		});
		app.use(corsMiddleware);
		app.options(corsMiddleware);

		const client = await MongoClient.connect(
			`mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`,
		);
		const db = client.db(process.env.MONGO_DB);

		const oothMongo = new OothMongo(db);
		const RedisStore = connectRedis(session);
		const ooth = new Ooth({
			app,
			path: '/auth',
			backend: oothMongo,
			session: session({
				name: 'app-session-id',
				secret: process.env.SESSION_SECRET,
				store: new RedisStore({
					host: process.env.REDIS_HOST,
					port: process.env.REDIS_PORT,
				}),
				resave: false,
				saveUninitialized: true,
			}),
		});
		oothUser({ ooth });
		oothLocal({ ooth });
		if (process.env.MAIL_FROM) {
			emailer({
				ooth,
				from: process.env.MAIL_FROM,
				siteName: process.env.MAIL_SITE_NAME,
				url: process.env.MAIL_URL,
				sendMail: mail({
					apiKey: process.env.MAILGUN_API_KEY,
					domain: process.env.MAILGUN_DOMAIN,
				}),
			});
		}
		if (process.env.FACEBOOK_CLIENT_ID) {
			oothFacebook({
				ooth,
				clientID: process.env.FACEBOOK_CLIENT_ID,
				clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
			});
		}
		if (process.env.GOOGLE_CLIENT_ID) {
			oothGoogle({
				ooth,
				clientID: process.env.GOOGLE_CLIENT_ID,
				clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			});
		}
		if (process.env.TWITTER_CLIENT_ID) {
			oothTwitter({
				ooth,
				clientID: process.env.TWITTER_CLIENT_ID,
				clientSecret: process.env.TWITTER_CLIENT_SECRET,
				callbackUrl: process.env.TWITTER_CALLBACK_URL,
			});
		}

		app.listen(process.env.PORT, process.env.HOST, () => {
			console.info(`Ooth online at ${process.env.HOST}:${process.env.PORT}/auth`);
		});
	} catch (e) {
		console.error(e);
	}
}

start();
