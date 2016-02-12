require('sugar');
var moment = require('moment');
var sequelize = require('./db')();
var q = require('q');

var weekdays = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

var WORK_DAY_MINUTES = 8.5 * 60;

function minutesToHuman(minutes) {
	minutes = minutes.abs();
	var hours = (minutes / 60).floor();
	var hoursMinutes = minutes % 60;
	return hours + ' ч. ' + hoursMinutes + ' мин.';
}

function get(username, date, countLastWeek) {

	if(countLastWeek == null) {
		countLastWeek = 1;
	}

	var relativeDate = moment();
	if(date != null) {
		relativeDate = moment(date);
	}

	var prevWeek = null;
	if(countLastWeek > 0) {		
		// Начало прошлой недели, чтобы можно было высчитать время переработки за прошлую неделю
		var endOfPrevWeek = relativeDate.clone().startOf('isoweek').subtract(1, 'day').endOf('isoweek').format('YYYY-MM-DD');
		prevWeek = get(username, endOfPrevWeek, countLastWeek - 1);
	}
	
	// Общее количество минут
	var totalMinutes = WORK_DAY_MINUTES * 5;
	
	// Сколько минут осталось
	var leftMinutes = totalMinutes;
	
	// Берем время работы с начала недели
	var startOfWeek = relativeDate.clone().startOf('isoweek').format('YYYY-MM-DD');

	// Конец недели
	var endOfWeek = relativeDate.clone().endOf('isoweek').format('YYYY-MM-DD');
	
	// Количество прошедших дней с начала недели = номеру сегодняшнего дня недели
	var daysPassed = relativeDate.isoWeekday();
	
 	// Не учитываем выходные
	if(daysPassed > 5) daysPassed = 5;
	
	var workTimes = sequelize.query(
		"SELECT date, direction FROM work_times WHERE user_id = '" + username + "' AND DATE(date) >= '" + startOfWeek + "' AND DATE(date) <= '" + endOfWeek + "' ORDER BY id ASC", 
		{type: sequelize.QueryTypes.SELECT}
	);
	
	return q.all([workTimes, prevWeek]).then(function(array) {
		var data = array[0];
		var prevWeekData = array[1];
		var daysArray = getRemaining(data, relativeDate);

		// Массив дней недели и данным по ним
		var daysObject = {};
		
		// Если некоторые дни были пропущены, считаем их как отработанные полный рабочий день
		leftMinutes -= (daysPassed - daysArray.length) * WORK_DAY_MINUTES;

		var totalOverUnderTime = 0;

		var totalPerLastWeek = null;
		// Если считаем прошлую неделю, то от оставшихся минут отнимаем то, что осталось на прошлой неделе
		if(prevWeekData) {
			totalPerLastWeek = prevWeekData.leftMinutes + (prevWeekData.prevWeekTime != null ? prevWeekData.prevWeekTime : 0);
			//console.log(totalPerLastWeek);
			leftMinutes += totalPerLastWeek;
			totalOverUnderTime -= totalPerLastWeek;
		}
		var finishedFn = function(item) { return item.outDate != null; };

		daysArray.forEach(function(dayObject) {

			// Сколько реально осталось работать в данный день. В последний день обычно меньше, если есть переработки
			var reallyLeft = (leftMinutes >= WORK_DAY_MINUTES ? WORK_DAY_MINUTES : leftMinutes);
			var totalDayMinutes = dayObject.times.sum(function(item) { return item.minutes; });
			var totalOverUnder = totalDayMinutes > reallyLeft;// ? 'переработка' : 'недоработка';
			var totalOverUnderMinutes = Math.abs(reallyLeft - totalDayMinutes);
			if(dayObject.times.last() && dayObject.times.last().outDate != null) {
				totalOverUnderTime += totalDayMinutes > reallyLeft ? totalOverUnderMinutes : -totalOverUnderMinutes;
			}

			dayObject.times.forEach(function(day) {
				// Переработка или недоработка
				var overUnder = day.minutes > WORK_DAY_MINUTES;// ? 'переработка' : 'недоработка';
				var overUnderMinutes = Math.abs((leftMinutes >= WORK_DAY_MINUTES ? WORK_DAY_MINUTES : leftMinutes) - day.minutes);
				
				// Если день длился ровно 8 ч 30 мин, не показываем нулевую переработку/недоработку
				if(day.inDate != null) {
					var from = day.inDate.format('HH:mm');
					var to = 'сейчас';
					if(day.outDate != null) to = day.outDate.format('HH:mm');
				}
				if(daysObject[dayObject.day] == null) {
					daysObject[dayObject.day] = {
						// Информация о дне
						day: dayObject.day,

						// День недели (строкой)
						weekdayName: weekdays[dayObject.day],

						// День заполнен автоматически (не было отметок пользователем)
						fake: dayObject.fake,

						// Количество минут переработка/недоработки
						overUnderMinutes: totalOverUnderMinutes,

						// Время недоработки/переработки в тексте
						overUnderText: minutesToHuman(totalOverUnderMinutes),

						// Сколько отработал за этот день
						workedThisDay: minutesToHuman(totalDayMinutes),

						// Недоработка или переработка
						overUnder: totalOverUnder,

						// Информация о времени прихода-ухода
						times: []
					}
				}
				daysObject[dayObject.day].times.push({
					
					// Сколько отработал за этот день
					workedThisDay: minutesToHuman(day.minutes),
					
					// Недоработка или переработка
					overUnder: overUnder,
					
					// Количество минут переработка/недоработки
					overUnderMinutes: overUnderMinutes,
					
					// Время недоработки/переработки в тексте
					overUnderText: minutesToHuman(overUnderMinutes),
									
					// Время прихода (строкой)
					from: from,
					
					// Время ухода (строкой)
					to: to,

					// Закончен ли этот день
					finished: day.outDate != null
				});
				
				leftMinutes -= day.minutes;
			});
			daysObject[dayObject.day].finished = daysObject[dayObject.day].times.last().finished;
		});
		daysObject = Object.values(daysObject);
		
		var latestDay = {
			day: moment(),
			minutes: 0,
			times: [
				{inDate: moment(), minutes: 0}
			]
		};
		if(daysArray.length > 0) latestDay = daysArray[daysArray.length - 1];


		// Количество минут, которые в среднем надо отработать оставшиеся дни в день
		var minutesPerLeftDays = 0;

		// Сколько всего минут отработано (не считая незавершенное время)
		var finishedMinutes = latestDay.times.filter(finishedFn).sum(function(item) { return item.minutes });

		// Сколько осталось отработать за сегодня, не считая незавершенное время
		var leftMinutesToWork = WORK_DAY_MINUTES - finishedMinutes;
						
		if(daysArray.length > 0) {
			minutesPerLeftDays = leftMinutesToWork - (totalOverUnderTime / (5 - daysArray.length + 1)).floor();		
		}
		else {			
			minutesPerLeftDays = leftMinutesToWork;
		}
		
		// Подсчет идеального окончания рабочего дня
		// Время последнего прихода сегодня + 8 ч 30 мин минус все завершенные кусочки времени сегодня
		var dayAllFinished = latestDay.times.all(finishedFn);

		if(!dayAllFinished) {

			var endOfCurrentDay = moment(latestDay.times.last().inDate).add(leftMinutesToWork, 'minutes');
			
			// Время рекомендованного конца рабочего дня
			var recommendedEndOfCurrentDay = latestDay.times.last().inDate.add(minutesPerLeftDays, 'minutes');
		}

		
		//if(leftMinutes < 0) leftMinutes = 0;
		
		var result = {
			daysObjectsArray: daysObject,
			
			// Всего переработано/недоработано
			totalOverUnderTime: totalOverUnderTime,
			
			// Всего переработано/недоработано (строка)
			totalOverUnderTimeString: minutesToHuman(totalOverUnderTime),

			// Осталось минут
			leftMinutes: leftMinutes,
			
			// Осталось всего
			left: minutesToHuman(leftMinutes),
			
			// Осталось примерно в день
			leftPerDay: minutesToHuman(minutesPerLeftDays),
			
			// Идеальный конец рабочего дня
			endDay: (endOfCurrentDay != null ? endOfCurrentDay.format('HH:mm') : ''),
			
			// 'Рекомендуемый конец рабочего дня
			recommendedEndDay: (recommendedEndOfCurrentDay != null ? recommendedEndOfCurrentDay.format('HH:mm') : ''),

			// Лишнее время на прошлой неделе
			prevWeekTime: prevWeekData != null ? prevWeekData.prevWeekTime : null,

			// Всего лишнее время за все прошлые недели
			totalPerLastWeek: totalPerLastWeek
		};

		return result;
	});	
};

