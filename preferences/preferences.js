const ElectronPreferences = require('electron-preferences');
const prefOptions = require('./pref-options.js');

module.exports = prefs;

function prefs() {
    let section = {
        id: 'space',
        label: 'Other Settings',
        icon: 'spaceship',
        form:{}
    };
    let form ={
        groups: []
    }
    let group ={
        label: 'Other Settings',
        fields: []
    }
    let field ={
        label: 'Foo or Bar?',
        key: 'foobar',
        type: 'radio',
        options: [
            { label: 'Foo', value: 'foo' },
            { label: 'Bar', value: 'bar' },
            { label: 'FooBar', value: 'foobar' },
        ],
        help: 'Foo? Bar?'
    }

    group.fields.push(field)
    form.groups.push(group)
    section.form = form

    prefOptions.sections.push(section)
    return new ElectronPreferences(prefOptions)
}

