import Datastore from "nestdb";
import {app} from "electron";
import fs from "fs";
import path from "node:path";

const db = {};
db.profiles = new Datastore({filename: app.getPath('userData') + '/profilesDb.json', autoload: true});
//db.services = new Datastore({filename:app.getPath('userData') + '/servicesDb.json', autoload: true})
//db.pageActions = new Datastore({filename:app.getPath('userData') + '/pageActionsDb.json', autoload: true})

export function setProfileKey(profileName, key, value) {
    const profile = getProfile(profileName)
    if (!profile) return
    profile.data.forEach(data => {
        if (data.key === key) {
            data.value = value
        }
    })
    upsertProfile(profile);
}

export function getProfileKey(profileName, keyName) {
    const profile = getProfile(profileName)
    return profile.data.find(p => p.key === keyName).value
}

export function getProfiles() {
    return db.profiles.getAllData()
}

export function getProfile(profileName) {
    return db.profiles.findOne({name: profileName}, (err, data) => {
        if (err) console.log(err)
        return data
    })
}

export function deleteProfile(profileName) {
    db.profiles.remove({name: profileName}, {multi: true}, function (err, numRemoved) {
        if (err) console.log(err)
    })
    db.profiles.persistence.compactDatafile()
}

export function upsertProfile(profile) {

    // db.profiles.insert(profile)

    db.profiles.update({name: profile.name}, profile, {upsert: true}, function (err, numAffected, affectedDocuments, upsert) {
        if (err) console.log(err)
        console.log(numAffected)
    })

    db.profiles.persistence.compactDatafile()
}

export function initDb() {
    return new Datastore({
        filename: app.getPath('userData') + '/nestDb.json', autoload: true
        , onload: function (err) {
            if (err) {
                console.error('Failed to load the datastore:', err);
            } else {
                console.log('Loaded the datastore!');
            }
        }
    });
}

export function loadActiveProfile(){


    let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
}

function loadFromFile(filePath) {
    //TODO add validation
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(fileContent)
    } catch (e) {
        return {severity: 'error', message: e.message}
    }
}

