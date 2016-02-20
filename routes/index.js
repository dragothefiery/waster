var express = require('express');
var router = express.Router();
var WorkTime = require('./../work_time');
var sequelize = require('./../db')();
var moment = require('moment');
var q = require('q');

// Главная страница
router.get('/', function(req, res) {
	if(!req.query.username) {
		return res.send('No username');
	}
	var date = req.query.date;
	var username = req.query.username;
	var last = +req.query.last;
	if(!last || isNaN(last)) last = 0;
	WorkTime.get(username, date, last).then(function(data) {
		sequelize.query("SELECT * FROM subscriptions WHERE username = '" + username + "'").spread(function(subscription) {
			if(req.query.api) {
				return res.json(data);
			}
			else {
				res.render('index', {
					data: data,
					subscription: subscription.length > 0 ? subscription[0] : null,
					username: username,
					last: last
				});
			}
		})
	}).done();
});

// Отметиться
router.post('/check', function(req, res, next) {
	WorkTime.write(req.body.username).finally(function() {;
		if(req.params.api) {
			res.send('ok');
		}
		else {
			res.redirect('/?username=' + req.body.username);		
		}
	});
})

// Редактировать день
router.post('/editDay/:dayIndex', function(req, res, next) {
	var day = moment().startOf('isoweek').add(req.params.dayIndex, 'days')
	var currentDay = day.format('YYYY-MM-DD');

	
	var promises = req.body.dates.map(function(date, i) {
		var selectSql = "SELECT id FROM work_times WHERE DATE(date) = '" + currentDay + "' AND user_id = '" + req.body.username + "' ORDER BY id ASC LIMIT 2 OFFSET " + i * 2;
		return sequelize.query(selectSql)
		.spread(function(response) {
			return {				
				inId: response[0] != null ? response[0].id : null,
				outId: response[1] != null ? response[1].id : null
			}
		}).then(function(ids) {
			
			if(ids.inId != null) {
				if(date.inDate === '') {
					sequelize.query("DELETE FROM work_times WHERE id = " + ids.inId);
				}
				else {
					var currentIn = day.format('YYYY-MM-DD ' + date.inDate + ':00+03');
					sequelize.query("UPDATE work_times SET date = '" + currentIn + "' WHERE id = " + ids.inId);
				}
			}
			if(date.outDate != null && ids.outId != null) {
				if(date.outDate === '') {
					sequelize.query("DELETE FROM work_times WHERE id = " + ids.outId);
				}
				else {
					var currentOut = day.format('YYYY-MM-DD ' + date.outDate + ':00+03');
					sequelize.query("UPDATE work_times SET date = '" + currentOut + "' WHERE id = " + ids.outId);
				}
			}
		});
	});
	q.all(promises).then(function() {		
		res.redirect('/?username=' + req.body.username);		
	}).done();

})

router.post('/subscribe', function(req, res, next) {
	WorkTime.subscribe(req.body.username, req.body.slackUsername).then(function() {
		res.redirect('/?username=' + req.body.username);
	});
})

module.exports = router;
