const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

const MONGO_PORT = process.env.MONGO_PORT || '27017';
const DB_PATH = path.join(__dirname, '.data', 'db');
const LOG_PATH = path.join(__dirname, '.data', 'mongod.log');

function isMongoRunning() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: Number(MONGO_PORT) });
    socket.setTimeout(1500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function findMongoBin() {
  if (process.env.MONGO_BIN && fs.existsSync(process.env.MONGO_BIN)) return process.env.MONGO_BIN;

  const home = os.homedir();
  const exeCandidates = [
    path.join(home, '.local', 'mongodb', 'bin', 'mongod.exe'),
    path.join(home, 'AppData', 'Local', 'MongoDB', 'bin', 'mongod.exe'),
  ];
  for (const file of exeCandidates) {
    if (fs.existsSync(file)) return file;
  }

  const dirCandidates = [
    path.join('C:', 'Program Files', 'MongoDB', 'Server'),
    path.join('C:', 'Program Files (x86)', 'MongoDB', 'Server'),
    path.join(home, '.local', 'mongodb', 'bin'),
  ];
  for (const base of dirCandidates) {
    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
      const found = findSync(base, 'mongod.exe');
      if (found) return found;
    }
  }
  return 'mongod';
}

function findSync(dir, target) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const nested = findSync(full, target);
      if (nested) return nested;
    } else if (e.isFile() && e.name === target) {
      return full;
    }
  }
  return null;
}

let started = false;

async function ensureMongo() {
  if (await isMongoRunning()) return false;

  if (started) return true;
  started = true;

  fs.mkdirSync(DB_PATH, { recursive: true });
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

  const bin = findMongoBin();
  const args = ['--dbpath', DB_PATH, '--port', MONGO_PORT, '--bind_ip', '127.0.0.1', '--logpath', LOG_PATH];

  console.log(`Starting mongod: ${bin} --dbpath ${DB_PATH} --port ${MONGO_PORT}`);
  const child = spawn(bin, args, { detached: false, stdio: 'ignore' });

  child.on('error', (err) => {
    console.error(`Failed to start mongod (${bin}):`, err.message);
    console.error('Install MongoDB or set MONGO_BIN in server/.env to your mongod.exe path.');
  });

  // Wait for mongod to accept connections
  for (let i = 0; i < 40; i++) {
    if (await isMongoRunning()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return true;
}

module.exports = { ensureMongo, isMongoRunning, MONGO_PORT };