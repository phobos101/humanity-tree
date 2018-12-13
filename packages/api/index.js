/* eslint no-param-reassign: 0, no-unused-vars: 0 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cors = require('cors');
const passport = require('passport');
const { ApolloServer } = require('apollo-server-express');
const connectRedis = require('connect-redis');

const prepare = (o) => {
	if (o) {
		o._id = o._id.toString();
	}
	return o;
};

const start = async () => {
	try {
		const client = await MongoClient.connect(
			`mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`,
		);
		const db = client.db(process.env.MONGO_DB);

		const Posts = db.collection('posts');
		const Comments = db.collection('comments');

		const typeDefs = [
			`
            type Query {
                me: User
                post(_id: ID!): Post
                posts: [Post]
                comment(_id: ID!): Comment
            }
            type User {
                _id: ID!
            }
            type Post {
                _id: ID!
                authorId: ID!
                title: String
                content: String

                author: User
                comments: [Comment]!
            }
            type Comment {
                _id: ID!
                postId: ID!
                authorId: ID
                content: String

                author: User
                post: Post
            }
            type Mutation {
                createPost(title: String, content: String): Post
                createComment(postId: ID!, content: String): Comment
            }
            schema {
                query: Query
                mutation: Mutation
            }
        `,
		];

		const resolvers = {
			Query: {
				me: async (root, args, { userId }) => {
					if (!userId) {
						return null;
					}
					return {
						_id: userId,
					};
				},
				post: async (root, { _id }) => prepare(await Posts.findOne(ObjectId(_id))),
				posts: async (root, args, context) => (await Posts.find({}).toArray()).map(prepare),
				comment: async (root, { _id }) => prepare(await Comments.findOne(ObjectId(_id))),
			},
			Post: {
				comments: async ({ _id }) => (
					await Comments.find({ postId: _id }).toArray()
				).map(prepare),
			},
			Comment: {
				post: async ({ postId }) => prepare(await Posts.findOne(ObjectId(postId))),
			},
			Mutation: {
				createPost: async (root, args, { userId }, info) => {
					if (!userId) {
						throw new Error('User not logged in.');
					}

					args.authorId = userId;

					const { insertedId } = await Posts.insertOne(args);
					return prepare(await Posts.findOne(ObjectId(insertedId)));
				},
				createComment: async (root, args, { userId }) => {
					if (!userId) {
						throw new Error('User not logged in.');
					}

					args.authorId = userId;

					const { insertedId } = await Comments.insertOne(args);
					return prepare(await Comments.findOne(ObjectId(insertedId)));
				},
			},
		};

		const app = express();
		app.use(morgan('dev'));

		const corsMiddleware = cors({
			origin: process.env.ORIGIN_URL,
			credentials: true,
			preflightContinue: false,
		});

		app.use(corsMiddleware);
		app.options(corsMiddleware);

		app.use(cookieParser());

		const RedisStore = connectRedis(session);

		app.use(
			session({
				name: 'app-session-id',
				store: new RedisStore({
					host: process.env.REDIS_HOST,
					port: process.env.REDIS_PORT,
				}),
				secret: process.env.SESSION_SECRET,
				resave: false,
				saveUninitialized: true,
			}),
		);

		app.use(passport.initialize());
		app.use(passport.session());
		passport.serializeUser((userId, done) => {
			done(null, userId);
		});
		passport.deserializeUser((userId, done) => {
			done(null, userId);
		});

		const server = new ApolloServer({
			typeDefs,
			resolvers,
			context: ({ req }) => ({
				userId: req.user,
			}),
			playground: {
				settings: {
					'editor.cursorShape': 'line',
				},
			},
		});

		server.applyMiddleware({
			app,
			path: '/api',
		});

		app.listen(process.env.PORT, () => {
			console.info(`API online at ${process.env.HOST}:${process.env.PORT}`);
		});
	} catch (e) {
		console.error(e);
	}
};

start();
