require('sugar');
var moment = require('moment');
var sequelize = require('./db');

var weekdays = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

var WORK_DAY_MINUTES = 8.5 * 60;

function minutesToHuman(minutes) {
	var hours = (minutes / 60).floor();
	var hoursMinutes = minutes % 60;
	return hours + ' ч. ' + hoursMinutes + ' мин.';
}

function minutesToString(username) {
	
	// Общее количество минут
	var totalMinutes = WORK_DAY_MINUTES * 5;
	
	// Сколько минут осталось
	var leftMinutes = totalMinutes;
	
	// Берем время работы с начала недели
	var startOfWeek = moment().startOf('isoweek').format('YYYY-MM-DD');
	
	// Количество прошедших дней с начала недели = номеру сегодняшнего дня недели
	var daysPassed = moment().isoWeekday();
// 	var daysPassed = 4;

 	// Не учитываем выходные
	if(daysPassed > 5) daysPassed = 5;

	var q = require('q');
	var workTimes = q();
	
	//var workTimes = sequelize.query(
		//"SELECT date, direction FROM work_times WHERE user_id = '" + username + "' AND DATE(date) >= '" + startOfWeek + "' ORDER BY date ASC", 
		//{type: sequelize.QueryTypes.SELECT}
	//);

	var datas = [
		{date: '2016-01-20 11:00:00', direction: 'in'},
		{date: '2016-01-20 19:30:00', direction: 'out'},
		{date: '2016-01-21 11:00:00', direction: 'in'},
		{date: '2016-01-21 14:00:00', direction: 'out'},
		{date: '2016-01-21 14:30:00', direction: 'in'},
		{date: '2016-01-21 16:00:00', direction: 'out'},
		{date: '2016-01-22 11:00:00', direction: 'in'},
		{date: '2016-01-22 19:30:00', direction: 'out'},
	];

	return workTimes.then(function(data) {
		var daysArray = getRemaining(datas);
// 		console.log(daysArray);

		// Массив дней недели и данным по ним
		var daysObject = {};
		
		// Если некоторые дни были пропущены, считаем их как отработанные полный рабочий день
		leftMinutes -= (daysPassed - daysArray.length) * WORK_DAY_MINUTES;
		
		var totalOverUnderTime = 0;
		
		daysArray.forEach(function(dayObject) {
			
			// Переработка или недоработка

			dayObject.times.forEach(function(day) {
				var overUnder = day.minutes > WORK_DAY_MINUTES ? 'переработка' : 'недоработка';
				var overUnderMinutes = Math.abs((leftMinutes >= WORK_DAY_MINUTES ? WORK_DAY_MINUTES : leftMinutes) - day.minutes);
				if(day.outDate != null) {
					totalOverUnderTime += day.minutes > WORK_DAY_MINUTES ? overUnderMinutes : -overUnderMinutes;				
				}			
				
				var str = weekdays[dayObject.day] + ': ' + minutesToHuman(day.minutes);
				
				// Если день длился ровно 8 ч 30 мин, не показываем нулевую переработку/недоработку
				if(overUnderMinutes != 0) {
					str += ', ' + overUnder + ' ' + minutesToHuman(overUnderMinutes);
					
					if(day.inDate != null) {
						var from = day.inDate.format('HH:mm');
						var to = 'сейчас';
						if(day.outDate != null) to = day.outDate.format('HH:mm');
						str += ' (с ' + from + ' до ' + to + ')';
					}
				}

				if(daysObject[dayObject.day] == null) {
					daysObject[dayObject.day] = {
						day: dayObject.day,
						fake: dayObject.fake,
						times: []
					}
				}
				daysObject[dayObject.day].times.push({
					str: str,
					inDate: from,
					outDate: to,
				});
				
				leftMinutes -= day.minutes;
			});
		});

		daysObject = Object.values(daysObject).map(function(item) {return item.times});
		console.log(daysObject);
		
		
		var latestDay = {
			day: moment(),
			minutes: 0,
			inDate: moment()
		};
		if(daysArray.length > 0) latestDay = daysArray[daysArray.length - 1];
		
		// Подсчет окончания рабочего дня
		// Если на неделе осталось отработать больше одного рабочего дня, тогда считаем с учетом того, что уже было отработано сегодня
		// В противном случае (по пятницам, например), конец дня это сейчас + сколько осталось отработать всего
// 		var endOfCurrentDay = moment().add((leftMinutes >= WORK_DAY_MINUTES ? WORK_DAY_MINUTES - latestDay.minutes : leftMinutes), 'minutes');
// 		
		// Подсчет идеального окончания рабочего дня
		// Время прихода сегодня + 8 ч 30 мин
		var endOfCurrentDay = moment(latestDay.inDate).add(WORK_DAY_MINUTES, 'minutes');	
		
		// Количество минут, которые в среднем надо отработать оставшиеся дни в день
		if(daysArray.length > 0) {
			var minutesPerLeftDays = WORK_DAY_MINUTES - (totalOverUnderTime / (5 - daysArray.length + 1)).floor();		
		}
		else {			
			var minutesPerLeftDays = WORK_DAY_MINUTES;
		}
		
		// Время рекомендованного конца рабочего дня
		var recommendedEndOfCurrentDay = latestDay.inDate.add(minutesPerLeftDays, 'minutes');
		
		
		var result = {
			daysObjectsArray: daysObjectsArray,
			
			// Осталось всего
			left: minutesToHuman(leftMinutes),
			
			// Осталось примерно в день
			leftPerDay: minutesToHuman(minutesPerLeftDays),
			
			// Идеальный конец рабочего дня
			endDay: endOfCurrentDay.format('HH:mm'),
			
			// 'Рекомендуемый конец рабочего дня
			recommendedEndDay: recommendedEndOfCurrentDay.format('HH:mm'),
		};

		return result;
	});	
};

// Получить соответствие дня недели и проработанных в этот день минут
function getRemaining(workTimes) {
	
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
			return {fake: false, day: inDate.isoWeekday(), minutes: moment().diff(inDate, 'minutes'), inDate: inDate};
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
		if(weekdays.indexOf(weekday) === -1) {
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

minutesToString('karpov_s').then(function(res) {
	console.log(res);
});

module.exports = minutesToString;
module.exports.minutesToHuman = minutesToHuman;
