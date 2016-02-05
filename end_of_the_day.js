require('sugar');
require('dotenv').load();
var sequelize = require('./db');
var moment = require('moment');

//date = moment('2016-02-04')
date = moment()
sequelize.query('SELECT * FROM work_times WHERE DATE(date) = \'' + date.format('YYYY-MM-DD') + '\' ORDER BY id DESC')
.spread(function(users) {
	users = users.groupBy(function(user) { return user.user_id });
	return Object.values(users).filter(function(times) {
		return times.first() && times.first().direction === 'in';
	}).map(function(times) {
		return times[0].user_id;
	}).forEach(function(userId) {
		sequelize.query('INSERT INTO work_times (user_id, date, direction) VALUES (\'' + userId + '\', \'' + date.format('YYYY-MM-DD 23:59:00+03') + '\', \'out\')')
	});
});
