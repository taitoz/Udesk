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
        const updateObject = {$set: {}};
        updateObject.$set[key] = value;
        db.profiles.update({_id: profileId}, updateObject, {}, (err, numReplaced) => {
            db.profiles.persistence.compactDatafile()
            resolve(numReplaced)
        })
    })
}

export function getPageActions() {
    return db.pageActions.getAllData();
}

export function getProfiles() {
    return db.profiles.getAllData();
}

export async function getPageAction(url) {
    return new Promise((resolve, reject) => {
        let domain = url.hostname
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        db.pageActions.findOne({url: url}, (err, doc) => {
            if (err) reject(err);
            if (doc) {
                resolve(doc);
            } else {
                db.pageActions.findOne({domain: domain}, (err, doc) => {
                    resolve(doc);
                })
            }
        });
    });
}

export async function getProfile(profileId) {
    return new Promise((resolve, reject) => {
        db.profiles.findOne({_id: profileId}, (err, doc) => {
            if (err) reject(err);
            else resolve(doc);
        });
    });
}

async function countPageActions(query) {
    return new Promise((resolve, reject) => {
        db.pageActions.count(query, (err, count) => {
            if (err) reject(err);
            else resolve(count);
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

export async function updateProfile(profile) {
    return new Promise(async (resolve, reject) => {
        db.profiles.update({_id: profile._id}, profile, function (err, numAffected) {
            if (err) reject(err);
            db.profiles.persistence.compactDatafile()
            resolve(numAffected)
        })
    })
}

export async function upsertPageAction(pageAction) {
    return new Promise(async (resolve, reject) => {
        let pageActionsCount = await countPageActions({domain: pageAction.domain})
        db.pageActions.update({domain: pageAction.domain}, pageAction, {upsert: (pageActionsCount === 0)}, function (err) {
            if (err) reject(err);
            db.pageActions.persistence.compactDatafile()
            db.pageActions.findOne({domain: pageAction.domain}, (err, doc) => {
                if (err) reject(err);
                resolve(doc);
            });
        })
    })
}

export async function upsertProfileByName(profile) {
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

export async function importProfile(filePath) {
    return new Promise(async (resolve, reject) => {
        //const fileName = (filePath.includes('/')) ? filePath.split("/").pop() : filePath.split("\\").pop()
        //newProfile.name = fileName.split(".").shift()
        const profile = loadFromFile(filePath)
        if (profile.error) {
            resolve({severity: 'error', summary: profile.error});
        } else {
            const updatedProfile = await upsertProfileByName(profile)
            await setActiveProfile(updatedProfile._id)
            resolve({severity: 'success', summary: 'profile ' + profile.name + ' successfully imported'})
        }
    })


}

export async function addDefaultPageActions() {

    const defaultPageActions = loadFromFile(path.join(__dirname, 'assets', 'pageActions-default.json'))
    defaultPageActions.forEach(pageAction => {
        upsertPageAction(pageAction)
    })
}

export async function addProfileFromDefault() {
    return new Promise(async (resolve, reject) => {
        let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
        const initialProfileName = newProfile.name
        // let date = new Date(newFromFile.id).toISOString().slice(0, 19).replace('T', ' ')
        let count = 1;

        function checkAndInsert() {
            db.profiles.findOne({name: newProfile.name}, async (err, existingProfile) => {
                if (err) reject(err);
                if (existingProfile) {
                    newProfile.name = `${initialProfileName} (${count})`;
                    count++;
                    checkAndInsert(); // Recursive call to check again
                } else {
                    const updatedProfile = await upsertProfileByName(newProfile)
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
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(fileContent)
    } catch (e) {
        return {error: e.message}
    }
}
