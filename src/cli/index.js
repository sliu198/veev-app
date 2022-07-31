const _ = require('lodash');
const yargs = require('yargs');
const {readFileSync} = require('fs');
const path = require('path');

const storage = require('./authStorage');
const {QUERY, MUTATION, request, getLayouts, getDeviceStateMap} = require('../api');

const auth = require('../auth');
const makeLoginPrompt = require('./makeLoginPrompt');
const hashMap = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'assets', 'hash-map.json')).toString());

auth.configure({storage, hashMap});

yargs.scriptName('veev')
  .command('sign-in', 'sign into your account', wrapErrorHandling(signIn))
  .command('describe', 'display the state of all lights', wrapErrorHandling(describe))
  .command(
    'on <deviceId>',
    'set the brightness of a light',
    yargs => {
      yargs.positional('deviceId', {
        describe: 'device to turn on',
        type: 'string',
      })
    },
    ({deviceId}) => {
      return wrapErrorHandling(setPower)(deviceId, "true");
    }
  )
  .command(
    'off <deviceId>',
    'set the brightness of a light',
    yargs => {
      yargs.positional('deviceId', {
        describe: 'device to turn off',
        type: 'string',
      })
    },
    ({deviceId}) => {
      return wrapErrorHandling(setPower)(deviceId, "false");
    }
  )
  .command(
    'brightness <deviceId> <brightness>',
    'set the brightness of a light',
      yargs => {
      yargs.positional('deviceId', {
        describe: 'device to modify',
        type: 'string',
      }).positional('brightness', {
        describe: 'brightness to modify to',
        type: 'string',
      });
    },
    ({deviceId, brightness}) => {
      return wrapErrorHandling(setBrightness)(deviceId, brightness);
    }
  )
  .command(
    'mode <modeId>',
    'activate a mode',
    yargs => yargs.positional('modeId', {describe: 'mode to activate', type: 'string'}),
    ({modeId}) => wrapErrorHandling(activateMode)(modeId)
  )
  .help()
  .parse();

async function signIn() {
  const {email, password} = await makeLoginPrompt();
  await auth.signIn(email, password);
}

async function describe() {
  const houses = await getLayouts();
  const deviceIds = [];
  for (const {rooms} of houses) {
    for (const {devices} of rooms) {
      for (const {id} of devices) {
        deviceIds.push(id);
      }
    }
  }

  const deviceStateMap = await getDeviceStateMap(deviceIds);

  for (const { name: houseName, modes, rooms } of houses) {
    console.log(`${houseName}/Modes`);
    for (const {id, name} of modes) {
      console.log(`  ${id} : ${name}`);
    }

    for (const {name: roomName, devices} of rooms) {
      console.log(`${houseName}/${roomName}`);
      for (const {id, name} of devices) {
        const {powerState, brightness, onBrightness} = deviceStateMap[id];
        console.log(`  ${id} : ${name} ${powerState === 'true' ? `[${brightness}]` : onBrightness}`);
      }
    }
  }
}

async function setBrightness(deviceId, brightness) {
  await request(MUTATION.SET_BRIGHTNESS, {deviceId, brightness});
}

async function setPower(deviceId, powerState) {
  await request(MUTATION.SET_POWER, {deviceId, powerState});
}

async function activateMode(modeId) {
  await request(MUTATION.ACTIVATE_MODE, {modeId});
}

function wrapErrorHandling(f) {
  return async function(...args) {
    try {
      return await f(...args);
    } catch (error) {
      console.error(error.message);
    }
  }
}