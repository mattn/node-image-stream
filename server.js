var sys = require('sys'),
    fs = require('fs'),
    url = require('url'),
    http = require('http'),
    websocket = require('websocket-server'),
    basicauth = require('http-basic-auth');

// load twitter account
var account = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'))

// static file server
var extmap = {'.htm': 'text/html', '.css': 'text/css'};
var server = http.createServer(function(req, res){
  var uri = url.parse(req.url).pathname;  
  if (uri.match('/$')) uri = '/index.html'
  try {
    var filename = __dirname + '/static' + uri;
	var contenttype = extmap[filename.substr(filename.lastIndexOf("."), 4)] || 'application/octet-stream';
    var rs = fs.createReadStream(filename);
    res.writeHead(200, {'Content-Type': contenttype});
    sys.pump(rs, res);
  } catch(e) {
    console.log(e);
    res.sendHeader(404, {"Content-Type": "text/plain"});  
    res.write("Not Found\n");  
    res.close();  
  }
});
server.listen(80);

// listen websocket server on the server
var ws = websocket.createServer({server: server});

// twitter filter stream
var basicauthclient = basicauth.createClient(80, 'stream.twitter.com', false, false, account)
var req = basicauthclient.request('GET', '/1/statuses/filter.json?track=picplz,instagr', {'host': 'stream.twitter.com'})
req.end();
req.on('response', function (res) {
  res.on('data', function(chunk) {
    try {
      var tweet = JSON.parse(chunk);
      // parse entities urls
      [].forEach.call(tweet.entities.urls, function(item) {
         // pick images of instagr.am or picplz.com
         if (item.url.match('^http://instagr.am/p/')) {
           var client = http.createClient(80, 'instagr.am');
           var req = client.request('GET', '/api/v1/oembed/?format=json&maxheight=330&url=' + item.url, {'host': 'instagr.am'});
           req.on('response', function(res){
             res.on('data', function(chunk){
               var url = JSON.parse(chunk).url
               console.log(url)
               ws.broadcast(url)
             });
           });
           req.end();
         }
         if (item.url.match('^http://picplz.com/')) {
           var url = item.url + '/thumb/400'
           console.log(url)
           ws.broadcast(url)
         }
      });
    } catch(e) { console.log(e) }
  });
});
