var Sequelize = require('sequelize');

var sequelize = new Sequelize('postgres://' + process.env.DB_USER + ':' + process.env.DB_PASS + '@' + process.env.DB_HOST + ':5432/postgres');

module.exports = sequelize;