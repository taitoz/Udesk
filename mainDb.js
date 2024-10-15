import Datastore from "nestdb";
import {app} from "electron";
import fs from "fs";
import path from "node:path";

const db = {};
db.profiles = new Datastore({filename: app.getPath('userData') + '/profilesDb.json', autoload: true});
//db.services = new Datastore({filename:app.getPath('userData') + '/servicesDb.json', autoload: true})
//db.pageActions = new Datastore({filename:app.getPath('userData') + '/pageActionsDb.json', autoload: true})

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

export function getServicesMenu(){
    //TODO servicesMenu to profile
    // web1cMenu to services-default
    // services-default to profile-default
}

export function setServicesMenu(){

}

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

export function importProfile(filePath) {
    const fileName = (filePath.includes('/')) ? filePath.split("/").pop() : filePath.split("\\").pop()
    let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
    newProfile.name = fileName.split(".").shift()
    let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + newProfile._id + '.json'
    fs.cpSync(filePath, appConfigPath)
    upsertProfile(newProfile)
    //refresh table
    setActiveProfile(newProfile.name)
}

export function addProfileFromDefault() {
    let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
    db.profiles.count({name: newProfile.name}, function (err, count) {
        let i = 1
        while (count !== 0) {
            newProfile.name = newProfile.name + ' ' + i;
            i++;
        }
    })
    upsertProfile(newProfile)
    return newProfile
}

export function getActiveProfile() {
    return db.profiles.count({active: true}, function (err, count) {
        if (count === 0) {
            let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
            upsertProfile(newProfile)
            return newProfile
        } else {
            return db.profiles.findOne({active: true}, (err, data) => {
                if (err) console.log(err)
                return data
            })
        }
    });
}

export function setActiveProfile(profileName) {
    db.profiles.update({}, {$set: {active: false}}, {multi: true, upsert: false}, function (err, numRemoved) {
    })
    db.profiles.update({name: profileName}, {$set: {active: true}}, {
        multi: false,
        upsert: false
    }, function (err, numRemoved) {
    })
}

export function loadFromFile(filePath) {
    //TODO add validation
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(fileContent)
    } catch (e) {
        return {severity: 'error', message: e.message}
    }
}
