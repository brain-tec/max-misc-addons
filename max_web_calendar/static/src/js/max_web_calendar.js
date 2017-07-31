odoo.define('max_web_calendar', function (require) {
    "use strict";

    var core = require('web.core'),
        time = require('web.time'),
        _t  = core._t;

    var CalendarView = require('web_calendar.CalendarView');

    function hashCode(value){
        var str = String(value);
        var h = 0;
        var len = str.length;
        for(var i = 0; i < len; i++){
            h = h + str.charCodeAt(i) * (i+1);
        }
        return h;
    }

    CalendarView.include({
        init: function () {
            this._super.apply(this, arguments);

            // add a new attribute for event hint in calendar view
            var attrs = this.fields_view.arch.attrs;
            this.tooltip_field = typeof(attrs.tooltip) == 'undefined' ? '': attrs.tooltip;
            this.color_type = typeof(attrs.color_type) == 'undefined' ? 'random': attrs.color_type;
        },

        get_fc_init_options: function () {
            var options = this._super.apply(this, arguments);
            if(this.tooltip_field.length){
                return $.extend({}, options, {
                    eventRender:function (event, element, view) {
                        options.eventRender(event, element, view);

                        // set tooltip on event
                        $(element).attr('title', $(element).find('.max_web_calendar_event_tooltip').attr('tooltip-text'));
                    }
                });
            }
            else {
                return options;
            }
        },

        // calculate a certain color based on the key value of color field
        get_color: function(key) {
            if(this.color_type === 'certain') {
                var hash = hashCode(key);
                return hash % 24 + 1;
            }
            else {
                return this._super.apply(this, arguments);
            }
        },

        // support html format in event title
        // fix translation issue of selection and boolean type fields
        // avoid showing false in nullable fields
        // attach event tooltip on the title of events
        event_data_transform: function(evt) {
            var self = this;
            var date_start;
            var date_stop;
            var date_delay = evt[this.date_delay] || 1.0,
                all_day = this.all_day ? evt[this.all_day] : false,
                res_computed_text = '',
                the_title = '',
                attendees = [];

            if (!all_day) {
                date_start = time.auto_str_to_date(evt[this.date_start]);
                date_stop = this.date_stop ? time.auto_str_to_date(evt[this.date_stop]) : null;
            } else {
                date_start = time.auto_str_to_date(evt[this.date_start].split(' ')[0],'start');
                date_stop = this.date_stop ? time.auto_str_to_date(evt[this.date_stop].split(' ')[0],'start') : null;
            }

            var event_tooltip = null

            if (this.info_fields) {
                var temp_ret = {};
                res_computed_text = this.how_display_event;

                _.each(this.info_fields, function (fieldname) {
                    var value = evt[fieldname];
                    if (_.contains(["many2one"], self.fields[fieldname].type)) {
                        if (value === false) {
                            temp_ret[fieldname] = null;
                        }
                        else if (value instanceof Array) {
                            temp_ret[fieldname] = value[1]; // no name_get to make
                        }
                        else if (_.contains(["date", "datetime"], self.fields[fieldname].type)) {
                            temp_ret[fieldname] = formats.format_value(value, self.fields[fieldname]);
                        }
                        else {
                            throw new Error("Incomplete data received from dataset for record " + evt.id);
                        }
                    }
                    else if (_.contains(["one2many","many2many"], self.fields[fieldname].type)) {
                        if (value === false) {
                            temp_ret[fieldname] = null;
                        }
                        else if (value instanceof Array)  {
                            temp_ret[fieldname] = value; // if x2many, keep all id !
                        }
                        else {
                            throw new Error("Incomplete data received from dataset for record " + evt.id);
                        }
                    }
                    // fix translation issue of selection type fields
                    else if (_.contains(["selection"], self.fields[fieldname].type)) {
                        temp_ret[fieldname] = _.find(self.fields[fieldname].selection,
                            function(name){ return name[0] === value;})[1];
                    }
                    else {
                        // to fix translation issue of boolean type fields
                        if (self.fields[fieldname].type === 'boolean') {
                            temp_ret[fieldname] = _t(value);
                        }
                        // to avoid showing false in nullable fields
                        else if (value === false) {
                            temp_ret[fieldname] = null;
                        }
                        else {
                            temp_ret[fieldname] = value;
                        }
                    }
                    // get tooltip of event
                    if (self.tooltip_field.length && fieldname === self.tooltip_field) {
                        event_tooltip = temp_ret[fieldname];
                    }
                    // add escape process to avoid html tag conflict in field data.
                    //res_computed_text = res_computed_text.replace("["+fieldname+"]",temp_ret[fieldname]);
                    res_computed_text = res_computed_text.replace("["+fieldname+"]",_.escape(temp_ret[fieldname]));
                });


                if (res_computed_text.length) {
                    the_title = res_computed_text;
                }
                else {
                    var res_text= [];
                    _.each(temp_ret, function(val,key) {
                        if( typeof(val) === 'boolean' && val === false ) { }
                        // add escape process to avoid html tag conflict in field data.
                        //else { res_text.push(val); }
                        else { res_text.push(_.escape(val)); }
                    });
                    the_title = res_text.join(', ');
                }

                // remove escape process here to enable html tag format for the display title of events
                //the_title = _.escape(the_title);

                var the_title_avatar = '';

                if (! _.isUndefined(this.attendee_people)) {
                    var MAX_ATTENDEES = 3;
                    var attendee_showed = 0;
                    var attendee_other = '';

                    _.each(temp_ret[this.attendee_people],
                        function (the_attendee_people) {
                            attendees.push(the_attendee_people);
                            attendee_showed += 1;
                            if (attendee_showed<= MAX_ATTENDEES) {
                                if (self.avatar_model !== null) {
                                           the_title_avatar += '<img title="' + _.escape(self.all_attendees[the_attendee_people]) + '" class="o_attendee_head"  \
                                                            src="/web/image/' + self.avatar_model + '/' + the_attendee_people + '/image_small"></img>';
                                }
                                else {
                                    if (!self.colorIsAttendee || the_attendee_people != temp_ret[self.color_field]) {
                                            var tempColor = (self.all_filters[the_attendee_people] !== undefined)
                                                        ? self.all_filters[the_attendee_people].color
                                                        : (self.all_filters[-1] ? self.all_filters[-1].color : 1);
                                            the_title_avatar += '<i class="fa fa-user o_attendee_head o_underline_color_'+tempColor+'" title="' + _.escape(self.all_attendees[the_attendee_people]) + '" ></i>';
                                    }//else don't add myself
                                }
                            }
                            else {
                                    attendee_other += _.escape(self.all_attendees[the_attendee_people]) +", ";
                            }
                        }
                    );
                    if (attendee_other.length>2) {
                        the_title_avatar += '<span class="o_attendee_head" title="' + attendee_other.slice(0, -2) + '">+</span>';
                    }
                    the_title = the_title_avatar + the_title;
                }
            }

            // attach event tooltip on the title of events
            if (self.tooltip_field.length && event_tooltip) {
                the_title = '<span class="max_web_calendar_event_tooltip" tooltip-text="' + event_tooltip + '">' + the_title + '</span>';
            }

            if (!date_stop && date_delay) {
                var m_start = moment(date_start).add(date_delay,'hours');
                date_stop = m_start.toDate();
            }
            var r = {
                'start': moment(date_start).format('YYYY-MM-DD HH:mm:ss'),
                'end': moment(date_stop).format('YYYY-MM-DD HH:mm:ss'),
                'title': the_title,
                'attendee_avatars': the_title_avatar,
                'allDay': (this.fields[this.date_start].type == 'date' || (this.all_day && evt[this.all_day]) || false),
                'id': evt.id,
                'attendees':attendees
            };

            var color_key = evt[this.color_field];
            if (!self.useContacts || self.all_filters[color_key] !== undefined) {
                if (color_key) {
                    if (typeof color_key === "object") {
                        color_key = color_key[0];
                    }
                    r.className = 'o_calendar_color_'+ this.get_color(color_key);
                }
            } else { // if form all, get color -1
                r.className = 'o_calendar_color_'+ (self.all_filters[-1] ? self.all_filters[-1].color : 1);
            }
            return r;
        },

    });

})
