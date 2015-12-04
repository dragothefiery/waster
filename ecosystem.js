module.exports = {
	/**
	 * This is a sample configuration file for PM2
	 */

	/**
	 * Here we declare the apps that must be managed by PM2
	 * All options are listed here:
	 * https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#json-app-declaration
	 *
	 */
	apps : [

		// First application
		{
			name      : "waster",
			script    : "./bin/www",
			env: {
				COMMON_VARIABLE: "true"
			},
			env_production : {
				NODE_ENV: "production"
			}
		}

	],


	/**
	 * PM2 help you to deploy apps over your servers
	 * For more help go to :
	 * https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#deployment-pm2--090
	 */
	deploy : {
		production : {
			user : "deployer",
			host: "212.71.232.173",
			port: "12222",
			ref  : "origin/master",
			repo : "https://github.com/dragothefiery/waster.git",
			path : "/usr/local/www/waster",
			"post-deploy" : "cp /usr/local/www/waster/shared/.env /usr/local/www/waster/current/.env && npm install && pm2 startOrRestart ecosystem.json --env production"
		}
	}
}

