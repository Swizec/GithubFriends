
/**
 * Module dependencies.
 */

var express = require('express');
var nowjs = require('now');
var OAuth = require('oauth').OAuth;
var settings = require('./local_settings');
var querystring = require('querystring');
var twitter = require('twitter');
var GitHubApi = require('github').GitHubApi;
var github = new GitHubApi(true);

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

function require_twitter_login(req, res, next) {
    if(!req.session.oauth_access_token) {
	res.redirect("/twitter_login?action="+querystring.escape(req.originalUrl));
	return;
    }
    next();
};

// Routes

app.get('/', require_twitter_login, require_twitter_login, function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

app.get("/twitter_login", function (req, res) {
    var oa = new OAuth("https://api.twitter.com/oauth/request_token",
                       "https://api.twitter.com/oauth/access_token",
                       settings.twitter.key,
                       settings.twitter.secret,
                       "1.0",
                       "http://githubfriends.swizec.com/twitter_login/callback",
                       "HMAC-SHA1");
    oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
        if (error) {
            console.log('error twitter login');
            //console.log(error);
        }else{
            req.session.oauth_token = oauth_token;
            req.session.oauth_token_secret = oauth_token_secret;

            res.redirect("https://api.twitter.com/oauth/authorize?oauth_token="+oauth_token);
        }
    });
});

app.get('/twitter_login/callback', function (req, res) {
    var oa = new OAuth("https://api.twitter.com/oauth/request_token",
                       "https://api.twitter.com/oauth/access_token",
                       settings.twitter.key,
                       settings.twitter.secret,
                       "1.0",
                       "http://githubfriends.swizec.com/twitter_login/callback",
                       "HMAC-SHA1");
    oa.getOAuthAccessToken(
        req.session.oauth_token,
        req.session.oauth_token_secret,
        req.param('oauth_verifier'),
        function (error, oauth_access_token, oauth_access_token_secret, results2) {
            if (error) {
                console.log('error');
                console.log(error);
            }else{
                req.session.oauth_access_token = oauth_access_token;
                req.session.oauth_access_token_secret = oauth_access_token_secret;

                if (req.param('action') && req.param('action') != '') {
                    res.redirect(req.param('action'));
                }else{
                    res.redirect("/");
                }
            }
        });
});

app.get('/friends', function (req, res) {
    var twit = new twitter({
        consumer_key: settings.twitter.key,
        consumer_secret: settings.twitter.secret,
        access_token_key: req.session.oauth_access_token,
        access_token_secret: req.session.oauth_access_token_secret
    });

    var userId = req.param('user');
    var userapi = github.getUserApi();

    var githubify = function (user) {
        userapi.search(user.name.replace(' ', '+'), function (err, data) {
            if (data.length > 0) {
                users[userId].now.show_friends(data);
            }
        });
    };

    twit.get('/friends/ids.json', function (ids) {
        for (var i=0; i<ids.length; i++) {
            twit.showUser(ids[i], githubify);
        }
    });

    //res.end();
});

var everyone = nowjs.initialize(app);
var users = [];

everyone.now.initiate = function (callback) {
    var group = nowjs.getGroup("user-"+this.user.clientId);
    group.addUser(this.user.clientId);

    users[this.user.clientId] = group;
    callback(this.user.clientId);
};

// TODO: when users vanish do some cleaning up so as to not hold their group indefinitely

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port);
}
