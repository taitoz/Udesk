
const path = require('path')
const {app} = require('electron')

module.exports ={
  config: {
    debounce: 150, // debounce preference save settings event; 0 to disable
  },

  // Override default preference BrowserWindow values
  //browserWindowOverrides: { /* ... */ },

  // Create an optional menu bar
  //menu: Menu.buildFromTemplate(/* ... */),

  // Provide a custom CSS file, relative to your appPath.
  //css: 'preference-styles.css',

  // Preference file path. Where your preferences are saved (required)
  dataStore: path.join(app.getPath("userData"), 'preferences.json'),

  // Preference default values
  defaults: {
    theme: {
      theme: 'dark'
    }
  },

  // Preference sections visible to the UI
  sections: [
    {
      id: 'theme',
      label: 'Тема',
      icon: 'brightness-6',
      form: {
        groups: [{
          fields: [{
            label: 'Тема оформления',
            key: 'theme',
            type: 'radio',
            options: [
              // {label: 'System (default)', value: 'system'},
              {label: 'светлая', value: 'light'},
              {label: 'тёмная', value: 'dark'},
            ],
            help: 'Выберите тему оформления',
          },],
        },],
      },
    },

    {
      id: 'menuItems',
      label: 'menu Items',
      icon: 'single-01',
      form: {
        groups: [
          {
            label: 'About You',
            fields: [
              {
                label: 'name',
                key: 'name',
                type: 'text',
                /**
                 * Optional text to be displayed beneath the field.
                 */
                help: 'name?',
              },
              {
                label: 'link',
                key: 'link',
                type: 'text',
                help: 'link?',
              }]
          }]
      }
    },

    {
      id: 'menuItems',
      label: 'menuItems',
      icon: 'widget',
      form: {
        groups: [
          {
            label: 'menuItems',
            fields: [
              {
                label: 'links',
                key: 'places',
                type: 'list',
                size: 10,
                style: {
                  width: '75%',
                },
                help: 'An ordered list of links',
                orderable: true,
              },
              {
                label: 'Ipc button',
                key: 'resetButton',
                type: 'button',
                buttonLabel: 'Reload menu',
                help: 'This button sends on a custom ipc channel',
                hideLabel: false,
              },
            ],
          },
        ],
      }
    }

  ]
}
