import Datastore from "nestdb";
import {app} from "electron";
import fs from "fs";
import path, {dirname} from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = {};
db.profiles = new Datastore({
    filename: app.getPath('userData') + '/profilesDb.json',
    autoload: true,
    timestampData: true
});
let dbReady = false;
let dbReadyCallbacks = [];

function onDbReady(callback) {
    if (dbReady) {
        callback();
    } else {
        dbReadyCallbacks.push(callback);
    }
}

db.pageActions = new Datastore({
    filename: app.getPath('userData') + '/pageActionsDb.json',
    autoload: true,
    timestampData: true,
    onload: function (err) {
        if (err) {
            console.error('Failed to load the pageActions datastore:', err);
        } else {
            console.log('Loaded the pageActions datastore!');
            // Configure auto-compaction
            db.pageActions.persistence.setAutocompactionInterval(5000);
            dbReady = true;
            initPageActions();
            // Execute all pending callbacks
            dbReadyCallbacks.forEach(callback => callback());
            dbReadyCallbacks = [];
        }
    }
});

export function initDb() {
    // C:\Users\user\AppData\Roaming\Udesk\settings.json
    // /home/developer/.config/Udesk/settings.json
    return new Datastore({
        filename: dbPath, autoload: true
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
    return new Promise((resolve) => {
        onDbReady(() => {
            const data = db.pageActions.getAllData();
            //console.log('Retrieved page actions:', data);
            resolve(data);
        });
    });
}

export function getProfiles() {
    return db.profiles.getAllData();
}

export async function getPageAction(url, serviceId) {
    return new Promise((resolve, reject) => {
        if (!url && !serviceId) {
            resolve(null);
            return;
        }

        // Try serviceId first (most specific)
        if (serviceId) {
            db.pageActions.findOne({serviceId: serviceId}, (err, doc) => {
                if (err) { reject(err); return; }
                if (doc) {
                    resolve(doc);
                    return;
                }
                // Fall back to domain lookup
                findByDomain(url, resolve, reject);
            });
        } else {
            findByDomain(url, resolve, reject);
        }
    });
}

function findByDomain(url, resolve, reject) {
    if (!url) { resolve(null); return; }

    let urlObj;
    try {
        urlObj = typeof url === 'string' ? new URL(url) : url;
    } catch (e) {
        console.error('Invalid URL:', url);
        resolve(null);
        return;
    }

    let domain = urlObj.hostname;
    if (domain.startsWith('www.')) {
        domain = domain.substring(4);
    }
    db.pageActions.findOne({domain: domain}, (err, doc) => {
        if (err) reject(err);
        else resolve(doc);
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
    console.log('Upserting page action:', pageAction);
    const query = pageAction.serviceId ? {serviceId: pageAction.serviceId} : {domain: pageAction.domain};
    return new Promise(async (resolve, reject) => {
        try {
            db.pageActions.update(
                query, 
                pageAction, 
                {upsert: true}, 
                async function (err) {
                    if (err) {
                        console.error('Error updating page action:', err);
                        reject(err);
                        return;
                    }
                    
                    // Force persistence
                    await new Promise((res) => db.pageActions.persistence.compactDatafile(res));
                    
                    db.pageActions.findOne(query, (err, doc) => {
                        if (err) {
                            console.error('Error finding page action after update:', err);
                            reject(err);
                            return;
                        }
                        console.log('Page action upserted successfully:', doc);
                        resolve(doc);
                    });
                }
            );
        } catch (error) {
            console.error('Error in upsertPageAction:', error);
            reject(error);
        }
    });
}

export async function deletePageAction(serviceId) {
    return new Promise((resolve, reject) => {
        db.pageActions.remove({serviceId: serviceId}, {}, async (err, numRemoved) => {
            if (err) {
                console.error('Error deleting page action:', err);
                reject(err);
                return;
            }
            await new Promise((res) => db.pageActions.persistence.compactDatafile(res));
            console.log(`Page action deleted for serviceId: ${serviceId}, removed: ${numRemoved}`);
            resolve(numRemoved);
        });
    });
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
    try {
        // Check if we already have any page actions
        const existingActions = await new Promise((resolve, reject) => {
            db.pageActions.find({}, (err, docs) => {
                if (err) reject(err);
                else resolve(docs);
            });
        });

        // Only add default actions if none exist
        if (!existingActions || existingActions.length === 0) {
            console.log('No existing page actions found, adding defaults');
            const defaultPageActions = loadFromFile(path.join(__dirname, 'assets', 'pageActions-default.json'));
            for (const pageAction of defaultPageActions) {
                await upsertPageAction(pageAction);
            }
        } else {
            console.log('Existing page actions found, skipping defaults');
        }
    } catch (error) {
        console.error('Error in addDefaultPageActions:', error);
    }
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

function initPageActions() {
    // Initialize page actions or load initial data here
    // For example, add default page actions
    addDefaultPageActions();
}
