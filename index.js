#!/usr/bin/env node
// CLI script to create a TypeScript monorepo based on https://github.com/d-mozulyov/ts-monorepo
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const unzipper = require('unzipper');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  underline: '\x1b[4m'
};

// Format console message with color, optionally underlined
const formatMessage = (message, color, underline = false) =>
  `${underline ? colors.underline : ''}${color}${message}${colors.reset}`;

// Parse command-line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help');
const skipExample = args.includes('--skip-example');
const skipGit = args.includes('--skip-git');
const skipSetup = args.includes('--skip-setup');
const forceMode = args.includes('--force');
const directoryArg = args.find(arg => !arg.startsWith('--'));

// Check for invalid arguments
const validOptions = ['--help', '--skip-example', '--skip-git', '--skip-setup', '--force'];
const invalidArgs = args.filter(arg => arg.startsWith('--') && !validOptions.includes(arg));
if (invalidArgs.length > 0) {
  console.error(formatMessage(`Error: Unknown arguments: ${invalidArgs.join(', ')}`, colors.red));
}

// Internal flags
const removeApp = skipExample;
const useGit = !skipGit;
const useSetup = !skipSetup;

// Display help information if --help is provided or no directory is specified
if (helpFlag || !directoryArg || invalidArgs.length) {
  console.log(formatMessage('create-ts-monorepo', colors.cyan));
  console.log('Creates a TypeScript monorepo based on https://github.com/d-mozulyov/ts-monorepo');
  console.log('\nUsage:');
  console.log('  npx create-ts-monorepo <directory> [options]');
  console.log('\nArguments:');
  console.log('  directory        Name or path of the directory to create (required)');
  console.log('\nOptions:');
  console.log('  --help           Show this help message');
  console.log('  --skip-example   Remove the example app from the monorepo');
  console.log('  --skip-git       Skip Git initialization and initial commit');
  console.log('  --skip-setup     Skip running the setup script');
  console.log('  --force          Overwrite existing directory if it exists');
  process.exit(0);
}

async function main() {
  try {
    // Resolve full path for the monorepo directory
    const monorepoPath = path.resolve(directoryArg.replace(/[/\\]+/g, path.sep));
    console.log(formatMessage(`Creating monorepo at: ${monorepoPath}`, colors.blue));

    // Check if directory exists
    if (fs.existsSync(monorepoPath)) {
      if (forceMode) {
        console.log(formatMessage(`Directory ${monorepoPath} exists and will be removed.`, colors.yellow));
        fs.rmSync(monorepoPath, { recursive: true, force: true });
      } else {
        console.error(formatMessage(`Error: Directory ${monorepoPath} already exists. Remove it manually or use --force.`, colors.red));
        process.exit(1);
      }
    }

    // Create directory
    try {
      fs.mkdirSync(monorepoPath, { recursive: true });
    } catch (err) {
      console.error(formatMessage(`Error creating directory ${monorepoPath}: ${err.message}`, colors.red));
      process.exit(1);
    }

    // Download and extract ZIP
    const zipUrl = 'https://github.com/d-mozulyov/ts-monorepo/archive/refs/heads/main.zip';
    console.log(formatMessage('Downloading template...', colors.blue));
    const response = await fetch(zipUrl);
    if (!response.ok) throw new Error(`Failed to download ZIP: ${response.statusText}`);

    // Get data as ArrayBuffer and create buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save archive to temporary file
    const tempZipPath = path.join(monorepoPath, 'temp.zip');
    fs.writeFileSync(tempZipPath, buffer);

    console.log(formatMessage('Extracting template...', colors.blue));

    // Use Extract to unpack the archive
    await new Promise((resolve, reject) => {
      fs.createReadStream(tempZipPath)
        .pipe(unzipper.Extract({ path: monorepoPath }))
        .on('close', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        });
    });

    // Remove temporary archive file
    fs.unlinkSync(tempZipPath);

    // Identify the root folder of the archive (usually it's the only folder in the root)
    const rootItems = fs.readdirSync(monorepoPath);
    let rootFolder = '';
    for (const item of rootItems) {
      const itemPath = path.join(monorepoPath, item);
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory() && item.includes('ts-monorepo')) {
        rootFolder = item;
        break;
      }
    }

    if (rootFolder) {
      // Move all files from the archive root folder to the target directory
      const rootFolderPath = path.join(monorepoPath, rootFolder);
      const rootFolderItems = fs.readdirSync(rootFolderPath);

      for (const item of rootFolderItems) {
        const sourcePath = path.join(rootFolderPath, item);
        const targetPath = path.join(monorepoPath, item);

        // Move file/folder
        fs.renameSync(sourcePath, targetPath);
      }

      // Remove empty archive root folder
      fs.rmdirSync(rootFolderPath);
    }

    // Remove .vscode and LICENSE
    for (const item of ['.vscode', 'LICENSE']) {
      const itemPath = path.join(monorepoPath, item);
      if (fs.existsSync(itemPath)) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    }

    // Handle removeApp flag
    if (removeApp) {
      const packageJsonPath = path.join(monorepoPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.workspaces && packageJson.workspaces.length > 0) {
        const appPath = path.join(monorepoPath, packageJson.workspaces[0]);
        fs.rmSync(appPath, { recursive: true, force: true });
        packageJson.workspaces = [];
        packageJson.scripts = Object.fromEntries(
          Object.entries(packageJson.scripts || {}).filter(
            ([, value]) => !value.includes(' --workspace=')
          )
        );
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
    }

    // Set executable permissions for Unix-like systems
    if (process.platform !== 'win32') {
      for (const file of ['setup.cmd', 'create-new.cmd']) {
        const filePath = path.join(monorepoPath, file);
        if (fs.existsSync(filePath)) {
          fs.chmodSync(filePath, '755');
        }
      }
    }

    // Initialize Git if useGit is true
    if (useGit) {
      try {
        execSync('git --version');
        console.log(formatMessage('Initializing Git repository...', colors.blue));
        execSync('git init', { cwd: monorepoPath });
        execSync('git add .', { cwd: monorepoPath, stdio: 'ignore' });
        for (const file of ['setup.cmd', 'create-new.cmd']) {
          const filePath = path.join(monorepoPath, file);
          if (fs.existsSync(filePath)) {
            execSync(`git update-index --chmod=+x ${file}`, { cwd: monorepoPath });
          }
        }
        execSync('git commit -m "Initial commit by \'npx create-ts-monorepo\'"', { cwd: monorepoPath });
      } catch (err) {
        console.error(formatMessage(`Error during Git initialization: ${err.message}`, colors.red));
        process.exit(1);
      }
    } else {
      console.warn(formatMessage('Git initialization skipped.', colors.yellow));
    }

    // Run setup script if useSetup is true
    if (useSetup) {
      const setupScript = path.join(monorepoPath, 'setup.cmd');
      if (fs.existsSync(setupScript)) {
        console.log(formatMessage('Running setup script...', colors.blue));
        const command = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
        const args = process.platform === 'win32' ? ['/c', 'setup.cmd'] : ['setup.cmd'];
        execSync(`${command} ${args.join(' ')}`, { cwd: monorepoPath, stdio: 'inherit' });
      }
    }

    // Display success message
    console.log(formatMessage(`Monorepo created successfully at ${monorepoPath}`, colors.green));
    console.log('To learn how to use it, read the documentation at: https://github.com/d-mozulyov/ts-monorepo/blob/main/README.md');
  } catch (err) {
    console.error(formatMessage(`Error: ${err.message}`, colors.red));
    process.exit(1);
  }
}

main();
