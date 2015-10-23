// Karma configuration
// Generated on Tue Mar 24 2015 11:41:40 GMT+0900 (KST)

module.exports = function (config) {
    config.set({

        // update path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['jasmine'],


        // list of files / patterns to load in the browser
        files: [
            // for sample test
            'https:\/\/m.search.naver.com\/acao\/js\/2015\/nx_0604.js',
            './bower_components/jquery/dist/jquery.min.js',

            {pattern: './test/**/*.html', watched: true, served: true, included: false},

            './src/**/*.js',
            './test/**/spec.js'
        ],


        // list of files to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            './src/**/*.js': ['coverage']
        },


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress', 'coverage'],

        // optionally, configure the reporter
        coverageReporter: {
            type : 'html',
            dir : 'coverage/'
        },


        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: update.LOG_DISABLE || update.LOG_ERROR || update.LOG_WARN || update.LOG_INFO || update.LOG_DEBUG
        logLevel: config.LOG_INFO,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome'],


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: false,

        proxies:  {
            '/test': '/update/test'
        }
    });
};
