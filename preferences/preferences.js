const ElectronPreferences = require('electron-preferences');
const prefOptions = require('pref-options.js');

module.exports = prefs;

function prefs() {
    prefOptions.sections.push(    {
        id: 'space',
        label: 'Other Settings',
        icon: 'spaceship',
        form: {
            groups: [
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
            ],
        }
    })
    return new ElectronPreferences(prefOptions)
}

