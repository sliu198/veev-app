const {readFileSync} = require('fs');
const {createHash} = require('crypto');
const path = require('path');

let HASH_MAP = {};
try {
  HASH_MAP = JSON.parse(readFileSync(path.join(__dirname, '..', 'hash-map.json')).toString());
} catch (error) {}

module.exports = function makeGetSecretHashForUsername(clientId) {
  return (username) => {
    const hash = createHash('sha256')
    hash.update(username);
    hash.update(clientId);
    const key = hash.digest('base64');
    return HASH_MAP[key];
  }
}