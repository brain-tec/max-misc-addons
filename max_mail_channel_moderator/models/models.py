# -*- coding: utf-8 -*-

from odoo import models, fields, api, exceptions, _


class ChannelPartner(models.Model):
    _inherit = ['mail.channel.partner']

    is_moderator = fields.Boolean("Is Moderator")


class Channel(models.Model):
    _inherit = ['mail.channel']

    channel_partner_setting_ids = fields.One2many('mail.channel.partner', 'channel_id', string='Partner Settings')
    follow_by_moderator = fields.Boolean("Follow by Moderator", default=False)

    # Set current user as the channel member and the channel moderator while creating new channel.
    @api.model
    def create(self, vals):
        # To avoid duplicated member
        if vals.get('channel_partner_ids', False):
            if vals['channel_partner_ids'][0][0] == 6:
                for partner_id in vals['channel_partner_ids'][0][2]:
                    if partner_id == self.env.user.partner_id.id:
                        vals['channel_partner_ids'][0][2].remove(partner_id)
            elif vals['channel_partner_ids'][0][0] == 4:
                for partner_id in vals['channel_partner_ids']:
                    if partner_id[1] == self.env.user.partner_id.id:
                        vals['channel_partner_ids'].remove(partner_id)
        if vals.get('channel_partner_setting_ids', False):
            for setting in vals['channel_partner_setting_ids']:
                if setting[2].partner_id == self.env.user.partner_id.id:
                    vals['channel_partner_setting_ids'].remove(setting)

        vals['channel_partner_setting_ids'] = [(0, 0, {'partner_id': self.env.user.partner_id.id, 'is_moderator': True})]

        return super(Channel, self).create(vals)

    # If 'follow_by_moderator' setting is 'False', user can join public/groups channel by itself.
    @api.multi
    def action_follow(self):
        self.ensure_one()
        channel_partner = self.mapped('channel_last_seen_partner_ids').filtered(lambda cp: cp.partner_id == self.env.user.partner_id)
        if not channel_partner:
            if self.follow_by_moderator:
                return self.write(
                    {'channel_last_seen_partner_ids': [(0, 0, {'partner_id': self.env.user.partner_id.id})]})
            else:
                return self.sudo().write(
                    {'channel_last_seen_partner_ids': [(0, 0, {'partner_id': self.env.user.partner_id.id})]})

    # Anyone can leave channel by itself.
    @api.multi
    def action_unfollow(self):
        return self.sudo()._action_unfollow(self.env.user.partner_id)

    # If 'follow_by_moderator' setting is 'False', member can add other users into the channel.
    @api.multi
    def channel_invite(self, partner_ids):
        """ Add the given partner_ids to the current channels and broadcast the channel header to them.
            :param partner_ids : list of partner id to add
        """
        partners = self.env['res.partner'].browse(partner_ids)
        # add the partner
        for channel in self:
            partners_to_add = partners - channel.channel_partner_ids

            if self.follow_by_moderator:
                channel.write({'channel_last_seen_partner_ids': [(0, 0, {'partner_id': partner_id}) for
                                                                        partner_id in partners_to_add.ids]})
            else:
                channel.sudo().write({'channel_last_seen_partner_ids': [(0, 0, {'partner_id': partner_id}) for
                                                                        partner_id in partners_to_add.ids]})

            for partner in partners_to_add:
                notification = _('<div class="o_mail_notification">joined <a href="#" class="o_channel_redirect" data-oe-id="%s">#%s</a></div>') % (self.id, self.name,)
                self.sudo().message_post(body=notification, message_type="notification", subtype="mail.mt_comment", author_id=partner.id)

        # broadcast the channel header to the added partner
        self._broadcast(partner_ids)

    @api.multi
    def write(self, vals):
        # To avoid change 'Public' property
        if vals.get('public', False):
            vals.pop('public')

        # To avoid overriding existed moderator settings
        if vals.get('channel_partner_ids', False):
            if vals['channel_partner_ids'][0][0] == 6:
                new_partner_ids = vals['channel_partner_ids'][0][2]
                old_partner_ids = self.channel_partner_setting_ids.mapped('partner_id').ids
                add_partner_ids = set(new_partner_ids) - set(old_partner_ids)
                remove_partner_ids = set(old_partner_ids) - set(new_partner_ids)
                vals.pop('channel_partner_ids')
                delta = []
                if len(add_partner_ids) > 0:
                    for partner_id in add_partner_ids:
                        delta.append((4, partner_id))
                if len(remove_partner_ids) > 0:
                    for partner_id in remove_partner_ids:
                        delta.append((3, partner_id))
                if len(delta)>0:
                    vals['channel_partner_ids'] = delta

        # only root user or channel moderator can write channel.
        if self.env.user == self.env.ref(
                'base.user_root') or self.env.user.partner_id in self.channel_partner_setting_ids.filtered(
                lambda cp: cp.is_moderator == True).mapped('partner_id'):
            return super(Channel, self).write(vals)
        else:
            raise exceptions.UserError(_('Permission Denied: Please contact the channel moderator.'))
