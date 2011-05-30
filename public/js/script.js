
$(function(){
    now.show_friends = function (friends) {
        console.log("show!");
        Friends.add(_.map(friends, function (friend) {;
            return new Friend(friend);
        }));

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

        url: '/friends'
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
