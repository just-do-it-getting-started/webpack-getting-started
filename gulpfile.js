var gulp = require('gulp');
var uglify = require('gulp-uglifyjs');
var concat = require('gulp-concat');
var fs = require('fs');
var glob = require('glob');
var rename = require('gulp-rename');
var _ = require('underscore');
var browserSync = require('browser-sync');
var path = require('path');
var header = require('gulp-header');
var jshint = require('gulp-jshint');
var karma = require('karma').server;
var jsdoc = require("gulp-jsdoc");
var clean = require('gulp-clean');
var sftp = require('gulp-sftp');
var prompt = require('gulp-prompt');
var gutil = require('gulp-util');
var gulpsync = require('gulp-sync')(gulp);
var mkdirp = require('mkdirp');
var SSH2Utils = require('ssh2-utils');
var moment = require('moment');
var row2arr = require('row2arr');
var through = require('through');
var open = require('open');

var stream = require('stream');
var codeInjection = require('code-injection');
var cheerio = require('cheerio');

var crawler = require("crawler");
var htmlparser = require("htmlparser");
var async = require('async');
var FindFiles = require("node-find-files");

var compress = require('compression');

// Develop Tasks
gulp.task('bs', ['lint', 'concatjs', 'guide'], function () {
	browserSync({
		host: "dev.search.naver.com",
		server: {
			baseDir: "./",
			middleware: [compress()]
		},
		startPath: "__index.html",
		open: "external"
	});

	gulp.watch("./demo/**/*.html", ['guide', browserSync.reload]);
	gulp.watch("./src/**/*.js", ['lint', 'concatjs', browserSync.reload]);
});

gulp.task('default', ['bs']);

gulp.task('version', function() {
	var generatorConfig = require('./.yo-rc.json');

	console.info('');
	console.info(':::: Generator-SAU Version ::::');
	console.info('::::        '+ gutil.colors.yellow('v'+generatorConfig['generator-sau'].version) + '         ::::');
	console.info(':::::::::::::::::::::::::::::::');
	console.info('');
});

// Build Tasks
gulp.task('build', ['lint', 'guide'], function() {
	// release date generate
	var currentDate = moment().format('YYYY.MM.DD.');
	//var releaseDateText = ["/* release date : ", currentDate, " */\n"].join("");

	// build내부의 리스트 파일을 읽어와서 각각의 파일명으로 머지 처리
	glob('./build/*.list', function (er, files) {
		_.each(files, function (file, index, arr) {
			var outFileName = path.basename(file).replace(/\.list$/, ".merged.js");

			var arr = row2arr.readRow2ArrSync(file);

			try {
				_.each(arr, function (file) {
					// 빈 공백이 들어가 있을 경우 무시하기
					if (file.length === 0) {
						return;
					}

					var existsFile = fs.existsSync(file);

					if (existsFile === false) {
						throw new Error(gutil.colors.red("ENOENT") + " - " + file + " not found");
					}
				});

				gulp.src(arr)
					.pipe(concat(outFileName))
					.pipe(gulp.dest('./release'))
					.pipe(uglify({
						compress: {
							warnings: false,
							drop_console: true
						}
					}))
					.on("error", function (e) {
						console.log(gutil.colors.red(e));
					})
					.pipe(rename(function (path) {
						path.basename = path.basename.replace(".merged", "");
					}))
					// add release date - 사용성이 없어서 제거하는 것으로 결정
					//.pipe(header(releaseDateText))
					.pipe(gulp.dest('./release'));

			} catch (e) {
				console.error(e);
			}
		});
	});
});

gulp.task('concatjs', function () {
	// build내부의 리스트 파일을 읽어와서 각각의 파일명으로 머지 처리
	glob('./build/*.list', function (er, files) {
		_.each(files, function (file, index, arr) {
			var outFileName = path.basename(file).replace(/\.list$/, ".merged.js");

			var arr = row2arr.readRow2ArrSync(file);

			try {
				_.each(arr, function (file) {
					// 빈 공백이 들어가 있을 경우 무시하기
					if (file.length === 0) {
						return;
					}

					var existsFile = fs.existsSync(file);

					if (existsFile === false) {
						throw new Error(gutil.colors.red("ENOENT") + " - " + file + " not found");
					}
				});

				gulp.src(arr)
					.pipe(concat(outFileName))
					.pipe(gulp.dest('./release'));

			} catch (e) {
				console.error(e);
			}
		});
	});
});

