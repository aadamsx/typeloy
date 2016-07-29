var spawn = require('child_process').spawn;
var archiver = require('archiver');
var fs = require('fs');
var pathResolve = require('path').resolve;

import _ = require('underscore');

type Path = string;

/**
 * @param {Function(err)} callback
 */
export function buildApp(appPath:Path, meteorBinary:Path, buildLocation:Path, callback) {
  callback = _.once(callback);
  var bundlePath = pathResolve(buildLocation, 'bundle.tar.gz');
  fs.exists(bundlePath, (exists) => {
    if (exists) {
      console.log("Found existing bundle file: " + bundlePath);
      return callback();
    }
    buildMeteorApp(appPath, meteorBinary, buildLocation, function(code) {
      if (code == 0) {
        archiveIt(buildLocation, callback);
      } else {
        console.log("\n=> Build Error. Check the logs printed above.");
        callback(new Error("build-error"));
      }
    });
  });
}

function buildMeteorApp(appPath:Path, executable:Path, buildLocation:Path, callback) {
  var args : Array<string> = [
    "build", "--directory", buildLocation, 
    "--server", "http://localhost:3000"
  ];
  
  var isWin = /^win/.test(process.platform);
  if (isWin) {
    // Sometimes cmd.exe not available in the path
    // See: http://goo.gl/ADmzoD
    executable = process.env.comspec || "cmd.exe";
    args = ["/c", "meteor"].concat(args);
  }

  var options = {"cwd": appPath};

  console.log("Building meteor app: ", executable, args, options);

  var meteor = spawn(executable, args, options);
  var stdout = "";
  var stderr = "";
  meteor.stdout.pipe(process.stdout, {end: false});
  meteor.stderr.pipe(process.stderr, {end: false});
  meteor.on('close', callback);
}

function archiveIt(buildLocation:string, callback) {
  callback = _.once(callback);
  var bundlePath:Path = pathResolve(buildLocation, 'bundle.tar.gz');
  var sourceDir:Path = pathResolve(buildLocation, 'bundle');

  console.log("Creating tar bundle: " + bundlePath);
  console.log("Bundle source: " + sourceDir);

  var output  = fs.createWriteStream(bundlePath);
  var archive = archiver('tar', {
    gzip: true,
    gzipOptions: {
      level: 6
    }
  });

  archive.pipe(output);
  output.once('close', callback);

  archive.once('error', (err) => {
    console.log("=> Archiving failed:", err.message);
    callback(err);
  });
  archive.directory(sourceDir, 'bundle').finalize();
}