const {getAccessToken} = require('./auth');

const HOSTNAME = '5cyxxyn4bjho7b7zyqcn3vo3cm.appsync-api.us-east-1.amazonaws.com'
const BASE_URL = `https://${HOSTNAME}/graphql`

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
      room_id
      name
      devices {
        name
        device_id
        capabilities {
          name
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

module.exports = {
  request,
  getLayouts,
  getDeviceStateMap,
  QUERY,
  MUTATION,
  HOSTNAME,
}

async function request(query, variables) {
  const accessToken = await getAccessToken();

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

  if (response.ok) {
    const {data, errors} = await response.json();
    if (errors?.length) {
      const error = new Error('GraphQL error');
      error.data = {errors};
      throw error;
    }
    return data;
  }

  throw new Error(`${response.statusText}: ${await response.text()}`);
}

/**
 * @typedef House
 * @prop {string} id
 * @prop {string} name
 * @prop {Array<Room>} rooms
 * @prop {Array<Mode>} modes
 */

/**
 * @typedef Room
 * @prop {string} name
 * @prop {Array<Device>} devices
 */

/**
 * @typedef Device
 * @prop {string} id
 * @prop {string} name
 */

/**
 * @typedef Mode
 * @prop {string} id
 * @prop {string} name
 */

/**
 * Convenience method for listing all modes and devices in all houses
 * @returns {Promise<Array<House>>}
 */
async function getLayouts() {
  const {ListHouses: houses} = await request(QUERY.LIST_HOUSES, {});
  const layouts = [];
  for (const {house_id: houseId, name} of houses) {
    const house = {id: houseId, name, rooms: []}
    layouts.push(house);

    const {GetModes: modes} = await request(QUERY.GET_MODES, {houseId});
    house.modes = modes;

    const {GetStructure: floors} = await request(QUERY.GET_STRUCTURE, {houseId});
    for (const {name: floorName, rooms} of floors) {
      for (const {room_id: id, name: roomName, devices} of rooms) {
        const room = {id, name: `${floorName}/${roomName}`, devices: []}
        house.rooms.push(room);

        for (const {device_id: id, name, capabilities} of devices) {
          if (capabilities.some(({name}) => name === 'brightness')) {
            const device = {id, name};
            room.devices.push(device);
          }
        }
      }
    }
  }

  return layouts;
}

/**
 * @typedef DeviceState
 * @property {string} powerState
 * @property {string} brightness
 * @property {string} onBrightness
 */

/**
 *
 * @param {Array<string>} deviceIds
 * @returns {Promise<{[id:string]: DeviceState}>}
 */
async function getDeviceStateMap(deviceIds) {
  const {GetDevicesStates: devicesStates} = await request(QUERY.GET_DEVICES_STATES, {deviceIds});
  const deviceStateMap = {};
  for (const {id, states} of devicesStates) {
    const deviceState = {}
    deviceStateMap[id] = deviceState;
    for (const {name, value} of states) {
      if (['powerState', 'brightness', 'onBrightness'].includes(name)) {
        deviceState[name] = value;
      }
    }
  }

  return deviceStateMap;
}