const {readFileSync, writeFileSync} = require('fs');
const path = require('path');

const STORAGE_PATH = path.resolve(__dirname, 'storage.json');

let storage = {}

try {
  storage = JSON.parse(readFileSync(STORAGE_PATH).toString());
} catch (error) {}

module.exports = {
  getItem,
  setItem,
  removeItem,
  clear,
}

function getItem(key) {
  return storage[key] ?? null;
}

function setItem(key, value) {
  storage[key] = value;
  save();
}

function removeItem(key) {
  delete storage[key];
  save();
}

function clear() {
  storage = {};
  save();
}

function save() {
  writeFileSync(STORAGE_PATH, JSON.stringify(storage));
}