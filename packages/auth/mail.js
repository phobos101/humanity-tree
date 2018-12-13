const mailcomposer = require('mailcomposer');
const Mg = require('mailgun-js');

module.exports = (options) => {
	const Mailgun = Mg(options);
	return ({
		from,
		to,
		subject,
		body,
		html,
	}) =>
		new Promise((resolve, reject) => {
			const mail = mailcomposer({
				from,
				to,
				subject,
				body,
				html,
			});
			mail.build((err, message) => {
				if (err) {
					return reject(err);
				}
				Mailgun.messages().sendMime({ to, message: message.toString('ascii') }, (error) => {
					if (error) {
						return reject(error);
					}
					return resolve();
				});
			});
		});
};
