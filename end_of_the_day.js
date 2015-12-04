require('sugar');
require('dotenv').load();
var sequelize = require('./db');
var moment = require('moment');

sequelize.query('SELECT user_id FROM work_times WHERE DATE(date) = DATE(NOW()) GROUP BY DATE(date), user_id HAVING count(*) = 1 ORDER BY DATE(date) DESC')
.spread(function(users) {
	return users.map('user_id');
})
.then(function(userIds) {
	userIds.forEach(function(userId) {
		sequelize.query('INSERT INTO work_times (user_id, date, direction) VALUES (\'' + userId + '\', \'' + moment().format('YYYY-MM-DD 23:59:00+03') + '\', \'out\')')
	});
});