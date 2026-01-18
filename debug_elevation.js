const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const INSTALL_DIR = path.join(process.env.APPDATA || os.homedir(), 'AdobeReader');
const elevationMarker = path.join(INSTALL_DIR, '.elevation_attempted');

console.log('INSTALL_DIR:', INSTALL_DIR);
console.log('Exists INSTALL_DIR:', fs.existsSync(INSTALL_DIR));
console.log('Marker File:', elevationMarker);
console.log('Exists Marker:', fs.existsSync(elevationMarker));

// Check Admin
try {
    const testPath = 'C:\\Windows\\Temp\\admin_test_' + Date.now() + '.tmp';
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
    console.log('Is Admin: TRUE');
} catch (e) {
    console.log('Is Admin: FALSE');
}
