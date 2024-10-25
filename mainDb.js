import Datastore from "nestdb";
import {app} from "electron";
import fs from "fs";
import path, {dirname} from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = {};
db.profiles = new Datastore({filename: app.getPath('userData') + '/profilesDb.json', autoload: true});
db.pageActions = new Datastore({filename: app.getPath('userData') + '/pageActionsDb.json', autoload: true})

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

export async function setProfileKey(profileId, key, value) {
    return new Promise(async (resolve, reject) => {
        if (key === 'name') {
            let profileCount = await countProfile({name: value})
            if (profileCount > 0) {
                reject('Already exists')
            }
        }
        const updateObject = { $set: {} };
        updateObject.$set[key] = value;
        db.profiles.update({_id: profileId}, updateObject, {}, (err, numReplaced) => {
            db.profiles.persistence.compactDatafile()
            resolve(numReplaced)
        })
    })
}

//TODO rename bug
export async function upsertProfile(profile) {
    return new Promise(async (resolve, reject) => {
        // db.profiles.insert(profile)
        let profileCount = await countProfile({name: profile.name})
        db.profiles.update({name: profile.name}, profile, {upsert: (profileCount === 0)}, function (err) {
            if (err) reject(err);
            db.profiles.persistence.compactDatafile()
            db.profiles.findOne({name: profile.name}, (err, doc) => {
                if (err) reject(err);
                resolve(doc);
            });
        })
    })
}

export function getProfiles() {
    return db.profiles.getAllData();
}

export async function getProfile(profileId) {
    return new Promise((resolve, reject) => {
        db.profiles.findOne({_id: profileId}, (err, doc) => {
            if (err) reject(err);
            else resolve(doc);
        });
    });
}

async function countProfile(query) {
    return new Promise((resolve, reject) => {
        db.profiles.count(query, (err, count) => {
            if (err) reject(err);
            else resolve(count);
        });
    });
}

export async function deleteProfile(profileId) {
    return new Promise((resolve, reject) => {
        db.profiles.remove({_id: profileId}, {multi: false}, function (err, numRemoved) {
            if (err) reject(err);
            db.profiles.persistence.compactDatafile()
            resolve(numRemoved);
        })
    })
}


export async function importProfile(filePath) {
    //const fileName = (filePath.includes('/')) ? filePath.split("/").pop() : filePath.split("\\").pop()
    //newProfile.name = fileName.split(".").shift()
    const profile = loadFromFile(filePath)
    const updatedProfile = await upsertProfile(profile)
    //refresh table
    await setActiveProfile(updatedProfile._id)
}

export async function addProfileFromDefault() {
    return new Promise(async (resolve, reject) => {
        let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
        const initialProfileName = newProfile.name
        // let date = new Date(newFromFile.id).toISOString().slice(0, 19).replace('T', ' ')
        let count = 1;
        function checkAndInsert() {
            db.profiles.findOne({ name: newProfile.name }, async (err, existingProfile) => {
                if (err) reject(err);
                if (existingProfile) {
                    newProfile.name = `${initialProfileName} (${count})`;
                    count++;
                    checkAndInsert(); // Recursive call to check again
                } else {
                    const updatedProfile = await upsertProfile(newProfile)
                    resolve(updatedProfile)
                }
            });
        }
        checkAndInsert();
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

//TODO emit event
export async function setActiveProfile(profileId) {
    return new Promise((resolve, reject) => {
        db.profiles.update({}, {$set: {active: false}}, {multi: true, upsert: false}, function (err) {
            if (err) reject(err);
            db.profiles.update({_id: profileId}, {$set: {active: true}}, {
                multi: false,
                upsert: false
            }, function (err, numAffected) {
                if (err) reject(err);
                db.profiles.persistence.compactDatafile()
                resolve(numAffected);
            })
        })
    })
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
