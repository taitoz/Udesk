
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
  css: 'preference-styles.css',

  // Preference file path. Where your preferences are saved (required)
  dataStore: path.join(app.getPath("userData"), 'preferences.json'),

  // Preference default values
  defaults: {
    about: {
      name: 'Albert'
    }
  },

  // Preference sections visible to the UI
  sections: [
    {
      id: 'about',
      label: 'About You',
      icon: 'single-01', // See the list of available icons below
      form: {
        groups: [
          {
            label: 'About You', // optional
            fields: [
              {
                label: 'Name',
                key: 'name',
                type: 'text',
                help: 'What is your name?'
              },
              // ...
            ]
          },
          // ...
        ]
      }
    },
    // ...
  ]
}