gulp.task('guide', function () {
	// demo 디렉토리에 있는 모든 파일을 읽어서 타이틀 및 클래스 파싱해서 inject
	var demoDir = __dirname + '/demo';

	// 가이드 파일 경로
	var guideIndexFile = __dirname + '/__index.html';

	// 모두 읽은 후에 스트림에 저장해 놓기
	var indexHtml = fs.readFileSync(guideIndexFile);

	var readStream = new stream.Readable();
	readStream.push(indexHtml);
	readStream.push(null);

	// 다시 __index.html에 저장하기 위해 스트림 생성
	var writeStream = fs.createWriteStream(guideIndexFile);
	_executeInjectGuideList(demoDir, readStream, writeStream);
});

function _executeInjectGuideList(demoDir, readStream, writeStream) {

	// 가이드 리스트와 코드 부분 인젝션 생성
	var guideList = new codeInjection('guide_list');
	var codeViewList = new codeInjection('code');

	var oInjectCodeList = _parseGuideList(demoDir);

	guideList.inject(oInjectCodeList.guide);
	codeViewList.inject(oInjectCodeList.code);

	readStream.pipe(guideList).pipe(codeViewList).pipe(writeStream);
}

function _parseGuideList(dir) {
	var guideOutput = [];
	var codeOutput = [];

	var dirList = fs.readdirSync(dir);

	dirList.forEach(function(file) {
		var filePath = dir + '/' + file;

		var stat = fs.statSync(filePath);

		if(stat.isDirectory() === true) {
			var oInjectCodeList = _parseGuideList(filePath);

			guideOutput.push(oInjectCodeList.guide);
			codeOutput.push(oInjectCodeList.code);
		} else {
			var html = fs.readFileSync(filePath);

			$ = cheerio.load(html);

			var elTitle = $('title');
			var title = elTitle.text();
			var devClass = elTitle.attr('class');
			var devText = (devClass == 'end') ? '완료' : '개발중';
			var url = path.relative(__dirname, dir + '/' + file).replace('\\', '/'); // 윈도우라도 강제로 url 은 / 로 연결되도록 수정

			if(devClass) {
				guideOutput.push('\t\t<li> <a href="' + url + '" class="_sbjDetail" target="_blank"><span class="guide_status '+devClass+'">' + devText + '</span> ' + title + '</a> <a href="#" class="guide_btn _btnDetail">가이드 보기<span class="ic"></span></a> </li>');
				codeOutput.push('\t\t<div class="_ctnDetail hide"> <ul> <li> <code data-selector="*" data-location="' + url + '"></code> </li> </ul> </div>');
			}
		}
	});

	return {
		guide: guideOutput.join('\n'),
		code: codeOutput.join('\n')
	}
}

gulp.task('karma', function (done) {
	karma.start({
		configFile: __dirname + '/karma.conf.js',
		singleRun: false
	}, done);
});

gulp.task('lint', function () {
	gulp.src('jshint-output.html')
		.pipe(clean({force: true}));

	return gulp.src('./src/**/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('gulp-jshint-html-reporter', {
			filename: __dirname + '/jshint-output.html'
		}));
});

gulp.task('jsdoc', function () {
	return gulp.src(["./src/**/*.js", "README.md"])
		.pipe(jsdoc('./jsdoc', {
			path: './node_modules/egjs-jsdoc-template'
		}));
});


/**
 * SFTP 업로드 관련 태스크 영역
 **/
var currDirName = path.basename(__dirname);
var preject_path_prefix = _getProjectType();
var sshConfig = {
  "host": "localhost", // sstatic-ftp.naver.com
  "auth": "local",
  "remotePath": path.join("/Users/Naver/sftp/" + preject_path_prefix , currDirName), // /s/mobile/_search/bestseller
  "port": 22 // 21022
};
// production
if (gutil.env.production === true) {
  sshConfig = {
    "host": "sstatic-ftp.naver.com",
    "auth": "sstatic",
    "remotePath": path.join("/" + preject_path_prefix, currDirName),
    "port": 21022
  }
}

// 업로드 환경 셋팅
function _configFtpEnv() {
	var sshConfig = getSSHConfig();

	return new Promise(function (resolve) {
		gulp.src("*", {read: false})
			.pipe(prompt.prompt([
				{
					type: 'input',
					name: 'host',
					message: 'Please Check FTP Server Host: ',
					default: sshConfig.host
				},
				{
					type: 'input',
					name: 'port',
					message: 'Please Check FTP Server Port: ',
					default: sshConfig.port
				},
				{
					type: 'input',
					name: 'auth',
					message: 'Please Check .ftppass update file: ',
					default: sshConfig.auth
				},
				{
					type: 'input',
					name: 'remotePath',
					message: 'Please Check upload remotePath: ',
					default: sshConfig.remotePath.replace('\\', '/')
				}
			], function (res) {
				setSSHConfig({
					host: res.host,
					port: res.port,
					auth: res.auth,
					remotePath: res.remotePath
				});

        resolve();
			}));
	});
};

function getSSHConfig() {
  return sshConfig;
}

