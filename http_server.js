var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    mm = require('musicmetadata'),
    Mplayer = require('./node-mplayer.js'),
    audio = new Mplayer(undefined),
    __VOLUME__ = 30,
    __M_ID__ = "",
    port = process.argv[2] || 8888;


  audio.on("error", function(e) {
    console.log(e);
  });

http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname,
      param = uri.split("/");
      filename = process.cwd();

  switch(param[1]) {
    case 'play':
      __M_ID__ = param[2];
      audio.setFile( atob(__M_ID__) );
      audio.play({volume: __VOLUME__});
      jsonResp("playing");
      break;
    case 'pause':
      audio.pause();
      jsonResp("paused");
      break;
    case 'volume':
      if(!param[2]) {
        audio.getVolume(function(r) {
          __VOLUME__ = r;
          jsonResp(r);
        });
      } else {
        if(!Number(param[2])) jsonResp("volume level must be a number");
        else {
          audio.setVolume(param[2]);
          __VOLUME__ = param[2];
          jsonResp("volume set to "+param[2]);
        }
      }
      break;
    case 'list':
      getList(function(r) {
        jsonResp(r);
      });
      break;
    case 'm_id':
      jsonResp(__M_ID__);
      break;
    default:
      filename += '/index.html';
      htmlResp(filename);
      break;
  }
  
  function htmlResp(filename) {
    fs.exists(filename, function(exists) {
      if(!exists) {
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.write("404 Not Found\n");
        response.end();
        return;
      }

      fs.readFile(filename, "binary", function(err, file) {
        if(err) {        
          response.writeHead(500, {"Content-Type": "text/plain"});
          response.write(err + "\n");
          response.end();
          return;
        }

        response.writeHead(200);
        response.write(file, "binary");
        response.end();
      });
    });
  }

  function jsonResp(message) {

    var jstr = {
      message: message
    };
    jstr = JSON.stringify(jstr,null,2);

    response.writeHead(200, {"Content-Type": "application/json"});
    response.write(jstr);
    response.end();
    return;
  }

}).listen(parseInt(port, 10));

function scanfsForAudioFiles(libdir, listfile, callback) {

  //http://stackoverflow.com/a/31831122
  var results = [];
  function dirTreeToFileList(dir, done) {
    
    fs.readdir(dir, function(err, list) {
      if (err)
        return done(err);

      var pending = list.length;

      if (!pending) //empty dir
          return done(null, results); //done is callback

      list.forEach(function(file) {
        file = path.resolve(dir, file);
        fs.stat(file, function(err, stat) {
          if (stat && stat.isDirectory()) {
            //directory
            dirTreeToFileList(file, function(err, res) {
              if (!--pending)
                done(null, results);
            });
          }
          else {
            //file
            var ext4 = file.substr(-4),
                ext3 = file.substr(-3);

            if(ext4=="flac"||ext3=="mp3"||ext3=="ogg"||ext3=="m4a"||ext3=="m4v") { //audio file
              mm(fs.createReadStream(file), function (err, metadata) {
                if (err) metadata = {};
                if(metadata.picture) metadata.picture = [];
                results.push({
                  name: file,
                  metadata: metadata
                });

                if (!--pending)
                  done(null, results);
              });
            }
            else if (!--pending) { //unrecognized file
              done(null, results);
            }
          }
        });
      });
    });
  };

  var dirTree = libdir;

  dirTreeToFileList(dirTree, function(err, res){
    if(err)
      console.error(err);
    else {
      fs.writeFile(listfile, JSON.stringify(res,null,2) , function(err) {
        if(err) {
          return console.log(err);
        }
        callback();
      });
    }
  });
}

var libdir = "/home/raphael/Musique",
    listfile = "/home/raphael/Musique/musiclist.json";
scanfsForAudioFiles(libdir, listfile, function() {
  console.log("scan done");
});

function atob(str) {
  return new Buffer(str, 'base64').toString('binary');
}

function getList(callback) {
  fs.readFile(listfile, 'utf8', function (err,data) {
  if (err) {
    console.log(err);
    callback(err);
  }
  callback(JSON.parse(data));
});
}

console.log("Server running at http://localhost:" + port);
