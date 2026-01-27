#!/usr/bin/env node
/**
 * Version Manager Script
 * 
 * Usage:
 *   node scripts/version-manager.js apk    - Increment minor version for APK builds (1.0.0 → 1.1.0)
 *   node scripts/version-manager.js ota    - Increment patch version for OTA updates (1.0.0 → 1.0.1)
 *   node scripts/version-manager.js major  - Increment major version (1.0.0 → 2.0.0)
 *   node scripts/version-manager.js show   - Show current version
 */

const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

function readJsonFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseVersion(versionString) {
    const parts = versionString.split('.').map(Number);
    return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
    };
}

function formatVersion(version) {
    return `${version.major}.${version.minor}.${version.patch}`;
}

function incrementVersion(currentVersion, type) {
    const version = parseVersion(currentVersion);

    switch (type) {
        case 'major':
            // Increment major, reset minor and patch (1.x.x → 2.0.0)
            version.major += 1;
            version.minor = 0;
            version.patch = 0;
            break;
        case 'apk':
        case 'minor':
            // Increment minor, reset patch (1.0.x → 1.1.0)
            version.minor += 1;
            version.patch = 0;
            break;
        case 'ota':
        case 'patch':
            // Increment patch only (1.0.0 → 1.0.1)
            version.patch += 1;
            break;
        default:
            throw new Error(`Unknown version type: ${type}`);
    }

    return formatVersion(version);
}

function updateVersions(type) {
    // Read app.json
    const appJson = readJsonFile(APP_JSON_PATH);
    const currentVersion = appJson.expo.version;

    // Calculate new version
    const newVersion = incrementVersion(currentVersion, type);

    // Update app.json
    appJson.expo.version = newVersion;
    writeJsonFile(APP_JSON_PATH, appJson);

    // Update package.json to keep in sync
    const packageJson = readJsonFile(PACKAGE_JSON_PATH);
    packageJson.version = newVersion;
    writeJsonFile(PACKAGE_JSON_PATH, packageJson);

    return {
        oldVersion: currentVersion,
        newVersion: newVersion,
        type: type
    };
}

function showVersion() {
    const appJson = readJsonFile(APP_JSON_PATH);
    return appJson.expo.version;
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
    console.log(`
Version Manager - Automatic version incrementing for builds

Usage:
  node scripts/version-manager.js <command>

Commands:
  apk    - Increment minor version for APK builds (1.0.0 → 1.1.0)
  ota    - Increment patch version for OTA updates (1.0.0 → 1.0.1)
  major  - Increment major version (1.0.0 → 2.0.0)
  show   - Show current version

Examples:
  npm run version:apk   - Before building APK
  npm run version:ota   - Before publishing OTA update
`);
    process.exit(0);
}

try {
    if (command === 'show') {
        const version = showVersion();
        console.log(`📱 Current version: ${version}`);
    } else if (['apk', 'ota', 'major', 'minor', 'patch'].includes(command)) {
        const result = updateVersions(command);
        console.log(`✅ Version updated successfully!`);
        console.log(`   Type: ${result.type.toUpperCase()}`);
        console.log(`   Old version: ${result.oldVersion}`);
        console.log(`   New version: ${result.newVersion}`);

        if (command === 'apk') {
            console.log(`\n📦 Ready for APK build. Run: eas build --platform android --profile production`);
        } else if (command === 'ota') {
            console.log(`\n🚀 Ready for OTA update. Run: eas update --branch production --message "Your update message"`);
        }
    } else {
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
} catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
}
