
$(function(){

    now.show_friends = function (friends) {
        Friends.append(friends);
    };

    now.ready(function(){
        now.initiate(function (clientId) {
            console.log("I am client "+clientId);

            $.getJSON('/friends', {user: clientId}, function () {});
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

    window.AppView = Backbone.View.extend({
        el: $("#main"),

        initialize: function () {
            Friends.bind("add", function (friend) {
                var view = new FriendView({model: friend});
                App.el.append(view.render());
            });
        }
    });

    window.App = new AppView;
});
