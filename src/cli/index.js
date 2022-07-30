const _ = require('lodash');
const yargs = require('yargs');
const {readFileSync} = require('fs');
const path = require('path');

const storage = require('./authStorage');
const {QUERY, MUTATION, request} = require('../api');

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
  const roomDisplay = [];
  const lightIdToLight = {};

  const { ListHouses } = await request(QUERY.LIST_HOUSES, {});
  for (const { house_id: houseId, name: houseName } of ListHouses) {
    const { GetModes } = await request(QUERY.GET_MODES, {houseId});
    const modes = {name:`${houseName}/Modes`, lights: []};
    for (const {id, name} of GetModes) {
      modes.lights.push({id, name});
    }
    if (modes.lights.length > 0) {
      roomDisplay.push(modes);
    }

    const { GetStructure } = await request(QUERY.GET_STRUCTURE, {houseId});
    for (const { rooms, name: floorName} of GetStructure) {
      for (const {name: roomName, devices} of rooms) {
        const room = {name: `${houseName}/${floorName}/${roomName}`, lights: []};
        roomDisplay.push(room);

        devices.forEach(({device_id: id, name, capabilities}) => {
          if (capabilities.some(({name}) => name === 'brightness')) {
            const light = {id, name};
            room.lights.push(light);
            lightIdToLight[id] = light;
          }
        })
      }
    }
  }

  const { GetDevicesStates } = await request(QUERY.GET_DEVICES_STATES, {deviceIds: _.keys(lightIdToLight)});
  for (const {id, states} of GetDevicesStates) {
    const {value: brightness} = states.find(state => state.name === 'brightness');
    lightIdToLight[id].brightness = brightness;
  }

  for (const {name, lights} of roomDisplay) {
    console.log(name);
    for (const {id, name, brightness} of lights) {
      console.log(`  ${id} : ${name} ${brightness ?? ''}`)
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