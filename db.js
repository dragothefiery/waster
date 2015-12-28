var Sequelize = require('sequelize');

var sequelize = new Sequelize('postgres://' + process.env.DB_USER + ':' + process.env.DB_PASS + '@' + process.env.DB_HOST + ':5432/' + process.env.DB_NAME);

module.exports = sequelize;