function setSSHConfig(config) {
  sshConfig = _.extend({}, sshConfig, config);
}

function _getProjectType() {
  var generatorConfig = require('./.yo-rc.json');
  var preject_path_prefix = "";

  switch(generatorConfig['generator-sau'].project_type ) {
    case 'pc':
      preject_path_prefix = 'pc';
      break;
    case 'common':
      preject_path_prefix = 'm';
      break;
    case 'mobile':
      preject_path_prefix = 'm';
      break;
    default :
      preject_path_prefix = '';
      break;
  }

  return preject_path_prefix;
}

function checkExistsRemoteFile(remoteFilePath, cb) {

	var config = getSSHConfig();
	var htAccountInfo = getReadAccountInfo();

	// local
	config = _.extend({}, config, {
		username: htAccountInfo.sstatic.username,
		password: htAccountInfo.sstatic.password
	});

	// 윈도우에서 경로문제가 있어서 무조건 / 로 변경하도록 처리
	remoteFilePath = remoteFilePath.replace(/\\/ig, '/');

	var ssh = new SSH2Utils();

	ssh.fileExists(config, remoteFilePath, function (err, exists, server, conn) {
		if (err) {
			cb(false, err);
		} else {
			cb(true)
		}
		conn.end();
	});
}

function parsePath(filepath) {
	var extname = path.extname(filepath);
	return {
		dirname: path.dirname(filepath),
		basename: path.basename(filepath, extname),
		extname: extname
	};
}

function moveReleaseFileName(remoteFile, cb) {
	// 리모트에 해당 파일이 있는지 체크
	checkExistsRemoteFile(remoteFile, function (bIsExistFile) {
		if (bIsExistFile === true) {
			// 이미 있는 파일일 경우 새로운 파일명 만들어서 재귀호출
			var newRemoteFile = renameIncreaseHotfixCount(remoteFile);
			moveReleaseFileName(newRemoteFile, cb);
		} else {
			cb(path.basename(remoteFile));
		}
	});
}

function renameIncreaseHotfixCount(filepath) {
	var pathObject = parsePath(filepath);

	var hasHotfixCount = pathObject.basename.match(/_[0-9]{1,2}$/ig);

	// 핫픽스 카운트가 없을 경우 1 붙여줌
	if (!hasHotfixCount) {
		pathObject.basename += "_1";
	} else {
		// 핫픽스 카운트가 이미 있을 경우 +1씩 증가
		var hotfixCount = parseInt(pathObject.basename.match(/_([0-9]{1,2}$)/)[1], 10) + 1;

		pathObject.basename = pathObject.basename.replace(/_([0-9]{1,2}$)/, "_" + hotfixCount);
	}

	return pathObject.dirname + "/" + pathObject.basename + pathObject.extname;
}

function _uploadClean() {
	gulp.src("./release/upload/*.js")
		.pipe(clean({force: true}));
}


//
function _beforeReleaseFileCheck() {
	var config = getSSHConfig();
	var currentDate = moment().format("YYMMDD");
	var remotePath = config.remotePath;

	mkdirp.sync("./release/upload");

	return new Promise(function (resolve) {
		glob("./release/*.js", function (er, files) {
			_.each(files, function (file) {
				var renameObject = parsePath(file);

				var releaseFileName = renameObject.basename + "_" + currentDate + renameObject.extname;

				// filter merged file
				if (/^.+merged.+.js/.test(releaseFileName) === true) {
					return false;
				}

				moveReleaseFileName(path.join(remotePath, releaseFileName), function (releaseFileName) {
					// 해당 파일명이 sftp 에 없으면 upload 디렉토리로 복사 해두기
					fs.createReadStream(file).pipe(fs.createWriteStream("./release/upload/" + releaseFileName));
				});
			});

			resolve();
		});
	});
};

// 계정 정보 입력받기
function promptAccountInfo() {
	return new Promise(function (resolve, reject) {
		gulp.src("*", {read: false})
			.pipe(prompt.prompt([
				{
					type: 'input',
					name: 'username',
					message: 'Please input username: '
				},
				{
					type: 'input',
					name: 'password',
					message: 'Please input password: '
				}
			], function (promptObject) {
				resolve(promptObject);
			}));
	});
};

// 계정 정보 변수 셋팅 & 파일 저장
function setAccountInfo(res, done) {
	if (!res.username && !res.password) {
		return false;
	}

	var htInput = {
		username: res.username,
		password: res.password
	};

	writeAccountInfo(htInput);
	setSSHConfig(htInput);

	done();
};

function getReadAccountInfo() {
	var sTargetPath = process.env.HOME + "/.sau/";
	var sAccountFileName = ".ftppass";
	var sAccountFilePath = path.join(sTargetPath, sAccountFileName);

	return JSON.parse(fs.readFileSync(sAccountFilePath, {
		encoding: "utf-8"
	}));
}


