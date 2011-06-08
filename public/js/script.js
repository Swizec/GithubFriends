
$(function(){

    now.show_friends = function (friends) {
        Friends.append(friends);
    };

    now.logged_in = function () {
        App.logged_in();
    };

    now.ready(function(){
        now.initiate(function (clientId) {
            if (!LOGGED_IN) {
                App.enable_login(clientId);
            }else{
                App.clientId = clientId;
                App.logged_in();
            }
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

    window.AppView = Backbone.View.extend({
        el: $("#main"),

	$results: $("#results"),

        initialize: function () {
            _.bindAll(this, "enable_login", "logged_in", "append_friend");

            this.loader = new LoaderView;

	    this.$results.height($(window).height()-$("header").outerHeight(true)-$("#login_stuff").outerHeight(true)-5);

            Friends.bind("add", this.append_friend);
        },

        enable_login: function (clientId) {
            this.clientId = clientId;

            var url = "/twitter_login?userid="+clientId;

            $("#login-twitter").attr("href", url)
                               .click(function (event) {
                                   event.preventDefault();

                                   App.PopUp = window.open(url,
                                                           'Login',
                                                           'width=600,height=400');
                               });
        },

        logged_in: function () {
            try {
                this.PopUp.close();
            }catch (e) {}

            $("#login-twitter").fadeOut("slow");

            $.getJSON('/user', function (data) {
                App.userView = new UserView(data);
            });

            $.getJSON('/friends', {user: this.clientId}, function () {});
        },

        append_friend: function (friend) {
            var view = new FriendView({model: friend});
            var $view = view.render();
            var $column = this.$results.find('.column').last();

	    var n = Math.floor(this.$results.height()/view.base_height);

	    $column.height(better_height);
	    $column.append($view);

            if ($column.children().size() >= n) {
                $column = this.$results.append('<ul class="column"></ul>');
            }
        }
    });

    window.App = new AppView;
});
