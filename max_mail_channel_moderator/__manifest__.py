# -*- coding: utf-8 -*-
{
    'name': "Mail Channel Moderator",

    'summary': """
        Mail Channel Moderator and Public Channel Manager.
    """,

    'description': """
        Manage the creation of 'public/groups' channels, the Mail Channel Moderator controls new member joining and the 
        channel editing.       
    """,

    'author': "MAXodoo",
    'website': "http://www.maxodoo.com",
    'category': 'web',
    'version': '10.0.0.1',
    'depends': ['web', 'mail'],
    'data': [
        'views/max_mail_channel_moderator_view.xml',
        'security/security.xml',
    ],
    'qweb': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
