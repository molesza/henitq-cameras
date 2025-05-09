// assign_interfaces.js
const fs = require('fs');
const yaml = require('yaml');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = './virtual_interfaces.db';
const CONFIG_PATH = './NVR-Configs/192.168.6.201.yaml';
const PLACEHOLDER_MAC = '<ONVIF PROXY MAC ADDRESS HERE>';

/**
 * Connects to the SQLite database.
 * @returns {Promise<sqlite3.Database>} A promise that resolves with the database instance.
 */
function connectDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error connecting to database:', err.message);
                reject(err);
            } else {
                console.log('Connected to the SQLite database.');
                resolve(db);
            }
        });
    });
}

/**
 * Reads and parses the YAML configuration file.
 * @param {string} filePath The path to the YAML file.
 * @returns {Promise<object>} A promise that resolves with the parsed YAML object.
 */
function readConfig(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading config file:', err.message);
                reject(err);
            } else {
                try {
                    const config = yaml.parse(data);
                    console.log(`Successfully read config file: ${filePath}`);
                    resolve(config);
                } catch (parseErr) {
                    console.error('Error parsing YAML:', parseErr.message);
                    reject(parseErr);
                }
            }
        });
    });
}

/**
 * Finds an available MAC address in the database.
 * @param {sqlite3.Database} db The database instance.
 * @returns {Promise<string|null>} A promise that resolves with an available MAC address or null if none found.
 */
function findAvailableMac(db) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT mac_address FROM virtual_interfaces WHERE status = 'available' LIMIT 1`;
         db.get(sql, [], (err, row) => {
             if (err) {
                 console.error('Error querying database for available MAC:', err.message);
                 reject(err);
             } else {
                 resolve(row ? row.mac_address : null);
             }
         });
    });
}

/**
 * Updates the status of a MAC address in the database to 'used'.
 * @param {sqlite3.Database} db The database instance.
 * @param {string} mac The MAC address to update.
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */
function updateMacStatus(db, mac) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE virtual_interfaces SET status = 'used' WHERE mac_address = ?`;
         db.run(sql, [mac], function(err) {
             if (err) {
                 console.error(`Error updating status for MAC ${mac}:`, err.message);
                 reject(err);
             } else {
                 console.log(`Updated status for MAC ${mac} to 'used'. Rows affected: ${this.changes}`);
                 resolve();
             }
         });
    });
}

/**
 * Recursively finds and replaces MAC address placeholders in the config object.
 * @param {sqlite3.Database} db The database instance.
 * @param {object} config The configuration object.
 * @param {string} placeholder The placeholder string to search for.
 * @param {Array<string>} assignedMacs An array to store assigned MAC addresses.
 * @returns {Promise<void>} A promise that resolves when all replacements are attempted.
 */
async function assignMacsToConfig(db, config, placeholder) {
    if (typeof config !== 'object' || config === null) {
        return;
    }

    for (const key in config) {
        if (Object.prototype.hasOwnProperty.call(config, key)) {
            const value = config[key];

            if (typeof value === 'string' && value === placeholder) {
                const availableMac = await findAvailableMac(db);
                if (availableMac) {
                    console.log(`Assigning available MAC ${availableMac} to a placeholder.`);
                    config[key] = availableMac;
                    await updateMacStatus(db, availableMac); // Update status immediately
                } else {
                    console.warn('Warning: No available MAC addresses found in the database for a placeholder.');
                    // Keep the placeholder if no MAC is available
                }
            } else if (typeof value === 'object') {
                await assignMacsToConfig(db, value, placeholder);
            }
        }
    }
}

/**
 * Saves the modified configuration object to a YAML file.
 * @param {string} filePath The path to save the YAML file.
 * @param {object} config The configuration object to save.
 * @returns {Promise<void>} A promise that resolves when the file is saved.
 */
function saveConfig(filePath, config) {
    return new Promise((resolve, reject) => {
        try {
            const yamlString = yaml.stringify(config, { indent: 2 });
            fs.writeFile(filePath, yamlString, 'utf8', (err) => {
                if (err) {
                    console.error('Error writing config file:', err.message);
                    reject(err);
                } else {
                    console.log(`Successfully saved config file: ${filePath}`);
                    resolve();
                }
            });
        } catch (dumpErr) {
            console.error('Error stringifying YAML:', dumpErr.message);
            reject(dumpErr);
        }
    });
}

/**
 * Main function to run the interface assignment script.
 * @param {string} inputConfigPath The path to the input configuration file.
 * @param {string} outputPath The path to save the modified configuration file.
 */
async function runAssignment(inputConfigPath, outputPath) {
    let db = null;
    try {
        db = await connectDb();
        const config = await readConfig(inputConfigPath);

        await assignMacsToConfig(db, config, PLACEHOLDER_MAC);

        // Check if any placeholders remain after assignment
        const remainingPlaceholders = [];
        JSON.stringify(config, (key, value) => {
            if (value === PLACEHOLDER_MAC) {
                remainingPlaceholders.push(key); // Or some identifier
            }
            return value;
        });

        if (remainingPlaceholders.length > 0) {
            console.warn(`Warning: ${remainingPlaceholders.length} placeholder(s) for '${PLACEHOLDER_MAC}' remain in the configuration after attempting assignment. This indicates insufficient available interfaces.`);
        }

        await saveConfig(outputPath, config);

        console.log('Interface assignment script finished.');

    } catch (error) {
        console.error('Script failed:', error);
    } finally {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed.');
                }
            });
        }
    }
}

// Example usage:
// To update the existing file:
// runAssignment();

// To generate a new config file:
// runAssignment('./NVR-Configs/new_config.yaml');

// Determine input and output paths from command line arguments
const args = process.argv.slice(2);

const configPathArg = args.find(arg => arg.startsWith('--config=') || arg.startsWith('-c='));
const inputConfigPath = configPathArg ? configPathArg.split('=')[1] : CONFIG_PATH;

const outputPathArg = args.find(arg => arg.startsWith('--output='));
const outputPath = outputPathArg ? outputPathArg.split('=')[1] : inputConfigPath; // Default output to input path if --output is not used

runAssignment(inputConfigPath, outputPath);