
/**
 * Module dependencies.
 */

var express = require('express');
var nowjs = require('now');
var OAuth = require('oauth').OAuth;
var settings = require('./local_settings');
var querystring = require('querystring');
var twitter = require('twitter');
var RedisStore = require('connect-redis')(require('connect'));
var MailChimpAPI = require('mailchimp').MailChimpAPI;

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'this is my dirty ilettle secret',
                            store: new RedisStore}));
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

app.get('/', function(req, res){
    res.render('index', {
        title: 'GithubFriends',
        user_logged_in: null != req.session.oauth_access_token
    });
});

app.get("/twitter_login", function (req, res) {
    var oa = new OAuth("https://api.twitter.com/oauth/request_token",
                       "https://api.twitter.com/oauth/access_token",
                       settings.twitter.key,
                       settings.twitter.secret,
                       "1.0",
                       "http://githubfriends.swizec.com/twitter_login/callback?userid="+req.query.userid,
                       "HMAC-SHA1");
    oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
        if (error) {
            console.log('error twitter login');
            //console.log(error);
        }else{
            req.session.oauth_token = oauth_token;
            req.session.oauth_token_secret = oauth_token_secret;

            res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token="+oauth_token);
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
                    try {
                        users[req.query.userid].now.logged_in();
                    }catch (e) {
                    }

                    res.end("Logged in, window should close itself");
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

    twit.get('/friends/ids.json', function (ids) {
        for (var tmp = ids.splice(0, 100);
             tmp.length > 0;
             tmp = ids.splice(0, 50)) {
            twit.get('/users/lookup.json', {user_id: tmp.join(',')},
                     function (data) {
                         try {
                             users[userId].now.show_friends(data);
                         }catch (e) {};
                     });
        }
    });

    //res.end();
});

app.get('/user', function (req, res) {
    var twit = new twitter({
        consumer_key: settings.twitter.key,
        consumer_secret: settings.twitter.secret,
        access_token_key: req.session.oauth_access_token,
        access_token_secret: req.session.oauth_access_token_secret
    });

    twit.get('/statuses/user_timeline.json', function (data) {
        res.header('Content-Type', 'application/json');
        res.end(JSON.stringify(data[0].user));
    });
});

app.get('/harvest', function (req, res) {
    res.render('harvest', {
        title: 'GithubFriends - email',
        layout: false
    });
});

app.post('/harvest', function (req, res) {
    var api = new MailChimpAPI(settings.mailchimp,
                               {version: '1.3', secure: false});

    api.listSubscribe({
        id: '20286a7f22',
        email_address: req.body.email,
        merge_vars: {FNAME: req.body.name,
                     LNAME: '',
                     MMERGE1: req.body.name},
        double_optin: false,
        send_welcome: true,
        update_existing: true
    }, function (success) {
        if (success === true) {
            res.render('harvest_done',
                       {subscribed: true,
                        layout: false});
        }else{
            res.render('harvest_done',
                       {subscribed: false,
                        layout: false});
        }
    });
});

var everyone = nowjs.initialize(app, {host: 'githubfriends.swizec.com', port: 80});
var users = [];

everyone.now.initiate = function (callback) {
    var group = nowjs.getGroup("user-"+this.user.clientId);
    group.addUser(this.user.clientId);

    users[this.user.clientId] = group;
    callback(this.user.clientId);
};

everyone.disconnected(function () {
    delete(users[this.user.clientId]);
});

// TODO: when users vanish do some cleaning up so as to not hold their group indefinitely

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port);
}
