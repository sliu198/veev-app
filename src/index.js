#!/usr/bin/env node

const {Auth} = require('@aws-amplify/auth');
const _ = require('lodash');
const yargs = require('yargs');

const storage = require('./authStorage');
const makeSecretHashForUsername = require('./makeGetSecretHashForUsername');
const makeLoginPrompt = require('./makeLoginPrompt');

const BASE_URL = 'https://5cyxxyn4bjho7b7zyqcn3vo3cm.appsync-api.us-east-1.amazonaws.com/graphql'
const CLIENT_ID = '36io0m3lq030r7bdt7jropjksi'

const QUERY = {
  LIST_HOUSES: `{
  ListHouses {
    house_id
    name
  }
}`,
  GET_STRUCTURE: `query GetStructure($houseId: ID!) {
  GetStructure(house_id: $houseId) {
    name
    rooms {
      name
      devices {
        name
        device_id
        capabilities {
          name
          type
          readOnly
        }
      }
    }
  }
}`,
  GET_DEVICES_STATES: `query GetDevicesStates($deviceIds: [ID!]) {
  GetDevicesStates(device_ids: $deviceIds) {
    id
    states {
      name
      value
    }
  }
}`,
  GET_MODES: `query GetModes($houseId: ID!) {
  GetModes(house_id: $houseId) {
    id
    name
  }
}`
}

const MUTATION = {
  SET_BRIGHTNESS: `mutation SetBrightness($deviceId: ID!, $brightness: String!) {
  UpdateDeviceState(device_id: $deviceId, capabilities: [{name: "brightness", value: $brightness}]) {
    isSuccessful
  }
}`,
  SET_POWER: `mutation TurnOn($deviceId: ID!, $powerState: String!) {
  UpdateDeviceState(device_id: $deviceId, capabilities: [{name: "powerState", value: $powerState}]) {
    isSuccessful
  }
}`,
  ACTIVATE_MODE: `mutation ActivateMode($modeId: ID!) {
  ActivateMode(mode_id: $modeId) {
    isSuccessful
  }
}`
}

Auth.configure({
  region: 'us-east-1',
  userPoolId: 'us-east-1_XQz5nsZwz',
  userPoolWebClientId: CLIENT_ID,
  getSecretHashForUsername: makeSecretHashForUsername(CLIENT_ID),
  storage,
});

yargs.scriptName('veev')
  .command('describe', 'display the state of all lights', describe)
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
      return setPower(deviceId, "true");
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
      return setPower(deviceId, "false");
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
      return setBrightness(deviceId, brightness);
    }
  )
  .command(
    'mode <modeId>',
    'activate a mode',
    yargs => yargs.positional('modeId', {describe: 'mode to activate', type: 'string'}),
    ({modeId}) => activateMode(modeId)
  )
  .help()
  .parse();

async function describe() {
  const client = await makeGraphqlClient();

  const roomDisplay = [];
  const lightIdToLight = {};

  const { ListHouses } = await client.request(QUERY.LIST_HOUSES, {});
  for (const { house_id: houseId, name: houseName } of ListHouses) {
    const { GetModes } = await client.request(QUERY.GET_MODES, {houseId});
    const modes = {name:`${houseName}/Modes`, lights: []};
    for (const {id, name} of GetModes) {
      modes.lights.push({id, name});
    }
    if (modes.lights.length > 0) {
      roomDisplay.push(modes);
    }

    const { GetStructure } = await client.request(QUERY.GET_STRUCTURE, {houseId});
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

  const { GetDevicesStates } = await client.request(QUERY.GET_DEVICES_STATES, {deviceIds: _.keys(lightIdToLight)});
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
  const client = await makeGraphqlClient();

  await client.request(MUTATION.SET_BRIGHTNESS, {deviceId, brightness});
}

async function setPower(deviceId, powerState) {
  const client = await makeGraphqlClient();

  await client.request(MUTATION.SET_POWER, {deviceId, powerState});
}

async function activateMode(modeId) {
  const client = await makeGraphqlClient();

  await client.request(MUTATION.ACTIVATE_MODE, {modeId});
}

async function getAccessToken() {
  let currentSession
  try {
    currentSession = await Auth.currentSession()
  } catch (error) {}

  if (!currentSession) {
    const {email, password} = await makeLoginPrompt();
    currentSession = (await Auth.signIn(email, password))
      ?.getSignInUserSession();
  }

  return currentSession.getAccessToken().getJwtToken();
}

async function makeGraphqlClient() {
  const accessToken = await getAccessToken();
  return {
    request: async function(query, variables) {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken,
        },
        body: JSON.stringify({
          query,
          variables,
        })
      })

      const {data, errors} = (await response.json()) || {};

      if (response.ok) {
        return data;
      }

      const error = new Error(response.statusText);
      error.data = {errors};
      throw error;
    }
  }
}
