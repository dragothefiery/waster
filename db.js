var Sequelize = require('sequelize');
console.log(process.env);
var sequelize = new Sequelize('postgres://' + process.env.DB_USER + ':' + process.env.DB_PASS + '@' + process.env.DB_HOST + ':5432/' + process.env.DB_NAME);

module.exports = sequelize;
