import Datastore from "nestdb";
import {app} from "electron";
import fs from "fs";
import path, {dirname} from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = {};
db.profiles = new Datastore({filename: app.getPath('userData') + '/profilesDb.json', autoload: true});
//db.services = new Datastore({filename:app.getPath('userData') + '/servicesDb.json', autoload: true})
//db.pageActions = new Datastore({filename:app.getPath('userData') + '/pageActionsDb.json', autoload: true})

export function initDb() {
    // C:\Users\user\AppData\Roaming\Udesk\settings.json
    // /home/developer/.config/Udesk/settings.json
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

export async function setProfileKey(profileName, key, value) {
    const profile = await getProfile(profileName)
    if (!profile) return
    console.log(profileName, key, value)
    if (key === 'name') {
        await renameProfile(profileName, value)
    } else {
        profile.data.forEach(data => {
            if (data.key === key) {
                data.value = value
            }
        })
        await upsertProfile(profile)
    }
}

export async function renameProfile(oldProfileName, newProfileName) {
    return new Promise(async (resolve, reject) => {
        let profileCount = await countProfile({name: newProfileName})
        if (profileCount > 0) {
            reject('Already exists')
        }
        db.profiles.update({name: oldProfileName}, {$set: {name: newProfileName}}, function (err, numAffected, affectedDocuments, upsert) {
            db.profiles.persistence.compactDatafile()
            resolve(numAffected)
        })
    })
}

export async function getProfileKey(profileName, keyName) {
    let res = null
    const profile = await getProfile(profileName)
    if (profile) {
        res = profile.data.find(p => p.key === keyName).value
    }
    return res
}

export function getProfiles() {
    return db.profiles.getAllData();
}

export async function getProfile(profileName) {
    return new Promise((resolve, reject) => {
        db.profiles.findOne({name: profileName}, (err, doc) => {
            if (err) reject(err);
            else resolve(doc);
        });
    });
}

export async function countProfile(query) {
    return new Promise((resolve, reject) => {
        db.profiles.count(query, (err, count) => {
            if (err) reject(err);
            else resolve(count);
        });
    });
}

export async function deleteProfile(profileName) {
    return new Promise((resolve, reject) => {
        db.profiles.remove({name: profileName}, {multi: false}, function (err, numRemoved) {
            if (err) reject(err);
            db.profiles.persistence.compactDatafile()
            resolve(numRemoved);
        })
    })
}

export async function upsertProfile(profile) {
    return new Promise(async (resolve, reject) => {
        // db.profiles.insert(profile)
        let profileCount = await countProfile({name: profile.name})
        db.profiles.update({name: profile.name}, profile, {upsert: (profileCount === 0)}, function (err, numAffected, affectedDocuments, upsert) {
            if (err) reject(err);
            db.profiles.persistence.compactDatafile()
            resolve(numAffected);
        })
    })
}

export async function importProfile(filePath) {
    const fileName = (filePath.includes('/')) ? filePath.split("/").pop() : filePath.split("\\").pop()
    let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
    newProfile.name = fileName.split(".").shift()
    // let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + newProfile.name + '.json'
    // fs.cpSync(filePath, appConfigPath)
    await upsertProfile(newProfile)
    //refresh table
    setActiveProfile(newProfile.name)
}

export async function addProfileFromDefault() {
    return new Promise(async (resolve, reject) => {
        let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
        let profileCount = await countProfile({name: newProfile.name})
        while (profileCount > 0) {
            newProfile.name = newProfile.name + ' ' + profileCount;
            profileCount = await countProfile({name: newProfile.name})
        }
        // let date = new Date(newFromFile.id).toISOString().slice(0, 19).replace('T', ' ')
        // newProfile.sideMenuTreeNodes = loadFromFile(path.join(__dirname, 'assets', 'web1c.json'))
        await upsertProfile(newProfile)
        setActiveProfile(newProfile.name)
        resolve(newProfile)
    })
}

export async function getActiveProfile(init) {
    return new Promise((resolve, reject) => {
        db.profiles.findOne({active: true}, async (err, doc) => {
            if (err) reject(err);
            if (!doc && init) doc = await addProfileFromDefault();
            resolve(doc)
        });
    });
}

export function setActiveProfile(profileName) {
    db.profiles.update({}, {$set: {active: false}}, {multi: true, upsert: false}, function (err, numRemoved) {
        db.profiles.update({name: profileName}, {$set: {active: true}}, {
            multi: false,
            upsert: false
        }, function (err, numRemoved) {
            db.profiles.persistence.compactDatafile()
        })
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
