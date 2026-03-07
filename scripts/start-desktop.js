#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const appEntry = '.';
const explicitRuntime = (process.env.QANVAS5_DESKTOP_RUNTIME || '').trim().toLowerCase();
const electrobunBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electrobun.cmd' : 'electrobun'
);

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

function hasLocalElectrobun() {
  return fs.existsSync(electrobunBin);
}

async function main() {
  if (explicitRuntime === 'electron') {
    runCommand('npx', ['electron', appEntry]);
    return;
  }

  if (explicitRuntime === 'electrobun') {
    runCommand('npx', ['electrobun', 'dev']);
    return;
  }

  if (hasLocalElectrobun()) {
    console.log('[desktop] local Electrobun detected; launching with Electrobun dev (override with QANVAS5_DESKTOP_RUNTIME=electron).');
    runCommand('npx', ['electrobun', 'dev']);
    return;
  }

  console.log('[desktop] Electrobun is not installed in this project; falling back to Electron.');
  runCommand('npx', ['electron', appEntry]);
}

main().catch((error) => {
  console.error('[desktop] Unexpected startup error:', error);
  process.exit(1);
});
