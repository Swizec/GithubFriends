
$(function(){

    now.show_friends = function (friends) {
        Friends.append(friends);
    };

    now.logged_in = function () {
        FrontPage.logged_in();
    };

    now.ready(function(){
        now.initiate(function (clientId) {
            App.clientId = clientId;
            FrontPage.start();
        });
    });

    $("#main").css({height:($(document).height()-2)+"px"});
});

$(function () {
    window.Friend = Backbone.Model.extend({
    });

    window.FriendList = Backbone.Collection.extend({
        model: Friend,

        url: '/friends',

        raw_friends: [],

        round_i: 0,

        initialize: function () {
            _.bindAll(this, "append", "_round", "_append", "new");

            setInterval(this._round, 1000);
        },

        append: function (friends) {
            for (var i=0; i<friends.length; i++) {
                this.raw_friends.push(friends[i]);
            }
        },

        _round: function () {
            if (this.round_i < this.raw_friends.length) {
                this.trigger("processing", this.raw_friends[this.round_i]);
                this._append(this.round_i);
                this.round_i += 1;
            }
        },

        _append: function (i) {
            var name = this.raw_friends[i].name.replace(' ', '+');
            var callback = '(function (data) { Friends.new(data, '+i+'); })';

            $("body").append('<script src="http://github.com/api/v2/json/user/search/'+name+'?callback='+callback+'"></script>');
        },

        new: function (data, i) {
            if (data.users.length == 1) {
                data.users[0].twitter = this.raw_friends[i];
                this.add(new Friend(data.users[0]));
            }
        }
    });

    window.Friends = new FriendList;

    window.FriendView = Backbone.View.extend({
        tagName: 'li',

        template: $("#friend-template"),

	base_height: $("#friend-template").outerHeight(),

        initialize: function () {
            _.bindAll(this, "render");
            this.model.bind('change', this.render);
            this.model.view = this;
        },

        render: function () {
            var $el = $(this.el);

            $el.addClass("person");
            $el.html(this.template.tmpl(this.model.toJSON()));

            return $el;
        }
    });

    window.LoaderView = Backbone.View.extend({
        template: $("#loader-template"),

        el: $("#loader"),

        data: {},

        initialize: function () {
            _.bindAll(this, "render");

            var self = this;

            this.fadeTime = $(window).width()/60/2*1000;

            Friends.bind("processing", function (user) {
                self.data = user;
                self.render();
            });
        },

        render: function () {

            var $item = $("<div></div>");
            $item.html(this.template.tmpl(this.data))
                 .addClass('item');

            this.el.prepend($item);

            var self = this;
            $item.css({opacity: 0})
                 .animate({opacity: 1.0},
                          self.fadeTime,
                         function () {
                             $(this).animate({opacity: 0},
                                             self.fadeTime);
                         });
        }
    });

    window.UserView = Backbone.View.extend({
        template: $("#user-template"),
        el: $("#user"),

        initialize: function (data) {
            this.el.html(this.template.tmpl(data));
            this.el.fadeIn("slow");
        }
    });

    window.ColumnView = Backbone.View.extend({
	tagName: 'ul',

	initialize: function () {
	    _.bindAll(this, "render", "append");

	    this.friends = [];
	},

	render: function () {
	    var tmp = new FriendView({model: new Friend()});
	    this.max_n = Math.floor(App.$results.height()/tmp.base_height);

	    this.el = $(this.el).addClass("column");
	    return this.el;
	},

	append: function (friend) {
	    var view = new FriendView({model: friend});

	    this.friends.push(view);
	    this.el.append(view.render());

            return this.friends.length >= this.max_n;
	}
    });

    window.AppView = Backbone.View.extend({
        el: $("#main"),

	columns: [],

	$results: $("#results"),

        initialize: function () {
            _.bindAll(this, "append_friend", "new_column", "start_scrape");

            this.loader = new LoaderView;

	    this.$results.height($(window).height()-$("header").outerHeight(true)-$("#login_stuff").outerHeight(true)-$("#user").outerHeight(true)-15);

            Friends.bind("add", this.append_friend);
            FrontPage.bind("logged_in", this.start_scrape);
        },

        append_friend: function (friend) {
	    var column = _.last(this.columns);
	    var full = column.append(friend);
	    if (full === true) {
		this.new_column();
	    }

            $("#counter").html(Friends.length);
        },

	new_column: function () {
	    var column = new ColumnView;
	    this.columns.push(column);
	    this.$results.append(column.render());
	},

        start_scrape: function () {
            $.getJSON('/user', function (data) {
                App.userView = new UserView(data);
            });

            $.getJSON('/friends', {user: this.clientId}, function () {});
        }
    });

    window.FrontPageView = Backbone.View.extend({
        el: $("#frontpage"),

        initialize: function () {
            _.bindAll(this, "start", "enable_login", "logged_in", "hide");
        },

        start: function () {
            if (LOGGED_IN) {
                this.$("#login").fadeOut("slow");
                this.$("#email").fadeIn("slow");
                this.trigger("logged_in");
                this.hide(4);
            }else{
                this.enable_login();
            }
        },

        enable_login: function () {
            var url = "/twitter_login?userid="+App.clientId;

            this.$("#login a").attr("href", url)
                .click(function (event) {
                    event.preventDefault();

                    FrontPage.PopUp = window.open(url,
                                                  'Login',
                                                  'width=600,height=400');
                });
        },

        logged_in: function () {
            try {
                this.PopUp.close();
            }catch (e) {}

            this.$("#login").fadeOut("slow");
            this.$("#email").fadeIn("slow");

            this.hide(20);

            this.trigger("logged_in");
        },

        hide: function (seconds) {
            if (seconds <= 0) {
                this.el.fadeOut("slow",
                                function () {
                                    $(this).addClass("hidden");
                                });
            }

            this.$("#countdown").html("Hiding in "+seconds+" seconds ...").css("display", "block");
            var self = this;
            setTimeout(function () { self.hide(seconds-1);  }, 1000);
        }
    });

    window.FrontPage = new FrontPageView;
    window.App = new AppView;
    App.new_column();
});
