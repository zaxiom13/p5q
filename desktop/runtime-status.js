const os = require('os');
const path = require('path');
const runtimeConfig = require('../electron/runtime-config');

function defaultUserDataPath(platform = process.platform) {
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'qanvas5-editor');
  }
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'qanvas5-editor');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'qanvas5-editor');
}

async function resolveDesktopRuntimeStatus(options = {}) {
  const platform = options.platform || process.platform;
  const userDataPath = options.userDataPath || process.env.QANVAS5_USER_DATA_PATH || defaultUserDataPath(platform);
  return runtimeConfig.resolveAndPersistRuntime(userDataPath, platform);
}

module.exports = {
  defaultUserDataPath,
  resolveDesktopRuntimeStatus
};
