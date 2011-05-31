
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

var github_ring =  {
    queue: [],

    userapi: github.getUserApi(),

    next: function () {
        var info = this.queue.pop();
        if (!info) return;

        console.log("nexting ", this.queue.length);

        this.userapi.search(info.t.name.replace(' ', '+'), function (err, data) {
            if (err) {
                console.log(err);
            }else{
                if (data.length > 0) {
                    for (var i=0; i<data.length; i++) {
                        data[i].twitter_username = info.t.screen_name;
                    }
                    users[info.id].now.show_friends(data);
                }
            }
        });
    },

    add: function (twitter_user, userId) {
        this.queue.unshift({t: twitter_user,
                            id: userId});
    }
};

var twitter_ring = {
    queue: [],

    next: function () {
        var info = this.queue.pop();
        if (!info) return;

        console.log("fetching user ", this.queue.length);
        info.twit.showUser(info.t, function (user) {
            console.log("adding", github_ring.queue.length);
            github_ring.add(user, info.id);
        });
    },

    add: function (twitter_id, userId, twit) {
        console.log("twittering");
        this.queue.unshift({t: twitter_id,
                            id: userId,
                            twit: twit});
    }
};

setInterval(function () {
    process.nextTick(function () {github_ring.next();});
}, 1000);
setInterval(function () {
    process.nextTick(function () {twitter_ring.next();});
}, 1000);

app.get('/friends', function (req, res) {
    var twit = new twitter({
        consumer_key: settings.twitter.key,
        consumer_secret: settings.twitter.secret,
        access_token_key: req.session.oauth_access_token,
        access_token_secret: req.session.oauth_access_token_secret
    });

    var userId = req.param('user');

    twit.get('/friends/ids.json', function (ids) {
        twit.get('/user/lookup.json', {user_id: ids.splice(0, 20).join(',')},
                 function (err, data) {
                     console.log(ids.splice(0, 20).join(','));
                     console.log(err);
                     console.log(data);
                 });
/*        for (var i=0; i<ids.length; i++) {
            twitter_ring.add(ids[i], userId, twit);
       }*/
    });

    //res.end();
});

var everyone = nowjs.initialize(app, {host: 'githubfriends.swizec.com', port: 80});
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
