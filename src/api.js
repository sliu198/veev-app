const HOSTNAME = '192.168.10.200:8090'
const BASE_URL = `http://${HOSTNAME}/graphql`

const QUERY = {
  GET_STRUCTURE: `query getHouseStructure {
  getHouseStructure {
    id
    name
    rooms {
      id
      name
    }
  }
}`,
  LIST_ROOMS: `query listRooms {
  listRooms {
    id
    name
    devices {
      deviceId
      name
      capabilities {
        property
      }
    }
  }
}`,
  GET_DEVICES_STATES: `query getEntitiesStates($deviceIds: [ID!]) {
  getEntitiesStates(input: {entityType: DEVICE,  entitiesIds: $deviceIds}) {
    id
    capabilitiesStates {
      capability
      state
    }
  }
}`,
  GET_MODES: `query getScenes {
  getScenes {
    sceneId
    name
  }
}`
}

const MUTATION = {
  SET_BRIGHTNESS: `mutation SetBrightness($deviceId: String!, $brightness: String!) {
  updateDeviceState(input: {deviceId: $deviceId, states: [{property: "brightness", state: $brightness}]}) {
    status
  }
}`,
  SET_POWER: `mutation TurnOn($deviceId: String!, $powerState: String!) {
  updateDeviceState(input: {deviceId: $deviceId, states: [{property: "powerState", state: $powerState}]}) {
    status
  }
}`,
  ACTIVATE_MODE: `mutation activateScene($modeId: String!) {
  activateScene(sceneId: $modeId) {
    status
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

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  const layouts = [];
  const house = {id: 0, rooms: []}
  layouts.push(house);

  const roomIdMap = {}

  const {getScenes: modes} = await request(QUERY.GET_MODES, null);
  house.modes = modes.map(({sceneId: id, name}) => ({id, name}) );

  const {getHouseStructure: floors} = await request(QUERY.GET_STRUCTURE, null);
  for (const {name: floorName, rooms} of floors) {
    for (const {id, name: roomName} of rooms) {
      const room = {id, name: `${floorName}/${roomName}`, devices: []}
      roomIdMap[id] = room
      house.rooms.push(room);

      
    }
  }

  const {listRooms: rooms} = await request(QUERY.LIST_ROOMS, null);
  for (const {id, devices} of rooms) {
    const room = roomIdMap[id]
    for (const {deviceId: id, name, capabilities} of devices) {
      if (capabilities.some(({property}) => property === 'brightness')) {
        const device = {id, name};
        room.devices.push(device);
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
  const {getEntitiesStates: devicesStates} = await request(QUERY.GET_DEVICES_STATES, {deviceIds});
  const deviceStateMap = {};
  for (const {id, capabilitiesStates} of devicesStates) {
    const deviceState = {}
    deviceStateMap[id] = deviceState;
    for (const {capability, state} of capabilitiesStates) {
      if (['powerState', 'brightness', 'onBrightness'].includes(capability)) {
        deviceState[capability] = state;
      }
    }
  }

  return deviceStateMap;
}