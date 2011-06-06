
$(function(){

    now.show_friends = function (friends) {
        Friends.append(friends);
    };

    now.logged_in = function () {
        window.PopUp.close();

        $.getJSON('/friends', {user: window.clientId}, function () {});
    };

    now.ready(function(){
        now.initiate(function (clientId) {
            window.clientId = clientId;
            console.log("I am client "+clientId);

            var url = "/twitter_login?userid="+clientId;

            $("#login-twitter").attr("href", url)
                               .click(function (event) {
                                   event.preventDefault();

                                   window.PopUp = window.open(url,
                                                              'Login',
                                                              'width=600,height=400');
                               });
        });
    });
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
                data.users[0].twitter_username = this.raw_friends[i].screen_name;
                this.add(new Friend(data.users[0]));
            }
        }
    });

    window.Friends = new FriendList;

    window.FriendView = Backbone.View.extend({
        tagName: 'ul',

        template: $("#friend-template"),

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

            Friends.bind("processing", function (user) {
                self.data = user;
                self.render();
            });
        },

        render: function () {
            this.el.html(this.template.tmpl(this.data));
        }
    });

    window.AppView = Backbone.View.extend({
        el: $("#main"),

        initialize: function () {
            this.loader = new LoaderView;

            Friends.bind("add", function (friend) {
                var view = new FriendView({model: friend});
                App.el.append(view.render());
            });
        }
    });

    window.App = new AppView;
});
