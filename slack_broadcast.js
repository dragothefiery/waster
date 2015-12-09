
require('dotenv').load();
var WorkTime = require('./work_time');
var getRemaining = require('./get_remaining');
require('sugar');
var moment = require('moment');
var sequelize = require('./db');
var axios = require('axios');

var SLACK_TOKEN = 'xoxp-3568089060-3568696166-4950925825-ce7ec8';

function splitTime(time) {
	var sp = time.split(':');
	return {
		hour: sp[0],
		minute: sp[1]
	}
}

function sendToSlack(username, message) {
	axios.get('https://slack.com/api/chat.postMessage', {
		params: {
			token: SLACK_TOKEN,
			channel: '@' + username,
			text: message,
			username: 'Трекер рабочего времени',
			icon_emoji: ':triangular_flag_on_post:'
		}
	})
}

sequelize.query('SELECT * FROM subscriptions').spread(function(data) {
	data.forEach(function(user) {
		WorkTime.get(user.username).then(function(remainingData) {
			console.log(user.slack_username);
			
			var currentDayFinished = false;
			var currentDay = remainingData.daysObjectsArray.find(function(item) { return item.day === moment().isoWeekday() && item.fake !== true });
			currentDayFinished = currentDay != null && currentDay.outDate !== 'сейчас';
 			//console.log(currentDayFinished);
// 			
			if(currentDayFinished) {
				return;				
			}
			
			if(moment().format('HH:mm') === remainingData.recommendedEndDay) {
 			//if(moment().format('HH:mm') === moment().format('HH:mm')) {
				var spRecEnd = splitTime(remainingData.recommendedEndDay);
				spRecEnd = moment().hour(spRecEnd.hour).minutes(spRecEnd.minute);
// 			
				var spEnd = splitTime(remainingData.endDay);
				spEnd = moment().hour(spEnd.hour).minutes(spEnd.minute);
				var diffMinutes = moment().diff(spEnd, 'minutes').abs();
				var message = 'Я рекомендую тебе свалить с работы прямо сейчас';
				
				if(spRecEnd.isBefore(spEnd)) {
					message += ', либо просидеть еще ' + getRemaining.minutesToHuman(diffMinutes) + 
							', чтобы свалить с работы еще раньше в пятницу!';
				}
				else {
					message += '!';
				}
				sendToSlack(user.slack_username, message);
			}
			
			if(moment().format('HH:mm') === remainingData.endDay) {
 			//if(moment().format('HH:mm') === moment().format('HH:mm')) {
				sendToSlack(user.slack_username, 'Прошел полный рабочий день, пора домой!');
			}
			
		});
	});
});