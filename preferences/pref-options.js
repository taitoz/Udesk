
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
    about: {
      name: 'Albert'
    },
    theme: {
      theme: 'dark'
    }
  },

  // Preference sections visible to the UI
  sections: [
    {
      id: 'theme',
      label: 'Theme',
      icon: 'brightness-6',
      form: {
        groups: [{
          fields: [{
            label: 'Theme',
            key: 'theme',
            type: 'radio',
            options: [
              // {label: 'System (default)', value: 'system'},
              {label: 'Light', value: 'light'},
              {label: 'Dark', value: 'dark'},
            ],
            help: 'Light or dark theme?',
          },],
        },],
      },
    },

    {
      id: 'notes',
      label: 'Notes',
      icon: 'folder-15',
      form: {
        groups: [
          {
            label: 'Stuff',
            fields: [
              {
                label: 'Read notes from folder',
                key: 'folder',
                type: 'directory',
                help: 'The location where your notes will be stored.',
                multiSelections: false,
                noResolveAliases: false,
                treatPackageAsDirectory: false,
                dontAddToRecent: true,
              },
              {
                label: 'Select some images',
                buttonLabel: 'Choose Files',
                key: 'images',
                type: 'file',
                help: 'List of selected images',
                filters: [
                  {
                    name: 'Joint Photographic Experts Group (JPG)',
                    extensions: ['jpg', 'jpeg', 'jpe', 'jfif', 'jfi', 'jif'],
                  },
                  {
                    name: 'Portable Network Graphics (PNG)',
                    extensions: ['png'],
                  },
                  {
                    name: 'Graphics Interchange Format (GIF)',
                    extensions: ['gif'],
                  },
                  {
                    name: 'All Images',
                    extensions: [
                      'jpg',
                      'jpeg',
                      'jpe',
                      'jfif',
                      'jfi',
                      'jif',
                      'png',
                      'gif',
                    ],
                  },
                  //{ name: 'All Files', extensions: ['*'] }
                ],
                multiSelections: true, //Allow multiple paths to be selected
                showHiddenFiles: true, //Show hidden files in dialog
                noResolveAliases: false, //(macos) Disable the automatic alias (symlink) path resolution. Selected aliases will now return the alias path instead of their target path.
                treatPackageAsDirectory: false, //(macos) Treat packages, such as .app folders, as a directory instead of a file.
                dontAddToRecent: true, //(windows) Do not add the item being opened to the recent documents list.
              },
              {
                label: 'Other Settings',
                fields: [
                  {
                    label: 'Foo or Bar?',
                    key: 'foobar',
                    type: 'radio',
                    options: [
                      { label: 'Foo', value: 'foo' },
                      { label: 'Bar', value: 'bar' },
                      { label: 'FooBar', value: 'foobar' },
                    ],
                    help: 'Foo? Bar?',
                  },
                ],
              },
              {
                heading: 'Important Message',
                content:
                    '<p>The quick brown fox jumps over the long white fence. The quick brown fox jumps over the long white fence. The quick brown fox jumps over the long white fence. The quick brown fox jumps over the long white fence.</p>',
                type: 'message',
              },
            ],
          },
        ],
      },
    },

  ]
}