// Получить соответствие дня недели и проработанных в этот день минут
// @param workTimes сырой список заходов и уходов из бд
// @param relativeDate дата относительно которой ведутся рассчеты
function getRemaining(workTimes, relativeDate) {

	// Делим объекти на группы по дате
	var groups = workTimes.groupBy(function(item) {
		return moment(item.date).format('YYYY-MM-DD');
	});

    var data = Object.values(groups)
	// Делим объекты просто на группы по 2 (вход и выход), они в идеале должны чередоваться
	.map(function(item) {
		return item.inGroupsOf(2, {});
	})
	.flatten(1)
	.map(function(group) {

		// Находим объекты входа и выхода
		var inItem  = group.find(function(item) { return item.direction === 'in'; });
		var outItem = group.find(function(item) { return item.direction === 'out'; });
		
		var inDate = moment(inItem.date);			
		

		// Если не было выхода, считаем его как сейчас
		if(outItem == null) {
			return {fake: false, day: inDate.isoWeekday(), minutes: relativeDate.diff(inDate, 'minutes'), inDate: inDate};
		}
		
		var outDate = moment(outItem.date);
		
		return {
			fake: false,
			day: inDate.isoWeekday(),
			minutes: outDate.diff(inDate, 'minutes'),
			inDate: inDate,
			outDate: outDate
		};
	});
	
	var weekdays = data.map(function(day) { return day.day; });
	var currentWeekday = moment().isoWeekday();
	
	// Заполняем пропущенные дни значениями по умолчанию
	(1).upto(currentWeekday).forEach(function(weekday, index) {
		if(weekdays.indexOf(weekday) === -1 && weekday != 6 && weekday != 7) {
			var date = moment().startOf('isoweek').add(weekday, 'days');
			
			var inDate = date.clone().hours(9).minutes(0);
			var outDate = date.clone().hours(17).minutes(30)
			data.insert({fake: true, day: weekday, minutes: WORK_DAY_MINUTES, inDate: inDate, outDate: outDate}, index);
		}
	});
	
	data = data.groupBy(function(item) {
		return item.day;
	});
	data = Object.values(data).map(function(item) {
		return {
			fake: item[0].fake,
			day: item[0].day,
			times: item.map(function(time) {
				return {
					minutes: time.minutes,
					inDate: time.inDate,
					outDate: time.outDate
				};
			})
		};
	});
	return data;
};

