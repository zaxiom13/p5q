#!/usr/bin/env node
const { spawn } = require('child_process');

const appEntry = '.';
const explicitRuntime = (process.env.P5Q_DESKTOP_RUNTIME || '').trim().toLowerCase();

function runCommand(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[desktop] Failed to launch '${command}':`, error.message);
    process.exit(1);
  });
}

function hasBunx() {
  const probe = spawn('bunx', ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32'
  });

  return new Promise((resolve) => {
    probe.on('error', () => resolve(false));
    probe.on('exit', (code) => resolve(code === 0));
  });
}

async function main() {
  if (explicitRuntime === 'electron') {
    runCommand('npx', ['electron', appEntry]);
    return;
  }

  if (explicitRuntime === 'electrobun') {
    runCommand('bunx', ['electrobun', appEntry]);
    return;
  }

  if (await hasBunx()) {
    console.log('[desktop] bunx detected; launching with Electrobun (override with P5Q_DESKTOP_RUNTIME=electron).');
    runCommand('bunx', ['electrobun', appEntry]);
    return;
  }

  console.log('[desktop] bunx not found; falling back to Electron.');
  runCommand('npx', ['electron', appEntry]);
}

main().catch((error) => {
  console.error('[desktop] Unexpected startup error:', error);
  process.exit(1);
});
