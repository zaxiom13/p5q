const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG_NAME = 'runtime-config.json';
const DEFAULT_DOCS = {
  product: 'https://kx.com/products/kdb-x/',
  download: 'https://kx.com/developer/downloads/',
  docs: 'https://code.kx.com/'
};

function configPath(userDataPath) {
  return path.join(userDataPath, CONFIG_NAME);
}

async function loadRuntimeConfig(userDataPath) {
  try {
    const raw = await fs.readFile(configPath(userDataPath), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveRuntimeConfig(userDataPath, nextConfig) {
  const normalized = nextConfig && typeof nextConfig === 'object' ? nextConfig : {};
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(configPath(userDataPath), JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function spawnForOutput(command, args, options = {}) {
  return new Promise((resolve) => {
    const { input, ...spawnOptions } = options;
    const proc = spawn(command, args, {
      windowsHide: true,
      ...spawnOptions
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });

    if (typeof input === 'string') {
      proc.stdin?.end(input);
    } else if (proc.stdin) {
      proc.stdin.end();
    }

    proc.on('error', (error) => {
      resolve({ ok: false, code: -1, stdout, stderr, error: error.message });
    });

    proc.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function fileExists(target) {
  if (!target) {
    return false;
  }
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function linuxCandidates() {
  const home = os.homedir();
  return [
    process.env.P5Q_Q_BIN,
    path.join(home, '.local', 'bin', 'q'),
    path.join(home, 'q', 'l64', 'q'),
    path.join(home, '.kx', 'q'),
    path.join(home, '.kx', 'l64', 'q'),
    '/usr/local/bin/q',
    '/usr/bin/q'
  ].filter(Boolean);
}

function macCandidates() {
  const home = os.homedir();
  return [
    process.env.P5Q_Q_BIN,
    path.join(home, '.local', 'bin', 'q'),
    path.join(home, 'q', 'm64', 'q'),
    path.join(home, '.kx', 'q'),
    path.join(home, '.kx', 'm64', 'q'),
    '/opt/homebrew/bin/q',
    '/usr/local/bin/q'
  ].filter(Boolean);
}

async function testDirectBinary(binaryPath) {
  if (!binaryPath) {
    return { ok: false, message: 'No q executable selected.' };
  }
  if (!(await fileExists(binaryPath))) {
    return { ok: false, message: `File not found: ${binaryPath}` };
  }

  const result = await spawnForOutput(binaryPath, ['-q'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    input: '\\\n'
  });

  if (result.ok) {
    return { ok: true, message: `Connected to q at ${binaryPath}`, resolvedPath: binaryPath };
  }

  const detail = result.stderr || result.error || 'Failed to launch q.';
  return { ok: false, message: detail, resolvedPath: binaryPath };
}

async function resolvePathOnUnix(configuredPath, candidates) {
  if (configuredPath) {
    const tested = await testDirectBinary(configuredPath);
    if (tested.ok) {
      return {
        ok: true,
        source: 'saved',
        command: configuredPath,
        message: tested.message,
        resolvedPath: configuredPath
      };
    }
  }

  for (const candidate of candidates) {
    const tested = await testDirectBinary(candidate);
    if (tested.ok) {
      return {
        ok: true,
        source: 'auto',
        command: candidate,
        message: tested.message,
        resolvedPath: candidate
      };
    }
  }

  const pathLookup = await spawnForOutput('bash', ['-lc', 'command -v q']);
  if (pathLookup.ok && pathLookup.stdout) {
    return {
      ok: true,
      source: 'path',
      command: pathLookup.stdout,
      message: `Connected to q from PATH at ${pathLookup.stdout}`,
      resolvedPath: pathLookup.stdout
    };
  }

  return {
    ok: false,
    message: 'q was not found yet. Install KDB-X, then use Auto Detect or Choose q Executable.'
  };
}

async function resolveWindowsWsl() {
  const pathLookup = await spawnForOutput('wsl.exe', ['bash', '-lc', 'command -v q']);
  if (!pathLookup.ok || !pathLookup.stdout) {
    return {
      ok: false,
      message: 'WSL q was not found yet. Install KDB-X inside WSL and make sure `q` is on the WSL PATH.'
    };
  }

  const smoke = await spawnForOutput('wsl.exe', ['bash', '-lc', 'q -q <<\'EOF\'\n\\\\\nEOF']);
  if (!smoke.ok) {
    return {
      ok: false,
      message: smoke.stderr || 'q was found in WSL, but launching it failed.'
    };
  }

  return {
    ok: true,
    source: 'wsl',
    command: null,
    message: `Connected to q in WSL at ${pathLookup.stdout}`,
    resolvedPath: pathLookup.stdout
  };
}

function platformKey(platform = process.platform) {
  if (platform === 'darwin') {
    return 'macos';
  }
  if (platform === 'win32') {
    return 'windows';
  }
  return 'linux';
}

function buildGuides(platform = process.platform) {
  const key = platformKey(platform);
  const guides = {
    macos: {
      title: 'macOS',
      canBrowseBinary: true,
      autoDetectLabel: 'Auto Detect q',
      steps: [
        'Open the KX downloads page and get KDB-X for macOS.',
        'Finish the KX installer or archive setup.',
        'Come back here and press Auto Detect q.',
        'If auto-detect misses it, use Choose q Executable and point at the `q` binary.'
      ]
    },
    linux: {
      title: 'Linux',
      canBrowseBinary: true,
      autoDetectLabel: 'Auto Detect q',
      steps: [
        'Open the KX downloads page and get KDB-X for Linux.',
        'Finish the install and confirm the `q` executable exists.',
        'Come back here and press Auto Detect q.',
        'If needed, use Choose q Executable and point at the `q` binary.'
      ]
    },
    windows: {
      title: 'Windows',
      canBrowseBinary: false,
      autoDetectLabel: 'Test WSL q',
      steps: [
        'Install WSL if it is not already enabled.',
        'Install KDB-X inside your WSL Linux environment.',
        'Make sure `q` runs from the WSL shell PATH.',
        'Come back here and press Test WSL q. The app will use WSL automatically and keep Command Prompt hidden.'
      ]
    }
  };

  return {
    current: key,
    guides,
    links: DEFAULT_DOCS
  };
}

async function detectRuntime(userDataPath, platform = process.platform) {
  const saved = await loadRuntimeConfig(userDataPath);
  const savedBinary = typeof saved.qBinary === 'string' ? saved.qBinary : '';
  const key = platformKey(platform);

  let detection;
  if (key === 'windows') {
    detection = await resolveWindowsWsl();
  } else if (key === 'macos') {
    detection = await resolvePathOnUnix(savedBinary, macCandidates());
  } else {
    detection = await resolvePathOnUnix(savedBinary, linuxCandidates());
  }

  return {
    platform: key,
    configured: detection.ok,
    source: detection.source || null,
    qBinary: key === 'windows' ? null : detection.command || savedBinary || null,
    resolvedPath: detection.resolvedPath || null,
    message: detection.message,
    guides: buildGuides(platform)
  };
}

async function resolveAndPersistRuntime(userDataPath, platform = process.platform) {
  const status = await detectRuntime(userDataPath, platform);
  const shouldPersist =
    status.platform !== 'windows' &&
    status.configured &&
    typeof status.resolvedPath === 'string' &&
    status.resolvedPath.trim().length > 0;

  if (!shouldPersist) {
    return status;
  }

  const saved = await loadRuntimeConfig(userDataPath);
  const savedBinary = typeof saved.qBinary === 'string' ? saved.qBinary.trim() : '';
  if (savedBinary === status.resolvedPath) {
    return status;
  }

  await setRuntimeBinary(userDataPath, status.resolvedPath);
  return detectRuntime(userDataPath, platform);
}

async function setRuntimeBinary(userDataPath, binaryPath) {
  const clean = typeof binaryPath === 'string' ? binaryPath.trim() : '';
  const next = clean ? { qBinary: clean } : {};
  await saveRuntimeConfig(userDataPath, next);
  return next;
}

module.exports = {
  buildGuides,
  detectRuntime,
  loadRuntimeConfig,
  resolveAndPersistRuntime,
  saveRuntimeConfig,
  setRuntimeBinary,
  testDirectBinary,
  DEFAULT_DOCS
};