// 계정정보 파일 저장
function writeAccountInfo(htInput) {
	var sTargetPath = process.env.HOME + "/.sau/"; // 윈도우에서 홈 디렉토리 얻을 수 있도록 수정하기
	var sFileName = ".ftppass";
	var oSet = {
		"sstatic": {
			"username": htInput.username,
			"password": htInput.password
		}
	};

	mkdirp(sTargetPath, function (err) {
		fs.writeFile(sTargetPath + sFileName, JSON.stringify(oSet), "utf8", function (err) {
			console.log("account save success");
		});
	});
};

// 사용자 계정 입력받는 task
gulp.task('reset_ftp', function (done) {
	var promise = promptAccountInfo();

	promise.then(function (promptObject) {
		setAccountInfo(promptObject, function () {
			done();
		});
	});
});

// 사용자 계정 입력 받은 후 파일 생성하는 task
function _generate_account_info_file() {

	return new Promise(function (resolve) {
		var sTargetPath = path.join(process.env.HOME, ".sau"); // 윈도우에서 홈 디렉토리 얻을 수 있도록 수정하기
		var sFilePath = path.join(sTargetPath, ".ftppass");

		fs.readFile(sFilePath, "utf-8", function (err, data) {
			var bNoFile = err !== null && err.code === "ENOENT";

			if (bNoFile) { // 계정 파일이 없는 경우
				var promise = promptAccountInfo();

				promise.then(function (promptObject) {
					setAccountInfo(promptObject, done);
				});
			} else { // 계정 파일이 존재하는 경우
				var oAuthData = JSON.parse(data);
				setSSHConfig({
					username: oAuthData.sstatic.username,
					password: oAuthData.sstatic.password
				});
			}

			resolve();
		})
	});
}


/**
 * sstatic sync 를 위한 리퀘스트 호출 메소드
 * @params {Array} sstaticFileList sync 에 전달할 파일 리스트 배열
 */
var http = require('http');
var interval = 0;
function requestSyncJS(sstaticFileList) {
	return through(function() {
		var sync_url = 'http://cnd010.navercorp.com:20202/20100824-nowol-sstatic_sync/sync.cgi?url=';

		var syncRequestURI = sync_url + encodeURIComponent(sstaticFileList.join('\n'));

		// 실서비스 URL 복사를 위해 콘솔에 찍어줌
		interval && clearTimeout(interval);
		interval = setTimeout(function() {
			// url open 기능 추가
			open(syncRequestURI);

			console.log('');
			console.log(gutil.colors.green(':::: without SSL URL List(복사해서 사용하세요.) ::::'));

			// 실 서비스 URL 콘솔에 출력해줌.
			sstaticFileList.forEach(function(sstaticFile) {
				console.log(gutil.colors.yellow(sstaticFile));
			});

			console.log('');

			console.log(gutil.colors.green(':::: SSL URL List(복사해서 사용하세요.) ::::'));

			// 실 서비스 URL 콘솔에 출력해줌.
			sstaticFileList.forEach(function(sstaticFile) {
				console.log(gutil.colors.yellow(sstaticFile.replace('http://sstatic.naver.net/', 'https://ssl.pstatic.net/sstatic/')));
			});

			console.log('');
		}, 2000);
	});
}


// 입력받은 계정 정보로 파일 업로드
gulp.task('release', function () {
	var promise = null;
	_uploadClean();
	promise = _generate_account_info_file();

	promise
		.then(_beforeReleaseFileCheck)
		.then(_configFtpEnv)
		.then(function () {
			var sshConfig = getSSHConfig();
			var releaseFileList = gulp.src(["./release/upload/*.js"]);
			var files = glob.sync("./release/upload/*.js");
      var preject_path_prefix = _getProjectType();
			var sstatic_prefix = 'http://sstatic.naver.net/au/' + preject_path_prefix + '/' + currDirName;
			var sstaticFileList = files.map(function(file) {
				return (sstatic_prefix + '/' + path.basename(file)).replace('\\', '/');
			});

			console.log("/****** Config FTP Upload Status ******/");
			console.log("Target Server: ", sshConfig.host);
			console.log("Target Server Port: ", sshConfig.port);
			console.log("Upload Path: ", sshConfig.remotePath.replace('\\', '/'));
			console.log("Upload File List: ", "\n" + sstaticFileList.join("\n"));
			console.log("/**************************************/");

			releaseFileList
				.pipe(prompt.confirm({
					message: 'Upload Now?',
					default: false
				}))
				.pipe(sftp(sshConfig))
				.pipe(requestSyncJS(sstaticFileList));
		})
});