function write(username) {
	
	var date = moment();
	
	return sequelize.query("SELECT * FROM work_times WHERE DATE(date) = '" + date.format('YYYY-MM-DD') + "' AND user_id = '" + username + "' ORDER BY id ASC")
	.spread(function(result) {
		
		var lastDirection = 'out';
		if(result.length) {
			lastDirection = result[result.length - 1].direction;
		}
		
		if(lastDirection === 'in') {
			lastDirection = 'out';			
		}
		else {
			lastDirection = 'in';
		}
		
		var query = "INSERT INTO work_times (date, direction, user_id) VALUES ('" + date.format('YYYY-MM-DD HH:mm:ss+03') +  "', '" + lastDirection + "', '" + username + "')";
		return sequelize.query(query);	
	});		
}

function subscribe(username, slackUsername) {
	return sequelize.query("SELECT * FROM subscriptions WHERE username = '" + username + "'").spread(function(data) {
		var sub = data.length > 0 ? data[0] : null;
		var promise = q(null);
		if(sub != null) {
			var promise = sequelize.query("DELETE FROM subscriptions WHERE username = '" + username + "'")
		}
		promise.then(function() {
			if(slackUsername) {
				sequelize.query("INSERT INTO subscriptions (username, slack_username) VALUES('" + username + "', '" + slackUsername + "')");
			}				
		})
	})	
}

// Нужно чтобы легко тестировать модуль отдельно от веб странички
if(!module.parent) {
	require('dotenv').load();
	sequelize = require('./db')();

	// Начало прошлой недели, чтобы можно было высчитать время переработки за прошлую неделю
	var endOfPrevWeek = moment().startOf('isoweek').subtract(1, 'day').endOf('isoweek').format('YYYY-MM-DD');

	get('karpov_s', endOfPrevWeek).then(function(res) {
		console.log(res);
	}).done();
}

module.exports.get = get;
module.exports.subscribe = subscribe;
module.exports.write = write;
module.exports.minutesToHuman = minutesToHuman;
