odoo.define('max_mail_channel_moderator', function (require) {
'use strict';

require('mail.chat_client_action');
var core = require('web.core');
var chat_manager = require('mail.chat_manager');

core.action_registry.get('mail.chat.instant_messaging').include({
    render_sidebar: function () {
        var self = this;
        this._super();

        this.$('.o_mail_add_channel[data-type=public]').find("input").autocomplete({
            source: function(request, response) {
                self.last_search_val = _.escape(request.term);
                self.do_search_channel(self.last_search_val).done(function(result){
                    // result.push({
                    //     'label':  _.str.sprintf('<strong>'+_t("Create %s")+'</strong>', '<em>"#'+self.last_search_val+'"</em>'),
                    //     'value': '_create',
                    // });
                    response(result);
                });
            },
            select: function(event, ui) {
                if (self.last_search_val) {
                    if (ui.item.value === '_create') {
                        // chat_manager.create_channel(self.last_search_val, "public");
                    } else {
                        chat_manager.join_channel(ui.item.id);
                    }
                }
            },
            focus: function(event) {
                event.preventDefault();
            },
            html: true,
        });
    },
});

});
