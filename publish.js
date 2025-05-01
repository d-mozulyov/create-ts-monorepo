// publish.js
// JavaScript script to publish the package with a date-based version
const fs = require('fs');
const { execSync } = require('child_process');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  reset: '\x1b[0m'
};

// Format console message with color
const formatMessage = (message, color) => `${color}${message}${colors.reset}`;

// Get current date in YY.MM.DD format
const date = new Date().toISOString().slice(2, 10).replace(/-/g, '.').replace(/\.0/g, '.');

function publish() {
  try {
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = date;

    // Remove existing package.json.bak if it exists
    if (fs.existsSync('package.json.bak')) {
      fs.unlinkSync('package.json.bak');
    }
    // Rename current package.json to package.json.bak
    fs.renameSync('package.json', 'package.json.bak');

    try {
      // Write updated package.json
      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      // Publish to npm
      execSync('npm publish', { stdio: 'inherit' });
    } finally {
      // Always restore original package.json
      if (fs.existsSync('package.json')) {
        fs.unlinkSync('package.json');
      }
      if (fs.existsSync('package.json.bak')) {
        fs.renameSync('package.json.bak', 'package.json');
      }
    }

    // Done
    console.log(formatMessage(`Published version ${date} successfully`, colors.green));
  } catch (err) {
    console.error(formatMessage(`Error during publishing: ${err.message}`, colors.red));
    process.exit(1);
  }
}

publish();
