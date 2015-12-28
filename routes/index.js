var express = require('express');
var router = express.Router();
var WorkTime = require('./../work_time');
var sequelize = require('./../db');
var moment = require('moment');
var q = require('q');

// Главная страница
router.get('/', function(req, res) {
	if(!req.query.username) {
			return res.send('No username')
		}
		WorkTime.get(req.query.username).then(function(data) {
			sequelize.query("SELECT * FROM subscriptions WHERE username = '" + req.query.username + "'").spread(function(subscription) {
				
				var currentDayFinished = false;
				var currentDay = data.daysObjectsArray.find(function(item) { return item.day === moment().isoWeekday() && item.fake !== true });
				currentDayFinished = currentDay != null && currentDay.to !== 'сейчас';
				res.render('index', {
					data: data,
					subscription: subscription.length > 0 ? subscription[0] : null,
					username: req.query.username,
					currentDayFinished: currentDayFinished
				});
			})
		});		
});

// Отметиться
router.post('/check', function(req, res, next) {
	WorkTime.write(req.body.username);
	if(req.params.api) {
		res.send('ok');
	}
	else {
		res.redirect('/?username=' + req.body.username);		
	}
})

// Редактировать день
router.post('/editDay/:dayIndex', function(req, res, next) {
	var day = moment().startOf('isoweek').add(req.params.dayIndex, 'days')
	var currentDay = day.format('YYYY-MM-DD');

	
	var currentIn = day.format('YYYY-MM-DD ' + req.body.inDate + ':00+03');
	sequelize.query("UPDATE work_times SET date = '" + currentIn + "' WHERE user_id = '" + req.body.username + "' AND DATE(date) = '" + currentDay + "' AND direction = 'in'")

	if(req.body.outDate != null) {
		if(req.body.outDate === '') {
			sequelize.query("DELETE FROM work_times WHERE user_id = '" + req.body.username + "' AND DATE(date) = '" + currentDay + "' AND direction = 'out'")				
		}
		else {
			var currentOut = day.format('YYYY-MM-DD ' + req.body.outDate + ':00+03');
			sequelize.query("UPDATE work_times SET date = '" + currentOut + "' WHERE user_id = '" + req.body.username + "' AND DATE(date) = '" + currentDay + "' AND direction = 'out'");
		}

	}

	res.redirect('/?username=' + req.body.username);		
})

router.post('/subscribe', function(req, res, next) {
	WorkTime.subscribe(req.body.username, req.body.slackUsername).then(function() {
		res.redirect('/?username=' + req.body.username);
	});
})

module.exports = router;
