module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// uglify
		uglify: {
			
			app: {
				files: {
					'app/app.min.js': 'app/app.js'
				}
			},
			lib: {
				files: {
					'app/libs.min.js': 'app/libs.js'
				}
			},
			templates: {
				files: {
					'app/templates.min.js': 'app/templates.js'
				}
			}
			
		},

		concat: {
			options: {
				separator: ';',
			},
			app: {
				files: {
					'app/libs.js':
					[ 'lib/jquery-1.9.1.js',
						'lib/handlebars-1.0.0.js',
						'lib/ember-1.1.2.js',
						'lib/ember-states.js',
						'lib/ember-data.js',
						'lib/moment.min.js',
						'lib/localstorage_adapter.js'
					],
					'app/app.js':
					['app.js',
						'store.js',
						'router.js',
						'routes/**/*.js',
						'models/**/*.js',
						'views/**/*.js',
						'controllers/**/*.js',
						'components/**/*.js',
						'helpers/**/*.js',
					]
				}
			},
		},

		emberTemplates: {
			compile: {
				options: {
					templateBasePath: 'templates/'
				},
				files: {
					'app/templates.js': 'templates/**/*.hbs'
				}
			}
		  }
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-ember-templates');

	grunt.registerTask('default', ['concat', 'emberTemplates', 'uglify' ]);

};